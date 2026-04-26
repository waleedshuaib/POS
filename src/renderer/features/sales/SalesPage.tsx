import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { currency, dateTime } from '../../lib/format';

interface Sale {
  id: number;
  invoiceNo: string;
  grandTotal: number;
  taxTotal: number;
  discountTotal: number;
  status: 'completed' | 'held' | 'voided' | 'returned';
  createdAt: number;
  customerId: number | null;
}
interface SaleItem {
  id: number;
  productId: number;
  nameAtSale: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}
interface SaleDetail extends Sale {
  items: SaleItem[];
  payments: Array<{ method: string; amount: number }>;
}

export function SalesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<SaleDetail | null>(null);
  const [returnMode, setReturnMode] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState('');

  const list = useQuery({ queryKey: ['sales'], queryFn: () => api<Sale[]>('sales.list', {}) });

  const open = useMutation({
    mutationFn: (id: number) => api<SaleDetail>('sales.get', { id }),
    onSuccess: (data) => {
      setSelected(data);
      setReturnMode(false);
      setReturnQty({});
      setReturnReason('');
    },
  });

  const voidSale = useMutation({
    mutationFn: (id: number) => api('sales.void', { id }),
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });

  const processReturn = useMutation({
    mutationFn: () => {
      const items = Object.entries(returnQty)
        .filter(([, qty]) => qty > 0)
        .map(([saleItemId, qty]) => ({ saleItemId: parseInt(saleItemId, 10), qty }));
      return api('returns.create', { saleId: selected!.id, reason: returnReason, items });
    },
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });

  async function reprint() {
    if (!selected) return;
    await api('printer.printNow', { saleId: selected.id, language: i18n.language === 'ar' ? 'ar' : 'en' });
  }

  return (
    <div>
      <PageHeader title={t('sales.title')} helpSlug="sales-checkout" />
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start p-3">{t('sales.invoice')}</th>
              <th className="text-start p-3">{t('common.date')}</th>
              <th className="text-start p-3">{t('common.total')}</th>
              <th className="text-start p-3">{t('common.status')}</th>
              <th className="text-start p-3">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-3 font-mono">{s.invoiceNo}</td>
                <td className="p-3">{dateTime(s.createdAt)}</td>
                <td className="p-3">{currency(s.grandTotal)}</td>
                <td className="p-3">{t(`sales.status.${s.status}`)}</td>
                <td className="p-3">
                  <button className="btn-secondary" onClick={() => open.mutate(s.id)}>
                    {t('common.view')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.invoiceNo ?? ''}
        size="lg"
        footer={
          selected && (
            <>
              <button className="btn-secondary" onClick={() => setSelected(null)}>
                {t('common.close')}
              </button>
              {!returnMode && selected.status === 'completed' && (
                <>
                  <button className="btn-secondary" onClick={reprint}>
                    {t('sales.reprint')}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setReturnMode(true);
                      setReturnQty({});
                    }}
                  >
                    {t('sales.return')}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => confirm(t('common.confirm') + '?') && voidSale.mutate(selected.id)}
                  >
                    {t('sales.void')}
                  </button>
                </>
              )}
              {returnMode && (
                <button
                  className="btn-primary"
                  disabled={!Object.values(returnQty).some((q) => q > 0) || processReturn.isPending}
                  onClick={() => processReturn.mutate()}
                >
                  {t('common.save')}
                </button>
              )}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              {dateTime(selected.createdAt)} — {t(`sales.status.${selected.status}`)}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-start py-2">{t('common.name')}</th>
                  <th className="text-start py-2">{t('common.qty')}</th>
                  <th className="text-start py-2">{t('common.price')}</th>
                  <th className="text-start py-2">{t('common.total')}</th>
                  {returnMode && <th className="text-start py-2">{t('sales.return')}</th>}
                </tr>
              </thead>
              <tbody>
                {selected.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2">{it.nameAtSale}</td>
                    <td className="py-2">{it.qty}</td>
                    <td className="py-2">{currency(it.unitPrice)}</td>
                    <td className="py-2">{currency(it.lineTotal)}</td>
                    {returnMode && (
                      <td className="py-2">
                        <input
                          className="input w-20"
                          type="number"
                          min={0}
                          max={it.qty}
                          step="0.01"
                          value={returnQty[it.id] ?? 0}
                          onChange={(e) =>
                            setReturnQty({
                              ...returnQty,
                              [it.id]: Math.max(0, Math.min(it.qty, parseFloat(e.target.value) || 0)),
                            })
                          }
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {returnMode && (
              <div>
                <label className="label">{t('common.notes')}</label>
                <input className="input" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>{t('common.total')}</span>
              <span>{currency(selected.grandTotal)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
