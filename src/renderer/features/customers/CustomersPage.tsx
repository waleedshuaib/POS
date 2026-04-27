import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { Field, ServerError, ValidationSummary } from '../../components/Validation';
import { MoneyInput } from '../../components/NumberInput';
import { currency } from '../../lib/format';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  address: string | null;
  balance: number;
}

function validate(c: Partial<Customer>, t: (k: string, o?: any) => string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!c.name?.trim() || c.name.trim().length < 2) e.name = t('common.minLength', { n: 2 });
  if (c.email && c.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))
    e.email = t('common.invalid');
  return e;
}

export function CustomersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [paySubmitted, setPaySubmitted] = useState(false);

  const list = useQuery({ queryKey: ['customers'], queryFn: () => api<Customer[]>('customers.list', {}) });

  const errors = useMemo(() => (editing ? validate(editing, t) : {}), [editing, t]);
  const errorList = Object.values(errors);

  const save = useMutation({
    mutationFn: (c: Partial<Customer>) => (c.id ? api('customers.update', c) : api('customers.create', c)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setEditing(null);
      setSubmitted(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api('customers.remove', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const pay = useMutation({
    mutationFn: (i: { id: number; amount: number }) => api('customers.payCredit', i),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setPayingId(null);
      setPayAmount(null);
      setPaySubmitted(false);
    },
  });

  const payErrors: string[] = [];
  if (paySubmitted && (payAmount === null || payAmount <= 0)) payErrors.push(t('common.minValue', { n: 0.01 }));

  function show(field: string): string | undefined {
    return submitted ? errors[field] : undefined;
  }

  function onSubmit() {
    setSubmitted(true);
    if (errorList.length > 0 || !editing) return;
    save.mutate(editing);
  }

  function onPaySubmit() {
    setPaySubmitted(true);
    if (payAmount === null || payAmount <= 0 || payingId == null) return;
    pay.mutate({ id: payingId, amount: payAmount });
  }

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        helpSlug="customers-suppliers"
        right={
          <button className="btn-primary" onClick={() => { setEditing({}); setSubmitted(false); }}>
            <Plus size={16} /> {t('customers.add')}
          </button>
        }
      />
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start p-3">{t('common.name')}</th>
              <th className="text-start p-3">{t('common.phone')}</th>
              <th className="text-start p-3">{t('customers.balance')}</th>
              <th className="text-start p-3">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 font-mono text-xs">{c.phone ?? '-'}</td>
                <td className={`p-3 ${c.balance > 0 ? 'text-orange-600 font-semibold' : 'text-slate-500'}`}>
                  {currency(c.balance)}
                </td>
                <td className="p-3 flex gap-2 flex-wrap">
                  <button className="btn-secondary p-1.5" onClick={() => { setEditing(c); setSubmitted(false); }} title={t('common.edit')}>
                    <Pencil size={14} />
                  </button>
                  {c.balance > 0 && (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setPayingId(c.id);
                        setPayAmount(c.balance);
                        setPaySubmitted(false);
                      }}
                    >
                      <CreditCard size={14} /> {t('customers.payCredit')}
                    </button>
                  )}
                  <button
                    className="btn-danger p-1.5"
                    onClick={() => confirm(t('common.confirmDelete')) && remove.mutate(c.id)}
                    title={t('common.delete')}
                    disabled={c.balance !== 0}
                  >
                    <Trash2 size={14} />
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
        title={editing?.id ? t('common.edit') : t('customers.add')}
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

      <Modal
        open={payingId !== null}
        onClose={() => { setPayingId(null); setPaySubmitted(false); }}
        title={t('customers.payCredit')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setPayingId(null); setPaySubmitted(false); }}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={pay.isPending} onClick={onPaySubmit}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {paySubmitted && <ValidationSummary errors={payErrors} />}
        <ServerError error={pay.error} />
        <Field label={t('pos.amount')} required error={paySubmitted && (payAmount === null || payAmount <= 0) ? t('common.minValue', { n: 0.01 }) : undefined}>
          <MoneyInput value={payAmount} onChange={setPayAmount} min={0.01} suffix="₪" />
        </Field>
      </Modal>
    </div>
  );
}
