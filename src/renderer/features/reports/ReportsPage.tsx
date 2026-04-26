import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { currency, dateOnly } from '../../lib/format';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { RefreshCw, Download, Inbox } from 'lucide-react';

type Tab = 'daily' | 'top' | 'pl' | 'payments' | 'cashiers' | 'valuation' | 'low';

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('daily');
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 30);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const range = { from: new Date(from).toISOString(), to: new Date(to).toISOString() };

  function refresh() {
    qc.invalidateQueries({ queryKey: ['reports'] });
  }

  const daily = useQuery({
    queryKey: ['reports', 'salesByDay', from, to],
    queryFn: () => api<Array<{ day: string; total: number; count: number }>>('reports.salesByDay', range),
    enabled: tab === 'daily',
  });
  const top = useQuery({
    queryKey: ['reports', 'topProducts', from, to],
    queryFn: () => api<Array<{ name: string; qty: number; revenue: number }>>('reports.topProducts', { ...range, limit: 20 }),
    enabled: tab === 'top',
  });
  const pl = useQuery({
    queryKey: ['reports', 'profitLoss', from, to],
    queryFn: () => api<{ revenue: number; cogs: number; grossProfit: number }>('reports.profitLoss', range),
    enabled: tab === 'pl',
  });
  const payments = useQuery({
    queryKey: ['reports', 'paymentsByMethod', from, to],
    queryFn: () => api<Array<{ method: string; total: number }>>('reports.paymentsByMethod', range),
    enabled: tab === 'payments',
  });
  const cashiers = useQuery({
    queryKey: ['reports', 'salesByCashier', from, to],
    queryFn: () => api<Array<{ username: string; count: number; total: number }>>('reports.salesByCashier', range),
    enabled: tab === 'cashiers',
  });
  const val = useQuery({
    queryKey: ['reports', 'inventoryValuation'],
    queryFn: () => api<Array<{ sku: string; nameAr: string; qty: number; cost: number; value: number }>>('reports.inventoryValuation', {}),
    enabled: tab === 'valuation',
  });
  const low = useQuery({
    queryKey: ['reports', 'lowStock'],
    queryFn: () => api<Array<{ nameAr: string; nameEn: string; qty: number; threshold: number }>>('reports.lowStock', {}),
    enabled: tab === 'low',
  });

  function exportCsv(rows: any[], filename: string) {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'daily', label: t('reports.salesByDay') },
    { key: 'top', label: t('reports.topProducts') },
    { key: 'pl', label: t('reports.profitLoss') },
    { key: 'payments', label: t('reports.paymentsByMethod') },
    { key: 'cashiers', label: t('reports.salesByCashier') },
    { key: 'valuation', label: t('reports.inventoryValuation') },
    { key: 'low', label: t('reports.lowStock') },
  ];

  return (
    <div>
      <PageHeader
        title={t('reports.title')}
        helpSlug="reports"
        right={
          <button className="btn-secondary" onClick={refresh}>
            <RefreshCw size={14} /> {t('reports.refresh')}
          </button>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div>
          <label className="label">{t('common.from')}</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('common.to')}</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={refresh}>
          <RefreshCw size={14} /> {t('reports.generate')}
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            className={`px-4 py-2 text-sm ${tab === tb.key ? 'border-b-2 border-brand-600 font-semibold' : 'text-slate-500'}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <div className="card p-4">
          {daily.isFetching ? (
            <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
          ) : (daily.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Inbox size={32} className="mx-auto mb-2 opacity-50" />
              <div>{t('reports.noData')}</div>
            </div>
          ) : (
            <>
              <div className="h-72 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily.data ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full text-sm border-t border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-start p-2">{t('common.date')}</th>
                    <th className="text-start p-2">{t('dashboard.todayCount')}</th>
                    <th className="text-start p-2">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(daily.data ?? []).map((d) => (
                    <tr key={d.day} className="border-t border-slate-100">
                      <td className="p-2 font-mono">{d.day}</td>
                      <td className="p-2">{d.count}</td>
                      <td className="p-2 font-medium">{currency(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <button className="btn-secondary mt-3" onClick={() => exportCsv(daily.data ?? [], 'sales-by-day.csv')}>
            <Download size={14} /> {t('reports.exportCsv')}
          </button>
        </div>
      )}

      {tab === 'top' && (
        <div className="card p-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-start p-2">{t('common.name')}</th>
                <th className="text-start p-2">{t('common.qty')}</th>
                <th className="text-start p-2">{t('reports.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {(top.data ?? []).map((p, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{p.qty}</td>
                  <td className="p-2">{currency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn-secondary mt-3" onClick={() => exportCsv(top.data ?? [], 'top-products.csv')}>
            {t('reports.exportCsv')}
          </button>
        </div>
      )}

      {tab === 'pl' && pl.data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="text-sm text-slate-500">{t('reports.revenue')}</div>
            <div className="text-2xl font-bold">{currency(pl.data.revenue)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">{t('reports.cogs')}</div>
            <div className="text-2xl font-bold">{currency(pl.data.cogs)}</div>
          </div>
          <div className="card p-5 bg-green-50">
            <div className="text-sm text-green-700">{t('reports.grossProfit')}</div>
            <div className="text-2xl font-bold text-green-800">{currency(pl.data.grossProfit)}</div>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card p-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-start p-2">{t('pos.paymentMethod')}</th>
                <th className="text-start p-2">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {(payments.data ?? []).map((p, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{t(`payment.${p.method}`)}</td>
                  <td className="p-2">{currency(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cashiers' && (
        <div className="card p-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-start p-2">{t('users.title')}</th>
                <th className="text-start p-2">{t('dashboard.todayCount')}</th>
                <th className="text-start p-2">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {(cashiers.data ?? []).map((c, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{c.username}</td>
                  <td className="p-2">{c.count}</td>
                  <td className="p-2">{currency(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'valuation' && (
        <div className="card p-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-start p-2">{t('common.sku')}</th>
                <th className="text-start p-2">{t('common.name')}</th>
                <th className="text-start p-2">{t('common.qty')}</th>
                <th className="text-start p-2">{t('common.cost')}</th>
                <th className="text-start p-2">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {(val.data ?? []).map((p, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{p.sku}</td>
                  <td className="p-2">{p.nameAr}</td>
                  <td className="p-2">{p.qty}</td>
                  <td className="p-2">{currency(p.cost)}</td>
                  <td className="p-2">{currency(p.value)}</td>
                </tr>
              ))}
              <tr className="border-t font-bold bg-slate-50">
                <td className="p-2" colSpan={4}>{t('common.total')}</td>
                <td className="p-2">{currency((val.data ?? []).reduce((s, p) => s + p.value, 0))}</td>
              </tr>
            </tbody>
          </table>
          <button className="btn-secondary mt-3" onClick={() => exportCsv(val.data ?? [], 'inventory-valuation.csv')}>
            {t('reports.exportCsv')}
          </button>
        </div>
      )}

      {tab === 'low' && (
        <div className="card p-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-start p-2">{t('common.name')}</th>
                <th className="text-start p-2">{t('inventory.onHand')}</th>
                <th className="text-start p-2">{t('inventory.threshold')}</th>
              </tr>
            </thead>
            <tbody>
              {(low.data ?? []).map((p, i) => (
                <tr key={i} className="border-t bg-red-50">
                  <td className="p-2">{lang === 'ar' ? p.nameAr : p.nameEn}</td>
                  <td className="p-2 font-semibold text-red-600">{p.qty}</td>
                  <td className="p-2">{p.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-slate-400 mt-4">
        {dateOnly(from)} → {dateOnly(to)}
      </div>
    </div>
  );
}
