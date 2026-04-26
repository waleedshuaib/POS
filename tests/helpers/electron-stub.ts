import os from 'os';
import { join } from 'path';
import { mkdtempSync, existsSync, mkdirSync } from 'fs';

const base = mkdtempSync(join(os.tmpdir(), 'pos-test-'));
const imagesDir = join(base, 'images');
if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true });

// Minimal Electron stub for the integration tests. We only use `app.getPath`,
// `app.isPackaged`, and `dialog` (stubbed).
export const app = {
  getPath(name: string) {
    if (name === 'userData') return base;
    if (name === 'temp') return os.tmpdir();
    return base;
  },
  getVersion() {
    return '0.0.0-test';
  },
  isPackaged: false,
};

export const ipcMain = { handle() {} };
export const BrowserWindow = class {};
export const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async () => ({ canceled: true, filePath: '' }),
};
export const shell = {
  openPath: async () => '',
  openExternal: async () => {},
};
export const contextBridge = { exposeInMainWorld() {} };
export const ipcRenderer = { invoke: async () => null };
