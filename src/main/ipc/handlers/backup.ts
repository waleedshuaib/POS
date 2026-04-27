import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { dialog, app, shell } from 'electron';
import { closeDatabase, initDatabase, getDbPath, getImagesDir } from '../../db/client';
import { backupStatus, backupsDir, runScheduledBackup } from '../../backup-scheduler';
import { logsDir } from '../../logger';
import archiver from 'archiver';
import { createWriteStream, existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import extract from 'extract-zip';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

registerRoutes({
  'backup.export': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin', 'manager'],
    handler: async () => {
      const result = await dialog.showSaveDialog({
        title: 'Save Backup',
        defaultPath: `pos-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'Zip', extensions: ['zip'] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true, path: null };

      const zipPath = result.filePath;
      const dbPath = getDbPath();
      const imagesDir = getImagesDir();

      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', () => resolve());
        output.on('error', reject);
        archive.on('error', reject);
        archive.pipe(output);
        if (existsSync(dbPath)) archive.file(dbPath, { name: 'pos.db' });
        if (existsSync(imagesDir)) {
          for (const f of readdirSync(imagesDir)) {
            const p = join(imagesDir, f);
            if (statSync(p).isFile()) archive.file(p, { name: `images/${f}` });
          }
        }
        archive.finalize();
      });

      return { canceled: false, path: zipPath };
    },
  }),
  'backup.restore': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin'],
    handler: async () => {
      const result = await dialog.showOpenDialog({
        title: 'Select Backup Zip',
        filters: [{ name: 'Zip', extensions: ['zip'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths?.[0]) return { canceled: true };

      const zipPath = result.filePaths[0];
      const tmp = mkdtempSync(join(tmpdir(), 'pos-restore-'));
      await extract(zipPath, { dir: tmp });

      const dbSrc = join(tmp, 'pos.db');
      if (!existsSync(dbSrc)) {
        rmSync(tmp, { recursive: true, force: true });
        throw new Error('Backup archive missing pos.db');
      }

      closeDatabase();
      const dbDest = getDbPath();
      copyFileSync(dbSrc, dbDest);

      const imagesSrc = join(tmp, 'images');
      if (existsSync(imagesSrc)) {
        const destDir = getImagesDir();
        for (const f of readdirSync(imagesSrc)) {
          copyFileSync(join(imagesSrc, f), join(destDir, basename(f)));
        }
      }

      rmSync(tmp, { recursive: true, force: true });
      await initDatabase();
      return { canceled: false, restartRecommended: true };
    },
  }),
  'backup.info': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => {
      let auto: ReturnType<typeof backupStatus> | null = null;
      try { auto = backupStatus(); } catch { /* not configured (e.g. tests) */ }
      let logsPath: string | null = null;
      try { logsPath = logsDir(); } catch { /* ignore */ }
      return {
        dbPath: getDbPath(),
        imagesDir: getImagesDir(),
        version: app.getVersion?.() ?? '0.0.0',
        platform: process.platform,
        autoBackup: auto,
        logsDir: logsPath,
      };
    },
  }),
  'backup.runNow': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin', 'manager'],
    handler: async () => {
      const result = await runScheduledBackup();
      return result;
    },
  }),
  'backup.openFolder': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin', 'manager'],
    handler: async () => {
      try {
        await shell.openPath(backupsDir());
        return { ok: true };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    },
  }),
  'logs.openFolder': defineRoute({
    input: z.object({}).optional().default({}),
    handler: async () => {
      try {
        await shell.openPath(logsDir());
        return { ok: true };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    },
  }),
  'logs.openTodayFile': defineRoute({
    input: z.object({}).optional().default({}),
    handler: async () => {
      const date = new Date().toISOString().slice(0, 10);
      const path = join(logsDir(), `${date}.log`);
      if (!existsSync(path)) return { ok: false, message: 'No log file for today yet' };
      try {
        await shell.openPath(path);
        return { ok: true, path };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    },
  }),
});
