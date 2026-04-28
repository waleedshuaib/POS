import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { dateTime } from '../../lib/format';
import { Database, FolderOpen, FileText, Download, Upload, Printer, RefreshCw, AlertCircle, Tablet, KeyRound, ShieldCheck, ShieldAlert } from 'lucide-react';

interface BackupSlot {
  path: string;
  exists: boolean;
  sizeBytes: number;
  mtime: number | null;
}
interface BackupInfo {
  dbPath: string;
  imagesDir: string;
  version: string;
  platform: string;
  autoBackup: { newSlot: BackupSlot; oldSlot: BackupSlot } | null;
  logsDir: string | null;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api<Record<string, string>>('settings.getAll', {}) });
  const info = useQuery({
    queryKey: ['backup.info'],
    queryFn: () => api<BackupInfo>('backup.info', {}),
    refetchInterval: 30_000,
  });
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
  const runNow = useMutation({
    mutationFn: () => api<{ newPath: string; oldPath: string | null }>('backup.runNow', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backup.info'] }),
  });

  function set<K extends string>(k: K, v: string) {
    setState({ ...state, [k]: v });
  }

  function testPrinter() {
    api('printer.test', {}).catch(() => null);
  }

  async function pickLogo() {
    const result = await api<{ path: string } | null>('images.pick', {});
    if (result) {
      const next = { ...state, 'receipt.logo_path': result.path };
      setState(next);
      save.mutate(next);
    }
  }

  function clearLogo() {
    const next = { ...state, 'receipt.logo_path': '' };
    setState(next);
    save.mutate(next);
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

        {/* Display / POS layout */}
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Tablet size={18} />{t('settings.posLayout')}</h2>
          <p className="text-sm text-slate-500">{t('settings.touchModeExplain')}</p>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={state['pos.touch_mode'] === 'true'}
              onChange={(e) => set('pos.touch_mode', e.target.checked ? 'true' : 'false')}
            />
            {t('settings.touchMode')}
          </label>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Printer size={18} />{t('settings.printer')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={state['printer.enabled'] === 'true'}
                onChange={(e) => set('printer.enabled', e.target.checked ? 'true' : 'false')}
              />
              {t('settings.printerEnabled')}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={state['receipt.preview_default'] !== 'false'}
                onChange={(e) => set('receipt.preview_default', e.target.checked ? 'true' : 'false')}
              />
              {t('settings.previewDefault')}
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
            <div className="col-span-2">
              <label className="label">{t('settings.receiptLogo')}</label>
              <div className="flex items-center gap-3">
                {state['receipt.logo_path'] ? (
                  <>
                    <img
                      src={`file://${state['receipt.logo_path']}`}
                      alt=""
                      className="h-16 border border-slate-200 rounded bg-slate-50"
                    />
                    <span className="text-xs text-slate-500 truncate max-w-xs" title={state['receipt.logo_path']}>
                      {state['receipt.logo_path']}
                    </span>
                    <button className="btn-secondary" onClick={pickLogo}>{t('settings.changeLogo')}</button>
                    <button className="btn-danger" onClick={clearLogo}>{t('common.delete')}</button>
                  </>
                ) : (
                  <button className="btn-secondary" onClick={pickLogo}>{t('settings.uploadLogo')}</button>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">{t('settings.logoHint')}</div>
            </div>
          </div>
          <button className="btn-secondary" onClick={testPrinter}>
            <Printer size={14} /> {t('common.print')}
          </button>
        </section>

        {/* Auto backup */}
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Database size={18} />{t('settings.autoBackup')}</h2>
          <p className="text-sm text-slate-500">{t('settings.autoBackupExplain')}</p>
          {info.data?.autoBackup ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-md p-3 bg-slate-50">
                <div className="text-xs uppercase text-slate-500">{t('settings.backupNew')}</div>
                {info.data.autoBackup.newSlot.exists ? (
                  <>
                    <div className="font-medium mt-1">{dateTime(info.data.autoBackup.newSlot.mtime!)}</div>
                    <div className="text-xs text-slate-500 truncate" title={info.data.autoBackup.newSlot.path}>
                      {info.data.autoBackup.newSlot.path}
                    </div>
                    <div className="text-xs text-slate-500">{fmtSize(info.data.autoBackup.newSlot.sizeBytes)}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400 mt-1">{t('settings.backupNone')}</div>
                )}
              </div>
              <div className="border border-slate-200 rounded-md p-3 bg-slate-50">
                <div className="text-xs uppercase text-slate-500">{t('settings.backupOld')}</div>
                {info.data.autoBackup.oldSlot.exists ? (
                  <>
                    <div className="font-medium mt-1">{dateTime(info.data.autoBackup.oldSlot.mtime!)}</div>
                    <div className="text-xs text-slate-500 truncate" title={info.data.autoBackup.oldSlot.path}>
                      {info.data.autoBackup.oldSlot.path}
                    </div>
                    <div className="text-xs text-slate-500">{fmtSize(info.data.autoBackup.oldSlot.sizeBytes)}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400 mt-1">{t('settings.backupNone')}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle size={14} /> {t('settings.autoBackupNotConfigured')}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary" disabled={runNow.isPending} onClick={() => runNow.mutate()}>
              <RefreshCw size={14} /> {t('settings.backupNow')}
            </button>
            <button className="btn-secondary" onClick={() => api('backup.openFolder', {})}>
              <FolderOpen size={14} /> {t('settings.openBackupFolder')}
            </button>
          </div>
        </section>

        {/* Manual backup */}
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">{t('settings.backup')}</h2>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={exportBackup.isPending} onClick={() => exportBackup.mutate()}>
              <Download size={14} /> {t('settings.backupExport')}
            </button>
            <button className="btn-secondary" disabled={restore.isPending} onClick={() => restore.mutate()}>
              <Upload size={14} /> {t('settings.backupRestore')}
            </button>
          </div>
          {exportBackup.data?.path && <div className="text-xs text-green-700">{t('common.success')}: {exportBackup.data.path}</div>}
          {restore.data?.restartRecommended && <div className="text-xs text-orange-700">{t('settings.restartAfterRestore')}</div>}
        </section>

        {/* License */}
        <LicenseSection />

        {/* Logs */}
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><FileText size={18} />{t('settings.logs')}</h2>
          <p className="text-sm text-slate-500">{t('settings.logsExplain')}</p>
          {info.data?.logsDir && (
            <div className="text-xs text-slate-500 truncate" title={info.data.logsDir}>{info.data.logsDir}</div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button className="btn-secondary" onClick={() => api('logs.openTodayFile', {})}>
              <FileText size={14} /> {t('settings.openTodayLog')}
            </button>
            <button className="btn-secondary" onClick={() => api('logs.openFolder', {})}>
              <FolderOpen size={14} /> {t('settings.openLogFolder')}
            </button>
          </div>
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

interface LicenseInfo {
  state: 'valid' | 'grace' | 'missing' | 'expired' | 'wrongMachine' | 'tampered' | 'invalidPubKey';
  daysLeft?: number;
  license?: { issuedTo: string; expires: string; tier: string; issued: string; machineId: string };
  machineId: string;
  adminAllowed: boolean;
}

function LicenseSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [showInstall, setShowInstall] = useState(false);

  const status = useQuery({
    queryKey: ['license.status'],
    queryFn: () => api<LicenseInfo>('license.status', {}),
  });

  const install = useMutation({
    mutationFn: () => api('license.install', { json: text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['license.status'] });
      setText('');
      setShowInstall(false);
    },
  });

  const uninstall = useMutation({
    mutationFn: () => api('license.uninstall', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['license.status'] }),
  });

  const s = status.data;
  const ok = s?.state === 'valid';
  const warn = s?.state === 'grace';
  const bad = s && !ok && !warn;

  return (
    <section className="card p-5 space-y-3">
      <h2 className="font-semibold flex items-center gap-2">
        {ok ? <ShieldCheck size={18} className="text-green-600" /> : bad ? <ShieldAlert size={18} className="text-red-600" /> : <KeyRound size={18} />}
        {t('settings.license')}
      </h2>
      {s && (
        <div className={`text-sm rounded-md p-3 border ${ok ? 'bg-green-50 border-green-200' : warn ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className="font-medium">
            {ok && t('license.state.valid')}
            {warn && t('license.state.grace', { days: s.daysLeft ?? 0 })}
            {s.state === 'missing' && t('license.state.missing')}
            {s.state === 'expired' && t('license.state.expired')}
            {s.state === 'wrongMachine' && t('license.state.wrongMachine')}
            {s.state === 'tampered' && t('license.state.tampered')}
            {s.state === 'invalidPubKey' && t('license.state.invalidPubKey')}
          </div>
          {s.license && (
            <div className="text-xs mt-1 text-slate-700 space-y-0.5">
              <div>{t('license.issuedTo')}: <span className="font-semibold">{s.license.issuedTo}</span></div>
              <div>{t('license.tier')}: {s.license.tier}</div>
              <div>{t('license.expires')}: {s.license.expires}</div>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-slate-500">
        <div className="font-medium">{t('license.machineId')}</div>
        <code className="font-mono text-[10px] break-all bg-slate-50 px-2 py-1 rounded mt-1 inline-block">
          {s?.machineId ?? '...'}
        </code>
        <div className="mt-1">{t('license.machineIdHint')}</div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" onClick={() => setShowInstall(true)}>
          <Upload size={14} /> {t('license.install')}
        </button>
        {s?.license && (
          <button className="btn-danger" onClick={() => uninstall.mutate()}>
            {t('license.uninstall')}
          </button>
        )}
      </div>

      {showInstall && (
        <div className="space-y-2">
          <textarea
            className="input font-mono text-xs"
            rows={8}
            placeholder={t('license.pastePlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {install.error && <div className="text-red-600 text-sm">{(install.error as Error).message}</div>}
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setShowInstall(false); setText(''); }}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={!text.trim() || install.isPending} onClick={() => install.mutate()}>
              {t('common.save')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
