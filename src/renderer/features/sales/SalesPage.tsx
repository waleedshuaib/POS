import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth, hasRole } from '../auth/authStore';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { currency, dateTime } from '../../lib/format';
import { Filter, RotateCw } from 'lucide-react';

interface Sale {
  id: number;
  invoiceNo: string;
  grandTotal: number;
  taxTotal: number;
  discountTotal: number;
  status: 'completed' | 'held' | 'voided' | 'returned';
  createdAt: number;
  customerId: number | null;
  userId: number;
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
  payments: Array<{ method: string; amount: number; reference: string | null }>;
}

interface UserRow { id: number; username: string; fullName: string; }

export function SalesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManager = hasRole(user, 'admin', 'manager');
  const [selected, setSelected] = useState<SaleDetail | null>(null);
  const [returnMode, setReturnMode] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState('');

  // ── Filters ─────────────────────────────────────────────────────────────
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'' | Sale['status']>('');
  const [filterUserId, setFilterUserId] = useState<number | ''>('');

  const filterPayload = useMemo(() => {
    const p: Record<string, unknown> = {};
    if (from) p.from = new Date(from).toISOString();
    if (to) p.to = new Date(to).toISOString();
    if (status) p.status = status;
    if (filterUserId !== '') p.userId = filterUserId;
    return p;
  }, [from, to, status, filterUserId]);

  const list = useQuery({
    queryKey: ['sales', filterPayload],
    queryFn: () => api<Sale[]>('sales.list', filterPayload),
  });

  // Cashier list for the manager filter dropdown.
  const usersForFilter = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('users.list', {}),
    enabled: isManager,
  });

  function resetFilters() {
    setFrom(''); setTo(''); setStatus(''); setFilterUserId('');
  }

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

      {/* Filters */}
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label flex items-center gap-1"><Filter size={12} /> {t('common.from')}</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('common.to')}</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('common.status')}</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="">{t('common.all')}</option>
            <option value="completed">{t('sales.status.completed')}</option>
            <option value="held">{t('sales.status.held')}</option>
            <option value="voided">{t('sales.status.voided')}</option>
            <option value="returned">{t('sales.status.returned')}</option>
          </select>
        </div>
        {isManager && (
          <div>
            <label className="label">{t('users.title')}</label>
            <select
              className="input"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            >
              <option value="">{t('common.all')}</option>
              {(usersForFilter.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
        )}
        <button className="btn-secondary" onClick={resetFilters}>
          <RotateCw size={14} /> {t('common.reset')}
        </button>
        <div className="ms-auto text-sm text-slate-500">
          {(list.data ?? []).length} {t('sales.results')}
        </div>
      </div>
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
