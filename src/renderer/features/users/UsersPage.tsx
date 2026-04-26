import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../../lib/api';
import { useAuth, type AuthUser } from '../auth/authStore';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { Field, ServerError, ValidationSummary } from '../../components/Validation';
import { Plus, Pencil, KeyRound, Shield, ShieldCheck, UserCheck } from 'lucide-react';
import type { Role } from '../auth/authStore';

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
}

type Draft = Partial<UserRow> & { password?: string; newPassword?: string };

function validate(u: Draft, t: (k: string, o?: any) => string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!u.id && (!u.username?.trim() || u.username.trim().length < 2))
    e.username = t('common.minLength', { n: 2 });
  if (!u.fullName?.trim()) e.fullName = t('common.required');
  if (!u.id && (!u.password || u.password.length < 4)) e.password = t('common.minLength', { n: 4 });
  if (u.id && u.newPassword !== undefined && u.newPassword !== '' && u.newPassword.length < 4)
    e.newPassword = t('common.minLength', { n: 4 });
  return e;
}

export function UsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const auth = useAuth();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [impersonating, setImpersonating] = useState<UserRow | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [impSubmitted, setImpSubmitted] = useState(false);

  const list = useQuery({ queryKey: ['users'], queryFn: () => api<UserRow[]>('users.list', {}) });
  const errors = useMemo(() => (editing ? validate(editing, t) : {}), [editing, t]);
  const errorList = Object.values(errors);

  const save = useMutation({
    mutationFn: (u: Draft) =>
      u.id
        ? api('users.update', u)
        : api('users.create', {
            username: u.username,
            fullName: u.fullName,
            role: u.role,
            password: u.password,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
      setSubmitted(false);
    },
  });

  const impersonate = useMutation({
    mutationFn: () =>
      api<AuthUser & { token: string }>('auth.impersonate', {
        targetUserId: impersonating!.id,
        adminPassword,
      }),
    onSuccess: (data) => {
      setToken(data.token);
      auth.refresh();
      setImpersonating(null);
      setAdminPassword('');
      setImpSubmitted(false);
      qc.clear();
      navigate('/dashboard');
    },
  });

  function show(field: string): string | undefined {
    return submitted ? errors[field] : undefined;
  }

  function onSubmit() {
    setSubmitted(true);
    if (errorList.length > 0 || !editing) return;
    save.mutate(editing);
  }

  return (
    <div>
      <PageHeader
        title={t('users.title')}
        helpSlug="users-roles"
        right={
          <button
            className="btn-primary"
            onClick={() => { setEditing({ role: 'cashier', active: true }); setSubmitted(false); }}
          >
            <Plus size={16} /> {t('users.add')}
          </button>
        }
      />

      <div className="card p-3 mb-3 text-sm bg-blue-50 border-blue-200 text-blue-900 flex items-start gap-2">
        <Shield size={16} className="mt-0.5 flex-shrink-0" />
        <div>{t('users.passwordsHashedNotice')}</div>
      </div>

      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start p-3">{t('auth.username')}</th>
              <th className="text-start p-3">{t('common.name')}</th>
              <th className="text-start p-3">{t('users.role')}</th>
              <th className="text-start p-3">{t('users.active')}</th>
              <th className="text-start p-3">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-mono text-xs">{u.username}</td>
                <td className="p-3 font-medium">{u.fullName}</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100">
                    {u.role === 'admin' && <ShieldCheck size={12} />}
                    {t(`users.role.${u.role}`)}
                  </span>
                </td>
                <td className="p-3">{u.active ? '✓' : '✗'}</td>
                <td className="p-3 flex gap-1 flex-wrap">
                  <button
                    className="btn-secondary"
                    onClick={() => { setEditing(u); setSubmitted(false); }}
                    title={t('common.edit')}
                  >
                    <Pencil size={14} /> {t('common.edit')}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => { setEditing({ ...u, newPassword: '' }); setSubmitted(false); }}
                    title={t('users.resetPassword')}
                  >
                    <KeyRound size={14} /> {t('users.resetPassword')}
                  </button>
                  {u.active && u.id !== auth.user?.userId && (
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setImpersonating(u);
                        setAdminPassword('');
                        setImpSubmitted(false);
                      }}
                      title={t('users.loginAs')}
                    >
                      <UserCheck size={14} /> {t('users.loginAs')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setSubmitted(false); }}
        title={editing?.id ? t('common.edit') : t('users.add')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setEditing(null); setSubmitted(false); }}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={save.isPending} onClick={onSubmit}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {editing && (
          <>
            {submitted && <ValidationSummary errors={errorList} />}
            <ServerError error={save.error} />
            <div className="space-y-3">
              {!editing.id && (
                <Field label={t('auth.username')} required error={show('username')}>
                  <input className="input" value={editing.username ?? ''} onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
                </Field>
              )}
              <Field label={t('common.name')} required error={show('fullName')}>
                <input className="input" value={editing.fullName ?? ''} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />
              </Field>
              <Field label={t('users.role')}>
                <select
                  className="input"
                  value={editing.role ?? 'cashier'}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}
                >
                  <option value="admin">{t('users.role.admin')}</option>
                  <option value="manager">{t('users.role.manager')}</option>
                  <option value="cashier">{t('users.role.cashier')}</option>
                </select>
              </Field>
              <Field
                label={editing.id ? t('users.resetPassword') : t('auth.password')}
                required={!editing.id}
                hint={editing.id ? t('users.leaveBlankToKeep') : undefined}
                error={show(editing.id ? 'newPassword' : 'password')}
              >
                <input
                  className="input"
                  type="password"
                  value={(editing.id ? editing.newPassword : editing.password) ?? ''}
                  onChange={(e) =>
                    setEditing(editing.id ? { ...editing, newPassword: e.target.value } : { ...editing, password: e.target.value })
                  }
                />
              </Field>
              {editing.id && (
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editing.active ?? true}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />
                  {t('users.active')}
                </label>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Impersonation modal */}
      <Modal
        open={!!impersonating}
        onClose={() => { setImpersonating(null); setAdminPassword(''); setImpSubmitted(false); }}
        title={t('users.loginAs')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setImpersonating(null); setAdminPassword(''); setImpSubmitted(false); }}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary"
              disabled={impersonate.isPending || !adminPassword}
              onClick={() => { setImpSubmitted(true); if (adminPassword) impersonate.mutate(); }}
            >
              <UserCheck size={14} /> {t('users.proceed')}
            </button>
          </>
        }
      >
        {impersonating && (
          <div className="space-y-3">
            <div className="text-sm bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="font-medium">{t('users.loginAsConfirm', { name: impersonating.fullName })}</div>
              <div className="text-xs text-slate-600 mt-1">{t('users.loginAsExplain')}</div>
            </div>
            {impSubmitted && !adminPassword && <ValidationSummary errors={[t('common.required')]} />}
            <ServerError error={impersonate.error} />
            <Field label={t('users.yourAdminPassword')} required error={impSubmitted && !adminPassword ? t('common.required') : undefined}>
              <input
                className="input"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoFocus
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
