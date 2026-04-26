import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as schema from './schema';
import { runMigrations } from './migrate';

// Defensive electron import: `app` is populated only inside the Electron main
// process. In plain Node (tests, smoke scripts) this is null and paths fall
// back to env vars / cwd.
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

let sqlite: Database.Database | null = null;
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

export async function initDatabase(dbPath?: string, migrationsFolder?: string): Promise<void> {
  const path = dbPath ?? getDbPath();
  sqlite = new Database(path);
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

export function rawDb(): Database.Database {
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

export { schema };
