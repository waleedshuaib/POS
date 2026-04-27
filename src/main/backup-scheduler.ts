import { join } from 'path';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'fs';
import archiver from 'archiver';
import { getDbPath, getImagesDir } from './db/client';
import { log } from './logger';

let userDataDir: string | null = null;
let timer: NodeJS.Timeout | null = null;

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_NAME = 'pos-new.zip';
const OLD_NAME = 'pos-old.zip';

export function configureBackupScheduler(userData: string): void {
  userDataDir = userData;
  const dir = backupsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Run on startup if the latest backup is older than 24h (or none exists yet).
  void maybeRunOnStartup();
  // Then schedule once per day.
  timer = setInterval(() => {
    void runScheduledBackup().catch((err) => log('error', 'backup.scheduled.error', err));
  }, DAY_MS);
  // Don't keep the event loop alive just for this.
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopBackupScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function backupsDir(): string {
  if (!userDataDir) throw new Error('Backup scheduler not configured');
  return join(userDataDir, 'backups');
}

export interface BackupSlot {
  path: string;
  exists: boolean;
  sizeBytes: number;
  mtime: number | null;
}

export function backupStatus(): { newSlot: BackupSlot; oldSlot: BackupSlot } {
  return {
    newSlot: slotInfo(NEW_NAME),
    oldSlot: slotInfo(OLD_NAME),
  };
}

function slotInfo(name: string): BackupSlot {
  const path = join(backupsDir(), name);
  if (!existsSync(path)) return { path, exists: false, sizeBytes: 0, mtime: null };
  const st = statSync(path);
  return { path, exists: true, sizeBytes: st.size, mtime: st.mtimeMs };
}

async function maybeRunOnStartup(): Promise<void> {
  try {
    const status = backupStatus();
    const lastBackupAge = status.newSlot.mtime ? Date.now() - status.newSlot.mtime : Infinity;
    if (lastBackupAge >= DAY_MS) {
      log('info', 'backup.startup.due', { lastAgeHours: Math.round(lastBackupAge / 3600_000) });
      await runScheduledBackup();
    } else {
      log('info', 'backup.startup.skipped', { lastAgeHours: Math.round(lastBackupAge / 3600_000) });
    }
  } catch (err) {
    log('error', 'backup.startup.error', err);
  }
}

/**
 * Take a fresh backup, rolling old/new:
 *   1. If pos-new.zip exists → rename it to pos-old.zip (overwriting any).
 *   2. Write fresh pos-new.zip with current DB + images.
 *
 * After this, pos-new.zip is today's, pos-old.zip is the previous one.
 * Both are kept; the older `pos-old.zip` is replaced on the NEXT scheduled run.
 */
export async function runScheduledBackup(): Promise<{ newPath: string; oldPath: string | null }> {
  const dir = backupsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const newPath = join(dir, NEW_NAME);
  const oldPath = join(dir, OLD_NAME);

  // Rotate: previous "new" becomes "old", overwriting older "old".
  let rotated: string | null = null;
  if (existsSync(newPath)) {
    if (existsSync(oldPath)) {
      try {
        unlinkSync(oldPath);
      } catch {
        // ignore
      }
    }
    renameSync(newPath, oldPath);
    rotated = oldPath;
  }

  await writeBackupZip(newPath);
  log('info', 'backup.completed', {
    newPath,
    rotatedTo: rotated,
    sizeBytes: statSync(newPath).size,
  });
  return { newPath, oldPath: rotated };
}

function writeBackupZip(zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbPath = getDbPath();
    const imagesDir = getImagesDir();
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    if (existsSync(dbPath)) archive.file(dbPath, { name: 'pos.db' });
    if (existsSync(imagesDir)) {
      for (const f of readdirSync(imagesDir)) {
        const p = join(imagesDir, f);
        try {
          if (statSync(p).isFile()) archive.file(p, { name: `images/${f}` });
        } catch {
          // ignore
        }
      }
    }
    archive.finalize();
  });
}
