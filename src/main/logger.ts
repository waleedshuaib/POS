import { join } from 'path';
import { mkdirSync, existsSync, appendFileSync, readdirSync, statSync, unlinkSync } from 'fs';

let userDataDir: string | null = null;
let cachedLogPath: string | null = null;
let cachedDate: string | null = null;

/** Provide the userData directory once at app startup. */
export function configureLogger(userData: string): void {
  userDataDir = userData;
  const dir = logsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  pruneOld(14);
  // Marker line so it's obvious where each app session begins inside the file.
  log('info', 'app.start', { node: process.versions.node, platform: process.platform });
}

export function logsDir(): string {
  if (!userDataDir) throw new Error('Logger not configured');
  return join(userDataDir, 'logs');
}

function todayFile(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC date is fine for daily rollover)
  if (date !== cachedDate) {
    cachedDate = date;
    cachedLogPath = join(logsDir(), `${date}.log`);
    pruneOld(14);
  }
  return cachedLogPath!;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Append a single structured line to today's log file.
 * Format: `<ISO timestamp> <LEVEL> <event> <json-payload>` — easy to grep.
 */
export function log(level: LogLevel, event: string, payload?: unknown): void {
  if (!userDataDir) {
    // Logger not yet configured; emit to console only.
    // eslint-disable-next-line no-console
    console.log(`[${level}] ${event}`, payload ?? '');
    return;
  }
  const ts = new Date().toISOString();
  const body = payload === undefined ? '' : ` ${safeStringify(payload)}`;
  const line = `${ts} ${level.toUpperCase().padEnd(5)} ${event}${body}\n`;
  try {
    appendFileSync(todayFile(), line, 'utf8');
  } catch {
    // Don't let logging crash the app.
  }
  if (level === 'error' || level === 'warn') {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'warn'](`[${level}] ${event}`, payload ?? '');
  }
}

function safeStringify(v: unknown): string {
  try {
    if (v instanceof Error) return JSON.stringify({ name: v.name, message: v.message, stack: v.stack });
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Keep only the last `keepDays` daily log files. */
function pruneOld(keepDays: number): void {
  if (!userDataDir) return;
  const dir = logsDir();
  if (!existsSync(dir)) return;
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.log')) continue;
    const full = join(dir, f);
    try {
      if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
    } catch {
      // ignore
    }
  }
}

/** Capture uncaught errors so they always end up in the file. */
export function attachProcessHandlers(): void {
  process.on('uncaughtException', (err) => log('error', 'uncaughtException', err));
  process.on('unhandledRejection', (reason) => log('error', 'unhandledRejection', reason as any));
}
