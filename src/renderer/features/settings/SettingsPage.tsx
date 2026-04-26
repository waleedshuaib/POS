import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';

export function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api<Record<string, string>>('settings.getAll', {}) });
  const [state, setState] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setState(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (s: Record<string, string>) => api('settings.set', s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const exportBackup = useMutation({
    mutationFn: () => api<{ canceled: boolean; path: string | null }>('backup.export', {}),
  });
  const restore = useMutation({
    mutationFn: () => api<{ canceled: boolean; restartRecommended?: boolean }>('backup.restore', {}),
  });

  function set<K extends string>(k: K, v: string) {
    setState({ ...state, [k]: v });
  }

  function testPrinter() {
    api('printer.test', {}).catch(() => null);
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} helpSlug="backup-restore" />

      <div className="space-y-6">
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">{t('settings.store')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('settings.storeNameAr')}</label>
              <input className="input" dir="rtl" value={state['store.name_ar'] ?? ''} onChange={(e) => set('store.name_ar', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('settings.storeNameEn')}</label>
              <input className="input" dir="ltr" value={state['store.name_en'] ?? ''} onChange={(e) => set('store.name_en', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('common.phone')}</label>
              <input className="input" value={state['store.phone'] ?? ''} onChange={(e) => set('store.phone', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('common.address')}</label>
              <input className="input" value={state['store.address'] ?? ''} onChange={(e) => set('store.address', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('settings.taxDefault')}</label>
              <input className="input" value={state['tax.default_rate'] ?? '0'} onChange={(e) => set('tax.default_rate', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('settings.currency')}</label>
              <input className="input" value={state['currency.symbol'] ?? '₪'} onChange={(e) => set('currency.symbol', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">{t('settings.printer')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={state['printer.enabled'] === 'true'}
                onChange={(e) => set('printer.enabled', e.target.checked ? 'true' : 'false')}
              />
              {t('settings.printerEnabled')}
            </label>
            <div>
              <label className="label">{t('settings.printerType')}</label>
              <select className="input" value={state['printer.type'] ?? 'usb'} onChange={(e) => set('printer.type', e.target.value)}>
                <option value="usb">USB</option>
                <option value="network">Network</option>
              </select>
            </div>
            <div>
              <label className="label">{t('settings.receiptHeader')}</label>
              <input className="input" value={state['receipt.header'] ?? ''} onChange={(e) => set('receipt.header', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('settings.receiptFooter')}</label>
              <input className="input" value={state['receipt.footer'] ?? ''} onChange={(e) => set('receipt.footer', e.target.value)} />
            </div>
          </div>
          <button className="btn-secondary" onClick={testPrinter}>
            {t('common.print')}
          </button>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">{t('settings.backup')}</h2>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={exportBackup.isPending} onClick={() => exportBackup.mutate()}>
              {t('settings.backupExport')}
            </button>
            <button className="btn-secondary" disabled={restore.isPending} onClick={() => restore.mutate()}>
              {t('settings.backupRestore')}
            </button>
          </div>
          {exportBackup.data?.path && <div className="text-xs text-green-700">Saved: {exportBackup.data.path}</div>}
          {restore.data?.restartRecommended && <div className="text-xs text-orange-700">Please restart the app.</div>}
        </section>

        <div className="flex justify-end">
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(state)}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
