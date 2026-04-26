import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { currency } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { useCart, computeTotals } from './cartStore';
import { Trash2, Minus, Plus, Pause, Play } from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';
import { HeldSalesModal } from './HeldSalesModal';

interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string;
  price: number;
  taxRate: number;
  imagePath?: string | null;
  categoryId?: number | null;
}

export function PosPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const qc = useQueryClient();
  const cart = useCart();
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [showHoldPrompt, setShowHoldPrompt] = useState(false);
  const [holdName, setHoldName] = useState('');

  const products = useQuery({
    queryKey: ['pos.search', q],
    queryFn: () => api<Product[]>('products.search', { q }),
  });

  const customers = useQuery({
    queryKey: ['customers.list'],
    queryFn: () => api<Array<{ id: number; name: string }>>('customers.list', {}),
  });

  const totals = useMemo(() => computeTotals(cart.lines, cart.orderDiscount), [cart.lines, cart.orderDiscount]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Barcode scanner: listen for Enter in search box — handled via onSubmit.
  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    // Try exact barcode first
    const byBarcode = await api<Product | null>('products.getByBarcode', { barcode: term }).catch(() => null);
    if (byBarcode) {
      cart.addProduct(byBarcode, lang);
      setQ('');
      return;
    }
    // Else take first search result
    const results = await api<Product[]>('products.search', { q: term });
    if (results[0]) {
      cart.addProduct(results[0], lang);
      setQ('');
    }
  }

  const hold = useMutation({
    mutationFn: (name: string) =>
      api('sales.checkout', {
        customerId: cart.customerId,
        lines: cart.lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPriceOverride: l.unitPrice,
          lineDiscount: l.lineDiscount,
        })),
        orderDiscount: cart.orderDiscount,
        payments: [],
        hold: { name },
      }),
    onSuccess: () => {
      cart.clear();
      setShowHoldPrompt(false);
      setHoldName('');
      qc.invalidateQueries({ queryKey: ['sales.held'] });
    },
  });

  return (
    <div>
      <PageHeader
        title={t('pos.title')}
        helpSlug="sales-checkout"
        right={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowHeld(true)}>
              <Play size={16} /> {t('pos.heldSales')}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowHoldPrompt(true)}
              disabled={cart.lines.length === 0}
            >
              <Pause size={16} /> {t('pos.hold')}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Product grid */}
        <div className="col-span-7 space-y-3">
          <form onSubmit={onSearchSubmit}>
            <input
              ref={searchRef}
              className="input text-lg"
              placeholder={t('pos.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[calc(100vh-220px)] overflow-auto">
            {(products.data ?? []).map((p) => (
              <button
                key={p.id}
                className="card p-3 text-start hover:bg-brand-50 hover:border-brand-400 transition-colors"
                onClick={() => cart.addProduct(p, lang)}
              >
                <div className="font-semibold text-sm truncate">{lang === 'ar' ? p.nameAr : p.nameEn}</div>
                <div className="text-xs text-slate-500 mt-1">{p.sku}</div>
                <div className="text-brand-700 font-bold mt-2">{currency(p.price)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="col-span-5 card p-4 flex flex-col max-h-[calc(100vh-120px)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">{t('pos.cart')}</h2>
            {cart.lines.length > 0 && (
              <button className="text-sm text-red-600 hover:underline" onClick={() => cart.clear()}>
                {t('pos.clearCart')}
              </button>
            )}
          </div>

          <div className="mb-3">
            <label className="label">{t('pos.customer')}</label>
            <select
              className="input"
              value={cart.customerId ?? ''}
              onChange={(e) => cart.setCustomer(e.target.value ? parseInt(e.target.value, 10) : null)}
            >
              <option value="">{t('pos.noCustomer')}</option>
              {(customers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-auto space-y-2">
            {cart.lines.length === 0 && <div className="text-sm text-slate-400 text-center py-10">{t('pos.emptyCart')}</div>}
            {cart.lines.map((l) => (
              <div key={l.productId} className="border border-slate-200 rounded-md p-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{l.name}</div>
                    <div className="text-xs text-slate-500">{currency(l.unitPrice)}</div>
                  </div>
                  <button onClick={() => cart.removeLine(l.productId)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button className="btn-secondary p-1" onClick={() => cart.setQty(l.productId, Math.max(0.01, l.qty - 1))}>
                    <Minus size={14} />
                  </button>
                  <input
                    className="input text-center py-1 w-16"
                    type="number"
                    step="0.01"
                    value={l.qty}
                    onChange={(e) => cart.setQty(l.productId, parseFloat(e.target.value) || 0)}
                  />
                  <button className="btn-secondary p-1" onClick={() => cart.setQty(l.productId, l.qty + 1)}>
                    <Plus size={14} />
                  </button>
                  <div className="ms-auto text-sm font-semibold">{currency(l.qty * l.unitPrice - l.lineDiscount)}</div>
                </div>
                {l.lineDiscount > 0 && (
                  <div className="text-xs text-orange-600 mt-1">-{currency(l.lineDiscount)} ({t('pos.lineDiscount')})</div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-3 mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{t('common.subtotal')}</span>
              <span>{currency(totals.subtotal)}</span>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>{t('common.discount')}</span>
                <span>-{currency(totals.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t('common.tax')}</span>
              <span>{currency(totals.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
              <span>{t('pos.grandTotal')}</span>
              <span>{currency(totals.grandTotal)}</span>
            </div>
            <button
              className="btn-primary w-full text-lg py-3 mt-3"
              disabled={cart.lines.length === 0}
              onClick={() => setShowCheckout(true)}
            >
              {t('pos.checkout')}
            </button>
          </div>
        </div>
      </div>

      <CheckoutModal open={showCheckout} onClose={() => setShowCheckout(false)} totals={totals} />

      {showHeld && <HeldSalesModal onClose={() => setShowHeld(false)} />}

      {showHoldPrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card p-5 w-full max-w-sm space-y-3">
            <h3 className="font-semibold">{t('pos.hold')}</h3>
            <input
              className="input"
              placeholder={t('pos.holdName')}
              value={holdName}
              autoFocus
              onChange={(e) => setHoldName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowHoldPrompt(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                disabled={!holdName.trim() || hold.isPending}
                onClick={() => hold.mutate(holdName.trim())}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
