import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { Field, ServerError, ValidationSummary } from '../../components/Validation';
import { MoneyInput } from '../../components/NumberInput';
import { currency } from '../../lib/format';
import { AlertTriangle, Boxes } from 'lucide-react';

interface StockLine {
  productId: number;
  sku: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string;
  qtyOnHand: number;
  lowStockThreshold: number;
  cost: number;
  price: number;
}

export function InventoryPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const qc = useQueryClient();
  const [adjusting, setAdjusting] = useState<StockLine | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const list = useQuery({ queryKey: ['inventory'], queryFn: () => api<StockLine[]>('inventory.list', {}) });

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (delta === null || !isFinite(delta) || delta === 0) e.delta = t('inventory.err.deltaNonzero');
    else if (adjusting && delta < 0 && Math.abs(delta) > adjusting.qtyOnHand)
      e.delta = t('inventory.err.notEnoughStock', { available: adjusting.qtyOnHand });
    return e;
  }, [delta, adjusting, t]);
  const errorList = Object.values(errors);

  const adjust = useMutation({
    mutationFn: (input: { productId: number; delta: number; note: string }) =>
      api('inventory.adjust', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setAdjusting(null);
      setDelta(null);
      setNote('');
      setSubmitted(false);
    },
  });

  function onSubmit() {
    setSubmitted(true);
    if (errorList.length > 0 || !adjusting || delta === null) return;
    adjust.mutate({ productId: adjusting.productId, delta, note });
  }

  return (
    <div>
      <PageHeader title={t('inventory.title')} helpSlug="products-inventory" />
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start p-3">{t('common.sku')}</th>
              <th className="text-start p-3">{t('common.name')}</th>
              <th className="text-start p-3">{t('inventory.onHand')}</th>
              <th className="text-start p-3">{t('inventory.threshold')}</th>
              <th className="text-start p-3">{t('common.cost')}</th>
              <th className="text-start p-3">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((p) => {
              const low = p.qtyOnHand <= p.lowStockThreshold;
              return (
                <tr key={p.productId} className={`border-t border-slate-100 ${low ? 'bg-red-50' : ''}`}>
                  <td className="p-3 font-mono text-xs">{p.sku}</td>
                  <td className="p-3 font-medium">{lang === 'ar' ? p.nameAr : p.nameEn}</td>
                  <td className={`p-3 font-semibold ${low ? 'text-red-600' : ''}`}>
                    <span className="inline-flex items-center gap-1">
                      {low && <AlertTriangle size={12} />} {p.qtyOnHand}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{p.lowStockThreshold}</td>
                  <td className="p-3">{currency(p.cost)}</td>
                  <td className="p-3">
                    <button
                      className="btn-secondary"
                      onClick={() => { setAdjusting(p); setDelta(0); setNote(''); setSubmitted(false); }}
                    >
                      <Boxes size={14} /> {t('inventory.adjust')}
                    </button>
                  </td>
                </tr>
              );
            })}
            {(list.data ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">—</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!adjusting}
        onClose={() => { setAdjusting(null); setSubmitted(false); }}
        title={t('inventory.adjustTitle')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setAdjusting(null); setSubmitted(false); }}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={adjust.isPending} onClick={onSubmit}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {adjusting && (
          <>
            {submitted && <ValidationSummary errors={errorList} />}
            <ServerError error={adjust.error} />
            <div className="space-y-3">
              <div className="text-sm bg-slate-50 rounded-md p-3 border border-slate-200">
                <div className="font-medium">{lang === 'ar' ? adjusting.nameAr : adjusting.nameEn}</div>
                <div className="text-slate-500 mt-1">
                  {t('inventory.onHand')}: <span className="font-semibold">{adjusting.qtyOnHand}</span>
                </div>
              </div>
              <Field label={t('inventory.delta')} required hint={t('inventory.deltaHint')} error={submitted ? errors.delta : undefined}>
                <MoneyInput value={delta} onChange={setDelta} />
              </Field>
              <Field label={t('inventory.note')}>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
