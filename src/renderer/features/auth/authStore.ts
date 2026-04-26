import { create } from 'zustand';
import { api, getToken, setToken } from '../../lib/api';

export type Role = 'admin' | 'manager' | 'cashier';

export interface AuthUser {
  userId: number;
  username: string;
  fullName: string;
  role: Role;
  expiresAt: number;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  login: async (username, password) => {
    const data = await api<AuthUser & { token: string }>('auth.login', { username, password });
    setToken(data.token);
    set({ user: data });
  },
  logout: async () => {
    try {
      await api('auth.logout', {});
    } catch {
      // ignore
    }
    setToken(null);
    set({ user: null });
  },
  refresh: async () => {
    set({ loading: true });
    const token = getToken();
    if (!token) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const me = await api<AuthUser>('auth.me', {});
      set({ user: me, loading: false });
    } catch {
      setToken(null);
      set({ user: null, loading: false });
    }
  },
}));

export function hasRole(user: AuthUser | null, ...roles: Role[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
