export interface InvokeEnvelope {
  action: string;
  input: unknown;
  token?: string | null;
}
export type ReplyEnvelope<T = unknown> = { ok: true; data: T } | { ok: false; code: string; message: string };

declare global {
  interface Window {
    pos: {
      invoke: <T = unknown>(envelope: InvokeEnvelope) => Promise<ReplyEnvelope<T>>;
      listRoutes: () => Promise<string[]>;
      platform: string;
      versions: Record<string, string | undefined>;
    };
  }
}

const TOKEN_KEY = 'pos.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(action: string, input: unknown = {}): Promise<T> {
  const reply = await window.pos.invoke<T>({ action, input, token: getToken() });
  if (!reply.ok) {
    const err = new Error(reply.message) as Error & { code?: string };
    err.code = reply.code;
    throw err;
  }
  return reply.data;
}
