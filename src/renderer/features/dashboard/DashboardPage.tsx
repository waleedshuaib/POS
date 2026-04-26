import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { currency } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const today = useQuery({ queryKey: ['sales.todayStats'], queryFn: () => api<{ count: number; total: number }>('sales.todayStats', {}) });

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);

  const daily = useQuery({
    queryKey: ['reports.salesByDay'],
    queryFn: () =>
      api<Array<{ day: string; count: number; total: number }>>('reports.salesByDay', {
        from: weekAgo.toISOString(),
        to: now.toISOString(),
      }),
    retry: false,
  });

  const top = useQuery({
    queryKey: ['reports.topProducts'],
    queryFn: () =>
      api<Array<{ name: string; qty: number; revenue: number }>>('reports.topProducts', {
        from: weekAgo.toISOString(),
        to: now.toISOString(),
        limit: 5,
      }),
    retry: false,
  });

  const low = useQuery({
    queryKey: ['reports.lowStock'],
    queryFn: () => api<Array<{ nameAr: string; nameEn: string; qty: number; threshold: number }>>('reports.lowStock', {}),
  });

  const lang = i18n.language as 'ar' | 'en';

  return (
    <div>
      <PageHeader title={t('dashboard.title')} helpSlug="getting-started" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-sm text-slate-500">{t('dashboard.todaySales')}</div>
          <div className="text-3xl font-bold mt-2">{currency(today.data?.total ?? 0)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-slate-500">{t('dashboard.todayCount')}</div>
          <div className="text-3xl font-bold mt-2">{today.data?.count ?? 0}</div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="text-sm text-slate-500 mb-3">{t('dashboard.weeklyTrend')}</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#0284c7" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3">{t('dashboard.topProducts')}</div>
          <ul className="space-y-2">
            {(top.data ?? []).map((p, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="text-slate-600">{currency(p.revenue)}</span>
              </li>
            ))}
            {(top.data ?? []).length === 0 && <li className="text-sm text-slate-400">—</li>}
          </ul>
        </div>
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3 text-red-600">{t('dashboard.lowStock')}</div>
          <ul className="space-y-2">
            {(low.data ?? []).slice(0, 8).map((p, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span>{lang === 'ar' ? p.nameAr : p.nameEn}</span>
                <span className="text-red-600 font-semibold">{p.qty} / {p.threshold}</span>
              </li>
            ))}
            {(low.data ?? []).length === 0 && <li className="text-sm text-slate-400">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
