import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { ServerError } from '../../components/Validation';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ParsedRow {
  values: Record<string, string>;
  rowNumber: number;
}

interface ImportRow {
  sku: string;
  barcode?: string | null;
  nameAr: string;
  nameEn: string;
  price: number;
  cost?: number;
  taxRate?: number;
  unit?: 'pc' | 'kg' | 'g' | 'l' | 'ml' | 'm';
  category?: string;
  initialStock?: number;
  lowStockThreshold?: number;
}

interface ImportResult {
  sku: string;
  ok: boolean;
  reason?: string;
  id?: number;
}

const ALIAS: Record<string, keyof ImportRow> = {
  sku: 'sku', code: 'sku', 'product code': 'sku',
  barcode: 'barcode', ean: 'barcode', upc: 'barcode',
  name_ar: 'nameAr', 'arabic name': 'nameAr', 'name (ar)': 'nameAr', 'الاسم بالعربي': 'nameAr', 'الاسم': 'nameAr',
  name_en: 'nameEn', 'english name': 'nameEn', 'name (en)': 'nameEn', 'الاسم بالانجليزي': 'nameEn',
  price: 'price', selling: 'price', 'sale price': 'price', 'السعر': 'price',
  cost: 'cost', 'cost price': 'cost', 'التكلفة': 'cost',
  tax: 'taxRate', vat: 'taxRate', 'tax_rate': 'taxRate', 'tax rate': 'taxRate', 'الضريبة': 'taxRate',
  unit: 'unit', 'الوحدة': 'unit',
  category: 'category', cat: 'category', 'الفئة': 'category',
  stock: 'initialStock', qty: 'initialStock', 'initial stock': 'initialStock', 'الكمية': 'initialStock', 'المخزون': 'initialStock',
  low_stock: 'lowStockThreshold', 'low stock': 'lowStockThreshold', threshold: 'lowStockThreshold', 'حد التنبيه': 'lowStockThreshold',
};

function mapHeader(h: string): keyof ImportRow | null {
  return ALIAS[h.trim().toLowerCase()] ?? null;
}

function toRow(values: Record<string, string>): { row?: ImportRow; error?: string } {
  const r: any = {};
  for (const [csvHeader, raw] of Object.entries(values)) {
    const field = mapHeader(csvHeader);
    if (!field) continue;
    if (raw === '') continue;
    if (['price', 'cost', 'taxRate', 'initialStock', 'lowStockThreshold'].includes(field)) {
      const n = parseFloat(raw);
      if (isNaN(n)) return { error: `${field}: not a number ("${raw}")` };
      r[field] = Math.round(n * 100) / 100;
    } else {
      r[field] = raw;
    }
  }
  if (!r.sku) return { error: 'sku is required' };
  if (!r.nameAr) r.nameAr = r.nameEn ?? r.sku;
  if (!r.nameEn) r.nameEn = r.nameAr ?? r.sku;
  if (r.price === undefined) return { error: 'price is required' };
  return { row: r as ImportRow };
}

