import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import * as schema from './schema';
import { runMigrations } from './migrate';
import { deriveDbKey } from './key';

// Defensive electron import: `app` is populated only inside the Electron main
// process. In plain Node (tests, scripts) this is null and paths fall back to
// env vars / cwd.
function loadElectronApp(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('electron');
    return mod && typeof mod === 'object' ? mod.app ?? null : null;
  } catch {
    return null;
  }
}
const electronApp: any = loadElectronApp();

/**
 * Database driver loader. Prefers `better-sqlite3-multiple-ciphers` (SQLCipher
 * compatible) so we can encrypt the DB at rest. Falls back to vanilla
 * `better-sqlite3` if the encrypted variant isn't installed (dev convenience,
 * tests). The two share an identical API.
 */
function loadDatabase(): any {
  // Tests opt out of encryption explicitly.
  if (process.env.POS_DB_PLAINTEXT === '1') {
    return require('better-sqlite3');
  }
  try {
    return require('better-sqlite3-multiple-ciphers');
  } catch {
    return require('better-sqlite3');
  }
}

const Database: any = loadDatabase();
const isEncryptedDriver = (() => {
  try {
    require.resolve('better-sqlite3-multiple-ciphers');
    return process.env.POS_DB_PLAINTEXT !== '1';
  } catch {
    return false;
  }
})();

let sqlite: any | null = null;
let dbInstance: BetterSQLite3Database<typeof schema> | null = null;

export function getDbPath(): string {
  if (process.env.POS_DB_PATH) return process.env.POS_DB_PATH;
  const userData = electronApp?.getPath?.('userData') ?? process.env.POS_USER_DATA ?? process.cwd();
  if (!existsSync(userData)) mkdirSync(userData, { recursive: true });
  return join(userData, 'pos.db');
}

export function getImagesDir(): string {
  const userData = electronApp?.getPath?.('userData') ?? process.env.POS_USER_DATA ?? process.cwd();
  const dir = join(userData, 'images');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Detect whether the file at `path` is an UNencrypted SQLite DB.
 * Encrypted SQLCipher files start with random bytes; plain SQLite files start
 * with the literal string "SQLite format 3\0".
 */
function isPlainSqliteFile(path: string): boolean {
  try {
    const fd = require('fs').openSync(path, 'r');
    const buf = Buffer.alloc(16);
    require('fs').readSync(fd, buf, 0, 16, 0);
    require('fs').closeSync(fd);
    return buf.toString('utf8', 0, 15) === 'SQLite format 3';
  } catch {
    return false;
  }
}

/**
 * On first launch with the encrypted driver, an existing PLAINTEXT pos.db is
 * automatically migrated: a backup of the plaintext is preserved first, then
 * `PRAGMA rekey` encrypts the file in place. Idempotent — safe to call again.
 */
function migrateToEncrypted(plainPath: string, key: string): void {
  if (!existsSync(plainPath) || !isPlainSqliteFile(plainPath)) return;

  const backupPath = plainPath + '.plaintext.bak';
  if (!existsSync(backupPath)) {
    copyFileSync(plainPath, backupPath);
    console.log(`[db] plaintext backup saved at ${backupPath}`);
  }
  const tmp = new Database(plainPath);
  tmp.pragma(`rekey = '${key.replace(/'/g, "''")}'`);
  tmp.close();
  console.log('[db] migrated existing pos.db to encrypted in place');
}

export async function initDatabase(dbPath?: string, migrationsFolder?: string): Promise<void> {
  const path = dbPath ?? getDbPath();
  const userDataDir = dirname(path);
  if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true });

  let key: string | null = null;
  if (isEncryptedDriver) {
    key = deriveDbKey(userDataDir);
    // Try to migrate an old plaintext DB before opening encrypted.
    try { migrateToEncrypted(path, key); } catch (err) {
      console.error('[db] plaintext->encrypted migration failed:', err);
    }
  }

  sqlite = new Database(path);
  if (isEncryptedDriver && key) {
    sqlite.pragma(`key = '${key.replace(/'/g, "''")}'`);
    // Sanity: if the key is wrong, the first read fails.
    try {
      sqlite.prepare('SELECT count(*) FROM sqlite_master').get();
    } catch (err) {
      throw new Error('Database key invalid — file may have been moved between machines or salt was deleted');
    }
  }
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  dbInstance = drizzle(sqlite, { schema });

  const dir = migrationsFolder ?? resolveMigrationsDir();
  try {
    runMigrations(sqlite, dir);
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  }
}

function resolveMigrationsDir(): string {
  if (process.env.POS_MIGRATIONS_DIR) return process.env.POS_MIGRATIONS_DIR;
  const packaged = electronApp?.isPackaged ? join(process.resourcesPath, 'drizzle') : join(process.cwd(), 'drizzle');
  return packaged;
}

export function db(): BetterSQLite3Database<typeof schema> {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance;
}

export function rawDb(): any {
  if (!sqlite) throw new Error('Database not initialized');
  return sqlite;
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    dbInstance = null;
  }
}

/** True if the DB is opened with an encryption key. */
export function isEncrypted(): boolean {
  return isEncryptedDriver;
}

export { schema };
