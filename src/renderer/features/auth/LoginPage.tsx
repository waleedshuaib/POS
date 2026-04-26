import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './authStore';
import i18n from '../../i18n';
import { Scale, User, Lock, LogIn, Loader2 } from 'lucide-react';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setErr(null);
    try {
      await login(username.trim(), password);
    } catch {
      setErr(t('auth.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-slate-50 to-brand-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg mb-4">
            <Scale size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{t('app.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('app.tagline')}</p>
        </div>

        <form onSubmit={onSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">{t('auth.username')}</label>
            <div className="relative">
              <User size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
              <input
                className="input ps-9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className="label">{t('auth.password')}</label>
            <div className="relative">
              <Lock size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
              <input
                type="password"
                className="input ps-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {err}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full text-base py-2.5"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <LogIn size={16} />
                {t('auth.signIn')}
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-3 pt-2 text-xs text-slate-500">
            <button
              type="button"
              className="hover:text-brand-600 hover:underline"
              onClick={() => i18n.changeLanguage('ar')}
            >
              العربية
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              className="hover:text-brand-600 hover:underline"
              onClick={() => i18n.changeLanguage('en')}
            >
              English
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">
          © {new Date().getFullYear()} POS · Offline-first retail
        </p>
      </div>
    </div>
  );
}
