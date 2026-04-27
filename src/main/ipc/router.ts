import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { getSession, touchSession, type Session } from '../auth/session';
import type { Role } from '@shared/types';
import { log } from '../logger';

export interface RouteContext {
  session: Session | null;
  token: string | null;
}

export type Handler<I, O> = (input: I, ctx: RouteContext) => Promise<O> | O;

export interface RouteDef<I = any, O = any> {
  input: z.ZodType<I>;
  roles?: Role[] | 'public';
  handler: Handler<I, O>;
}

export type RouterMap = Record<string, RouteDef>;

export class IpcError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export interface InvokeEnvelope {
  action: string;
  input: unknown;
  token?: string | null;
}

export interface OkEnvelope<T> {
  ok: true;
  data: T;
}
export interface ErrEnvelope {
  ok: false;
  code: string;
  message: string;
}
export type ReplyEnvelope<T = unknown> = OkEnvelope<T> | ErrEnvelope;

export function defineRoute<I, O>(def: RouteDef<I, O>): RouteDef<I, O> {
  return def;
}

const routes: RouterMap = {};

export function registerRoutes(partial: RouterMap): void {
  for (const [key, def] of Object.entries(partial)) {
    if (routes[key]) throw new Error(`Route already registered: ${key}`);
    routes[key] = def;
  }
}

export function listRoutes(): string[] {
  return Object.keys(routes).sort();
}

async function dispatch(envelope: InvokeEnvelope): Promise<ReplyEnvelope> {
  const started = Date.now();
  const route = routes[envelope.action];
  if (!route) {
    log('warn', 'ipc.unknown', { action: envelope.action });
    return { ok: false, code: 'NOT_FOUND', message: `Unknown action: ${envelope.action}` };
  }

  const session = getSession(envelope.token ?? null);
  if (session) touchSession(session.token);

  const allowed = route.roles ?? ['admin', 'manager', 'cashier'];
  if (allowed !== 'public') {
    if (!session) {
      log('warn', 'ipc.unauthenticated', { action: envelope.action });
      return { ok: false, code: 'UNAUTHENTICATED', message: 'Login required' };
    }
    if (!allowed.includes(session.role)) {
      log('warn', 'ipc.forbidden', { action: envelope.action, role: session.role });
      return { ok: false, code: 'FORBIDDEN', message: 'Insufficient permissions' };
    }
  }

  const parsed = route.input.safeParse(envelope.input);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    log('warn', 'ipc.validation', { action: envelope.action, message });
    return { ok: false, code: 'VALIDATION', message };
  }

  try {
    const data = await route.handler(parsed.data, { session, token: envelope.token ?? null });
    const ms = Date.now() - started;
    if (ms > 200) log('warn', 'ipc.slow', { action: envelope.action, ms, user: session?.username });
    else log('debug', 'ipc.ok', { action: envelope.action, ms, user: session?.username });
    return { ok: true, data };
  } catch (err) {
    const ms = Date.now() - started;
    if (err instanceof IpcError) {
      log('warn', 'ipc.appError', { action: envelope.action, ms, code: err.code, message: err.message });
      return { ok: false, code: err.code, message: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    log('error', 'ipc.error', { action: envelope.action, ms, message, stack: err instanceof Error ? err.stack : undefined });
    return { ok: false, code: 'INTERNAL', message };
  }
}

export function registerIpc(ipcMain: IpcMain): void {
  ipcMain.handle('pos:invoke', async (_event: IpcMainInvokeEvent, envelope: InvokeEnvelope) => {
    return dispatch(envelope);
  });
  ipcMain.handle('pos:routes', () => listRoutes());
}
