import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { currency } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { Field, ServerError, ValidationSummary } from '../../components/Validation';
import { MoneyInput, NumberInput } from '../../components/NumberInput';
import { Pencil, Plus, Trash2, Image as ImageIcon, Search, Upload } from 'lucide-react';
import { ProductsImport } from './ProductsImport';

interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string;
  price: number;
  cost: number;
  taxRate: number;
  unit: string;
  categoryId: number | null;
  trackStock: boolean;
  lowStockThreshold: number;
  active: boolean;
  imagePath: string | null;
}

interface Category {
  id: number;
  nameAr: string;
  nameEn: string;
}

type Draft = Partial<Product> & { initialStock?: number | null };

const empty: Draft = {
  sku: '',
  barcode: '',
  nameAr: '',
  nameEn: '',
  price: null as any,
  cost: null as any,
  taxRate: 17,
  unit: 'pc',
  trackStock: true,
  lowStockThreshold: null as any,
  active: true,
  initialStock: null,
};

function validate(d: Draft, t: (k: string, o?: any) => string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.sku?.trim()) e.sku = t('common.required');
  if (!d.nameAr?.trim()) e.nameAr = t('common.required');
  if (!d.nameEn?.trim()) e.nameEn = t('common.required');
  if (d.price === null || d.price === undefined || isNaN(d.price as number))
    e.price = t('common.required');
  else if ((d.price as number) < 0) e.price = t('common.minValue', { n: 0 });
  if (d.cost === null || d.cost === undefined || isNaN(d.cost as number))
    e.cost = t('common.required');
  else if ((d.cost as number) < 0) e.cost = t('common.minValue', { n: 0 });
  if (d.taxRate !== undefined && d.taxRate !== null && ((d.taxRate as number) < 0 || (d.taxRate as number) > 100))
    e.taxRate = t('common.invalid');
  if (d.lowStockThreshold !== null && d.lowStockThreshold !== undefined && (d.lowStockThreshold as number) < 0)
    e.lowStockThreshold = t('common.minValue', { n: 0 });
  if (d.initialStock !== null && d.initialStock !== undefined && (d.initialStock as number) < 0)
    e.initialStock = t('common.minValue', { n: 0 });
  return e;
}

