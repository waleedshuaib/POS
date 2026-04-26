import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { Field, ServerError, ValidationSummary } from '../../components/Validation';
import { currency } from '../../lib/format';
import { Plus, Pencil } from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  address: string | null;
  balance: number;
}

function validate(s: Partial<Supplier>, t: (k: string, o?: any) => string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s.name?.trim() || s.name.trim().length < 2) e.name = t('common.minLength', { n: 2 });
  if (s.email && s.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
    e.email = t('common.invalid');
  return e;
}

export function SuppliersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const list = useQuery({ queryKey: ['suppliers'], queryFn: () => api<Supplier[]>('suppliers.list', {}) });
  const errors = useMemo(() => (editing ? validate(editing, t) : {}), [editing, t]);
  const errorList = Object.values(errors);

  const save = useMutation({
    mutationFn: (s: Partial<Supplier>) => (s.id ? api('suppliers.update', s) : api('suppliers.create', s)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setEditing(null);
      setSubmitted(false);
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
        title={t('suppliers.title')}
        helpSlug="customers-suppliers"
        right={
          <button className="btn-primary" onClick={() => { setEditing({}); setSubmitted(false); }}>
            <Plus size={16} /> {t('suppliers.add')}
          </button>
        }
      />
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start p-3">{t('common.name')}</th>
              <th className="text-start p-3">{t('common.phone')}</th>
              <th className="text-start p-3">{t('common.balance')}</th>
              <th className="text-start p-3">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 font-mono text-xs">{s.phone ?? '-'}</td>
                <td className={`p-3 ${s.balance > 0 ? 'text-orange-600 font-semibold' : 'text-slate-500'}`}>
                  {currency(s.balance)}
                </td>
                <td className="p-3">
                  <button className="btn-secondary p-1.5" onClick={() => { setEditing(s); setSubmitted(false); }} title={t('common.edit')}>
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {(list.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setSubmitted(false); }}
        title={editing?.id ? t('common.edit') : t('suppliers.add')}
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
              <Field label={t('common.name')} required error={show('name')}>
                <input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label={t('common.phone')}>
                <input className="input" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </Field>
              <Field label={t('common.email')} error={show('email')}>
                <input className="input" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </Field>
              <Field label={t('common.address')}>
                <input className="input" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              </Field>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
