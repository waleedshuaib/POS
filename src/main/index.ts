import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { join } from 'path';
import { registerIpc } from './ipc/router';
import './ipc/handlers';
import { initDatabase, closeDatabase } from './db/client';
import { ensureSeeded } from './seed';
import { configureLogger, attachProcessHandlers, log } from './logger';
import { configureBackupScheduler, stopBackupScheduler } from './backup-scheduler';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  configureLogger(app.getPath('userData'));
  attachProcessHandlers();
  log('info', 'app.ready');

  await initDatabase();
  await ensureSeeded();
  registerIpc(ipcMain);

  configureBackupScheduler(app.getPath('userData'));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  log('info', 'app.shutdown');
  stopBackupScheduler();
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});