export function ProductsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const list = useQuery({ queryKey: ['products', query], queryFn: () => api<Product[]>('products.search', { q: query }) });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('categories.list', {}) });

  const errors = useMemo(() => (editing ? validate(editing, t) : {}), [editing, t]);
  const errorList = Object.values(errors);

  const save = useMutation({
    mutationFn: async (p: Draft) => (p.id ? api('products.update', p) : api('products.create', p)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setEditing(null);
      setSubmitted(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api('products.remove', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  async function pickImage() {
    const result = await api<{ path: string } | null>('images.pick', {});
    if (result) setEditing({ ...editing, imagePath: result.path });
  }

  function onSubmit() {
    setSubmitted(true);
    if (errorList.length > 0 || !editing) return;
    save.mutate(editing);
  }

  function show(field: keyof typeof errors): string | undefined {
    return submitted ? errors[field as string] : undefined;
  }

  return (
    <div>
      <PageHeader
        title={t('products.title')}
        helpSlug="products-inventory"
        right={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              <Upload size={14} /> {t('products.import.title')}
            </button>
            <button className="btn-primary" onClick={() => { setEditing(empty); setSubmitted(false); }}>
              <Plus size={16} /> {t('products.add')}
            </button>
          </div>
        }
      />
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
        <input
          className="input ps-9"
          placeholder={t('common.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-start p-3">{t('common.sku')}</th>
              <th className="text-start p-3">{t('common.barcode')}</th>
              <th className="text-start p-3">{t('common.name')}</th>
              <th className="text-start p-3">{t('common.category')}</th>
              <th className="text-start p-3">{t('common.price')}</th>
              <th className="text-start p-3">{t('common.cost')}</th>
              <th className="text-start p-3">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-mono text-xs">{p.sku}</td>
                <td className="p-3 font-mono text-xs">{p.barcode ?? '-'}</td>
                <td className="p-3 font-medium">{lang === 'ar' ? p.nameAr : p.nameEn}</td>
                <td className="p-3">
                  {(() => {
                    const c = cats.data?.find((x) => x.id === p.categoryId);
                    return c ? (lang === 'ar' ? c.nameAr : c.nameEn) : '-';
                  })()}
                </td>
                <td className="p-3">{currency(p.price)}</td>
                <td className="p-3 text-slate-500">{currency(p.cost)}</td>
                <td className="p-3 flex gap-1">
                  <button className="btn-secondary p-1.5" onClick={() => { setEditing(p); setSubmitted(false); }} title={t('common.edit')}>
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-danger p-1.5"
                    onClick={() => confirm(t('common.confirmDelete')) && remove.mutate(p.id)}
                    title={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {(list.data ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setSubmitted(false); }}
        title={editing?.id ? t('products.edit') : t('products.add')}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setEditing(null); setSubmitted(false); }}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={save.isPending} onClick={onSubmit}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {editing && (
          <>
            {submitted && <ValidationSummary errors={errorList} />}
            <ServerError error={save.error} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('common.sku')} required error={show('sku')}>
                <input className="input" value={editing.sku ?? ''} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} />
              </Field>
              <Field label={t('common.barcode')}>
                <input
                  className="input font-mono"
                  value={editing.barcode ?? ''}
                  onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
                />
              </Field>
              <Field label={t('products.nameAr')} required error={show('nameAr')}>
                <input className="input" dir="rtl" value={editing.nameAr ?? ''} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
              </Field>
              <Field label={t('products.nameEn')} required error={show('nameEn')}>
                <input className="input" dir="ltr" value={editing.nameEn ?? ''} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
              </Field>
              <Field label={t('common.category')}>
                <select
                  className="input"
                  value={editing.categoryId ?? ''}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value ? parseInt(e.target.value, 10) : null })}
                >
                  <option value="">—</option>
                  {(cats.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'ar' ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('products.unit')}>
                <select className="input" value={editing.unit ?? 'pc'} onChange={(e) => setEditing({ ...editing, unit: e.target.value })}>
                  <option value="pc">pc</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="m">m</option>
                </select>
              </Field>
              <Field label={t('common.price')} required error={show('price')}>
                <MoneyInput
                  value={editing.price ?? null}
                  onChange={(v) => setEditing({ ...editing, price: v ?? (null as any) })}
                  min={0}
                  suffix="₪"
                />
              </Field>
              <Field label={t('common.cost')} required error={show('cost')}>
                <MoneyInput
                  value={editing.cost ?? null}
                  onChange={(v) => setEditing({ ...editing, cost: v ?? (null as any) })}
                  min={0}
                  suffix="₪"
                />
              </Field>
              <Field label={t('products.taxRate')} error={show('taxRate')}>
                <NumberInput
                  value={editing.taxRate ?? null}
                  onChange={(v) => setEditing({ ...editing, taxRate: v ?? 0 })}
                  min={0}
                  max={100}
                  decimals={2}
                  suffix="%"
                />
              </Field>
              <Field label={t('products.lowStockThreshold')} error={show('lowStockThreshold')}>
                <MoneyInput
                  value={editing.lowStockThreshold ?? null}
                  onChange={(v) => setEditing({ ...editing, lowStockThreshold: v ?? 0 })}
                  min={0}
                />
              </Field>
              {!editing.id && (
                <Field label={t('products.initialStock')} error={show('initialStock')}>
                  <MoneyInput
                    value={editing.initialStock ?? null}
                    onChange={(v) => setEditing({ ...editing, initialStock: v })}
                    min={0}
                  />
                </Field>
              )}
              <div className="col-span-2 flex flex-wrap items-center gap-3 pt-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.trackStock ?? true}
                    onChange={(e) => setEditing({ ...editing, trackStock: e.target.checked })}
                  />
                  {t('products.trackStock')}
                </label>
                <button type="button" className="btn-secondary" onClick={pickImage}>
                  <ImageIcon size={14} /> {t('products.pickImage')}
                </button>
                {editing.imagePath && <span className="text-xs text-slate-500 truncate max-w-xs">{editing.imagePath}</span>}
              </div>
            </div>
          </>
        )}
      </Modal>

      <ProductsImport open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
