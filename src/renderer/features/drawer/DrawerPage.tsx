import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { Field, ServerError, ValidationSummary } from '../../components/Validation';
import { MoneyInput } from '../../components/NumberInput';
import { currency, dateTime } from '../../lib/format';
import { LockOpen, LockKeyhole, Banknote } from 'lucide-react';

interface DrawerState {
  id: number;
  openingAmount: number;
  expectedAmount: number;
  openedAt: number;
  status: 'open' | 'closed';
}

export function DrawerPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [opening, setOpening] = useState<number | null>(null);
  const [counted, setCounted] = useState<number | null>(null);
  const [openSubmitted, setOpenSubmitted] = useState(false);
  const [closeSubmitted, setCloseSubmitted] = useState(false);

  const current = useQuery({ queryKey: ['drawer.current'], queryFn: () => api<DrawerState | null>('drawer.current', {}) });
  const history = useQuery({
    queryKey: ['drawer.history'],
    queryFn: () =>
      api<Array<DrawerState & { countedAmount: number | null; variance: number | null; closedAt: number | null }>>(
        'drawer.history',
        { limit: 20 },
      ),
  });

  const open = useMutation({
    mutationFn: () => api('drawer.open', { openingAmount: opening ?? 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drawer.current'] });
      setOpening(null);
      setOpenSubmitted(false);
    },
  });
  const close = useMutation({
    mutationFn: () => api<{ variance: number; expectedAmount: number }>('drawer.close', { countedAmount: counted ?? 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drawer.current'] });
      qc.invalidateQueries({ queryKey: ['drawer.history'] });
      setCounted(null);
      setCloseSubmitted(false);
    },
  });

  const openErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (opening === null) e.opening = t('common.required');
    else if (opening < 0) e.opening = t('common.minValue', { n: 0 });
    return e;
  }, [opening, t]);

  const closeErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (counted === null) e.counted = t('common.required');
    else if (counted < 0) e.counted = t('common.minValue', { n: 0 });
    return e;
  }, [counted, t]);

  function onOpen() {
    setOpenSubmitted(true);
    if (Object.keys(openErrors).length > 0) return;
    open.mutate();
  }
  function onClose() {
    setCloseSubmitted(true);
    if (Object.keys(closeErrors).length > 0) return;
    close.mutate();
  }

  return (
    <div>
      <PageHeader title={t('drawer.title')} helpSlug="daily-closing" />
      <div className="card p-5 mb-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Banknote size={18} /> {t('drawer.current')}
        </h2>
        {current.data ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-500">{dateTime(current.data.openedAt)}</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-500">{t('drawer.openingAmount')}</div>
                <div className="text-xl font-semibold">{currency(current.data.openingAmount)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">{t('drawer.expected')}</div>
                <div className="text-xl font-semibold text-brand-700">{currency(current.data.expectedAmount)}</div>
              </div>
            </div>
            {closeSubmitted && <ValidationSummary errors={Object.values(closeErrors)} />}
            <ServerError error={close.error} />
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Field label={t('drawer.counted')} required error={closeSubmitted ? closeErrors.counted : undefined}>
                  <MoneyInput value={counted} onChange={setCounted} min={0} suffix="₪" />
                </Field>
              </div>
              <button className="btn-primary" disabled={close.isPending} onClick={onClose}>
                <LockKeyhole size={16} /> {t('drawer.close')}
              </button>
            </div>
            {close.data && (
              <div className={`text-sm ${close.data.variance === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {t('drawer.variance')}: {currency(close.data.variance)}
              </div>
            )}
          </div>
        ) : (
          <>
            {openSubmitted && <ValidationSummary errors={Object.values(openErrors)} />}
            <ServerError error={open.error} />
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Field label={t('drawer.openingAmount')} required error={openSubmitted ? openErrors.opening : undefined}>
                  <MoneyInput value={opening} onChange={setOpening} min={0} suffix="₪" />
                </Field>
              </div>
              <button className="btn-primary" disabled={open.isPending} onClick={onOpen}>
                <LockOpen size={16} /> {t('drawer.open')}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start p-3">{t('common.date')}</th>
              <th className="text-start p-3">{t('drawer.openingAmount')}</th>
              <th className="text-start p-3">{t('drawer.expected')}</th>
              <th className="text-start p-3">{t('drawer.counted')}</th>
              <th className="text-start p-3">{t('drawer.variance')}</th>
              <th className="text-start p-3">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody>
            {(history.data ?? []).map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-3">{dateTime(d.openedAt)}</td>
                <td className="p-3">{currency(d.openingAmount)}</td>
                <td className="p-3">{currency(d.expectedAmount)}</td>
                <td className="p-3">{d.countedAmount != null ? currency(d.countedAmount) : '-'}</td>
                <td className={`p-3 ${d.variance && d.variance !== 0 ? 'text-orange-600 font-semibold' : ''}`}>
                  {d.variance != null ? currency(d.variance) : '-'}
                </td>
                <td className="p-3">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