export function ProductsImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<{ header: string[]; rows: ParsedRow[]; path: string } | null>(null);
  const [results, setResults] = useState<{ results: ImportResult[]; okCount: number; total: number } | null>(null);

  const previewRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((r) => {
      const mapped = toRow(r.values);
      return { rowNumber: r.rowNumber, mapped: mapped.row, error: mapped.error };
    });
  }, [parsed]);

  const validRows = previewRows.filter((r) => !!r.mapped).map((r) => r.mapped!);
  const invalidCount = previewRows.length - validRows.length;

  const pick = useMutation({
    mutationFn: () => api<{ header: string[]; rows: ParsedRow[]; path: string } | null>('products.pickImportFile', {}),
    onSuccess: (data) => {
      if (data) {
        setParsed(data);
        setResults(null);
      }
    },
  });

  const importNow = useMutation({
    mutationFn: () => api<{ results: ImportResult[]; okCount: number; total: number }>('products.bulkImport', { rows: validRows }),
    onSuccess: (data) => {
      setResults(data);
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  function reset() {
    setParsed(null);
    setResults(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={reset}
      title={t('products.import.title')}
      size="xl"
      footer={
        results ? (
          <button className="btn-primary" onClick={reset}>{t('common.close')}</button>
        ) : (
          <>
            <button className="btn-secondary" onClick={reset}>{t('common.cancel')}</button>
            {parsed && (
              <button
                className="btn-primary"
                disabled={importNow.isPending || validRows.length === 0}
                onClick={() => importNow.mutate()}
              >
                {t('products.import.confirm', { count: validRows.length })}
              </button>
            )}
          </>
        )
      }
    >
      <ServerError error={pick.error || importNow.error} />

      {!parsed && !results && (
        <div className="text-center py-10 space-y-4">
          <div className="inline-flex w-16 h-16 rounded-full bg-brand-100 text-brand-700 items-center justify-center mx-auto">
            <FileSpreadsheet size={32} />
          </div>
          <p className="text-sm text-slate-600 max-w-md mx-auto">{t('products.import.intro')}</p>
          <button className="btn-primary mx-auto" disabled={pick.isPending} onClick={() => pick.mutate()}>
            <Upload size={14} /> {t('products.import.pick')}
          </button>
          <details className="mt-6 text-start max-w-md mx-auto">
            <summary className="cursor-pointer text-sm font-medium">{t('products.import.formatHelp')}</summary>
            <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-auto">
{`sku,barcode,name_ar,name_en,price,cost,tax,unit,category,stock,low_stock
GR-100,6281000999001,خبز عربي,Arabic Bread,3,2,0,pc,Food,100,20
DR-100,5449000111111,مياه 1.5L,Water 1.5L,2.5,1.5,17,pc,Beverages,200,40`}
            </pre>
          </details>
        </div>
      )}

      {parsed && !results && (
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            {t('products.import.parsed', { total: parsed.rows.length, valid: validRows.length })}
            {invalidCount > 0 && (
              <span className="ms-2 text-amber-700">({invalidCount} {t('products.import.skipped')})</span>
            )}
          </div>
          <div className="border border-slate-200 rounded max-h-[50vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-start p-2 w-10">#</th>
                  <th className="text-start p-2">SKU</th>
                  <th className="text-start p-2">{t('common.name')}</th>
                  <th className="text-start p-2">{t('common.price')}</th>
                  <th className="text-start p-2">{t('common.qty')}</th>
                  <th className="text-start p-2">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.rowNumber} className={`border-t ${r.error ? 'bg-amber-50' : ''}`}>
                    <td className="p-2 text-slate-400">{r.rowNumber}</td>
                    <td className="p-2 font-mono">{r.mapped?.sku ?? '-'}</td>
                    <td className="p-2">{r.mapped?.nameAr ?? r.mapped?.nameEn ?? '-'}</td>
                    <td className="p-2">{r.mapped?.price ?? '-'}</td>
                    <td className="p-2">{r.mapped?.initialStock ?? 0}</td>
                    <td className="p-2">
                      {r.error ? (
                        <span className="text-amber-700 text-xs flex items-center gap-1">
                          <AlertCircle size={12} /> {r.error}
                        </span>
                      ) : (
                        <span className="text-green-700 text-xs flex items-center gap-1">
                          <CheckCircle2 size={12} /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-3">
          <div className="text-center py-3">
            <CheckCircle2 size={48} className="mx-auto text-green-600 mb-2" />
            <div className="text-lg font-semibold">
              {t('products.import.done', { ok: results.okCount, total: results.total })}
            </div>
          </div>
          {results.results.some((r) => !r.ok) && (
            <div className="border border-amber-200 bg-amber-50 rounded p-3 max-h-60 overflow-auto text-sm space-y-1">
              <div className="font-semibold mb-1">{t('products.import.failedRows')}:</div>
              <ul className="list-disc ps-5">
                {results.results.filter((r) => !r.ok).map((r, i) => (
                  <li key={i}><span className="font-mono">{r.sku}</span> — {r.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
