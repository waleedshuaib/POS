import { contextBridge, ipcRenderer } from 'electron';

export interface InvokeEnvelope {
  action: string;
  input: unknown;
  token?: string | null;
}
export type ReplyEnvelope<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

const api = {
  invoke: <T = unknown>(envelope: InvokeEnvelope): Promise<ReplyEnvelope<T>> =>
    ipcRenderer.invoke('pos:invoke', envelope),
  listRoutes: (): Promise<string[]> => ipcRenderer.invoke('pos:routes'),
  platform: process.platform,
  versions: process.versions,
};

try {
  contextBridge.exposeInMainWorld('pos', api);
} catch (err) {
  console.error('contextBridge failed', err);
}

export type PosApi = typeof api;
