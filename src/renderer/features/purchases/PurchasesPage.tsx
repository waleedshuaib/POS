import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { Field, ServerError, ValidationSummary } from '../../components/Validation';
import { MoneyInput } from '../../components/NumberInput';
import { currency, dateTime } from '../../lib/format';
import { Plus, Trash2, ClipboardList } from 'lucide-react';

interface Supplier { id: number; name: string; }
interface Product { id: number; nameAr: string; nameEn: string; sku: string; cost: number; }
interface Purchase { id: number; supplierId: number; invoiceRef: string | null; total: number; paid: number; createdAt: number; }
interface Line { productId: number; qty: number | null; unitCost: number | null; }

export function PurchasesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [paid, setPaid] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api<Supplier[]>('suppliers.list', {}) });
  const products = useQuery({ queryKey: ['products.list'], queryFn: () => api<Product[]>('products.list', {}) });
  const list = useQuery({ queryKey: ['purchases'], queryFn: () => api<Purchase[]>('purchases.list', {}) });

  const total = useMemo(
    () =>
      Math.round(
        lines.reduce((s, l) => s + (l.qty ?? 0) * (l.unitCost ?? 0), 0) * 100,
      ) / 100,
    [lines],
  );

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (supplierId == null) e.supplier = t('common.required');
    if (lines.length === 0) e.lines = t('purchases.err.noLines');
    lines.forEach((l, i) => {
      if (!l.productId) e[`line-${i}-product`] = t('common.required');
      if (l.qty == null || l.qty <= 0) e[`line-${i}-qty`] = t('purchases.err.qtyPositive', { row: i + 1 });
      if (l.unitCost == null || l.unitCost < 0) e[`line-${i}-cost`] = t('purchases.err.costNonNeg', { row: i + 1 });
    });
    if (paid != null && paid < 0) e.paid = t('common.minValue', { n: 0 });
    if (paid != null && total > 0 && paid > total) e.paid = t('purchases.err.paidExceedsTotal');
    return e;
  }, [supplierId, lines, paid, total, t]);
  const errorList = Object.values(errors);

  const save = useMutation({
    mutationFn: () =>
      api('purchases.create', {
        supplierId: supplierId!,
        invoiceRef: invoiceRef || undefined,
        paid: paid ?? 0,
        items: lines
          .filter((l) => l.productId && (l.qty ?? 0) > 0)
          .map((l) => ({ productId: l.productId, qty: l.qty!, unitCost: l.unitCost ?? 0 })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      reset();
    },
  });

  function reset() {
    setAdding(false);
    setSupplierId(null);
    setInvoiceRef('');
    setPaid(null);
    setLines([]);
    setSubmitted(false);
  }

  function onSubmit() {
    setSubmitted(true);
    if (errorList.length > 0) return;
    save.mutate();
  }

  function setLineProduct(idx: number, pid: number) {
    const prod = products.data?.find((p) => p.id === pid);
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, productId: pid, unitCost: l.unitCost ?? prod?.cost ?? null } : l)),
    );
  }

  return (
    <div>
      <PageHeader
        title={t('purchases.title')}
        helpSlug="customers-suppliers"
        right={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> {t('purchases.add')}
          </button>
        }
      />
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start p-3">{t('common.date')}</th>
              <th className="text-start p-3">{t('purchases.supplier')}</th>
              <th className="text-start p-3">{t('purchases.invoiceRef')}</th>
              <th className="text-start p-3">{t('common.total')}</th>
              <th className="text-start p-3">{t('purchases.paid')}</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">{dateTime(p.createdAt)}</td>
                <td className="p-3 font-medium">{suppliers.data?.find((s) => s.id === p.supplierId)?.name ?? '-'}</td>
                <td className="p-3 font-mono text-xs">{p.invoiceRef ?? '-'}</td>
                <td className="p-3 font-semibold">{currency(p.total)}</td>
                <td className={`p-3 ${p.paid < p.total ? 'text-orange-600' : ''}`}>{currency(p.paid)}</td>
              </tr>
            ))}
            {(list.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={adding}
        onClose={reset}
        title={t('purchases.add')}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={reset}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={save.isPending} onClick={onSubmit}>
              <ClipboardList size={16} /> {t('common.save')}
            </button>
          </>
        }
      >
        {submitted && <ValidationSummary errors={errorList} />}
        <ServerError error={save.error} />

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('purchases.supplier')} required error={submitted ? errors.supplier : undefined}>
              <select
                className="input"
                value={supplierId ?? ''}
                onChange={(e) => setSupplierId(e.target.value ? parseInt(e.target.value, 10) : null)}
              >
                <option value="">—</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('purchases.invoiceRef')}>
              <input className="input" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
            </Field>
            <Field label={t('purchases.paid')} error={submitted ? errors.paid : undefined}>
              <MoneyInput value={paid} onChange={setPaid} min={0} suffix="₪" />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">{t('common.actions')}</div>
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start">
                <Field label="" error={submitted ? errors[`line-${idx}-product`] : undefined}>
                  <select
                    className="input"
                    value={l.productId || ''}
                    onChange={(e) => setLineProduct(idx, parseInt(e.target.value, 10) || 0)}
                  >
                    <option value="">—</option>
                    {(products.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {lang === 'ar' ? p.nameAr : p.nameEn}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="" error={submitted ? errors[`line-${idx}-qty`] : undefined}>
                  <MoneyInput
                    value={l.qty}
                    onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: v } : x)))}
                    min={0.01}
                    placeholder={t('common.qty')}
                  />
                </Field>
                <Field label="" error={submitted ? errors[`line-${idx}-cost`] : undefined}>
                  <MoneyInput
                    value={l.unitCost}
                    onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unitCost: v } : x)))}
                    min={0}
                    suffix="₪"
                    placeholder={t('purchases.unitCost')}
                  />
                </Field>
                <button
                  className="btn-secondary p-2 mt-1"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              className="btn-secondary"
              onClick={() => setLines([...lines, { productId: 0, qty: null, unitCost: null }])}
            >
              <Plus size={14} /> {t('common.add')}
            </button>
          </div>

          <div className="text-end font-semibold border-t border-slate-200 pt-3">
            {t('common.total')}: <span className="text-brand-700">{currency(total)}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
