import { randomBytes } from 'crypto';

export type Role = 'admin' | 'manager' | 'cashier';

export interface Session {
  token: string;
  userId: number;
  username: string;
  fullName: string;
  role: Role;
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 8 * 60 * 60 * 1000;
const store = new Map<string, Session>();

export function createSession(user: { id: number; username: string; fullName: string; role: Role }): Session {
  const token = randomBytes(24).toString('hex');
  const now = Date.now();
  const session: Session = {
    token,
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  store.set(token, session);
  return session;
}

export function getSession(token: string | null | undefined): Session | null {
  if (!token) return null;
  const s = store.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    store.delete(token);
    return null;
  }
  return s;
}

export function destroySession(token: string): void {
  store.delete(token);
}

export function touchSession(token: string): void {
  const s = store.get(token);
  if (s) s.expiresAt = Date.now() + TTL_MS;
}
