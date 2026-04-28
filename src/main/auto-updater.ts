/**
 * Auto-update wiring via electron-updater.
 *
 * Behaviour:
 *   - On app start, after a small delay, check the configured publish channel
 *     (GitHub Releases by default — see electron-builder `publish` config in
 *     package.json) for a newer version.
 *   - If found, download in the background and prompt the user to restart
 *     the next time the app is idle.
 *   - All errors are logged but never crash the app — POS terminals can be
 *     fully offline and the auto-update layer must never block sales.
 */

import { app, dialog, type BrowserWindow } from 'electron';
import { log } from './logger';

let installed = false;

export async function initAutoUpdater(getMainWindow: () => BrowserWindow | null): Promise<void> {
  if (installed) return;
  installed = true;

  // Auto-update is meaningless in dev — skip.
  if (!app.isPackaged) {
    log('info', 'autoUpdater.skipped', { reason: 'not packaged' });
    return;
  }
  if (process.env.POS_DISABLE_AUTOUPDATE === '1') {
    log('info', 'autoUpdater.skipped', { reason: 'env disabled' });
    return;
  }

  let autoUpdater: any;
  try {
    // Lazy-require so the app still boots if the dep is missing on a dev box.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (err) {
    log('warn', 'autoUpdater.unavailable', err);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => log('info', 'autoUpdater.checking'));
  autoUpdater.on('update-available', (info: any) => log('info', 'autoUpdater.available', info));
  autoUpdater.on('update-not-available', () => log('info', 'autoUpdater.upToDate'));
  autoUpdater.on('error', (err: Error) => log('error', 'autoUpdater.error', err));
  autoUpdater.on('download-progress', (p: any) =>
    log('debug', 'autoUpdater.progress', { pct: Math.round(p.percent) }),
  );

  autoUpdater.on('update-downloaded', async (info: any) => {
    log('info', 'autoUpdater.downloaded', { version: info.version });
    const win = getMainWindow();
    if (!win) return;
    const choice = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Mizan POS ${info.version} is ready to install.`,
      detail: 'Restart the app now to apply the update. All work in progress will be saved.',
    });
    if (choice.response === 0) autoUpdater.quitAndInstall();
  });

  // Slight delay so the main window is ready and the user isn't hit with
  // a network call competing with the splash.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => log('warn', 'autoUpdater.checkFailed', err));
  }, 8000);

  // Re-check every 6 hours in case the app stays open all day.
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => log('warn', 'autoUpdater.checkFailed', err));
  }, 6 * 60 * 60 * 1000);
}
