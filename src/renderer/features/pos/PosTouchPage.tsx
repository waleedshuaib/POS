import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { currency } from '../../lib/format';
import { useCart, computeTotals } from './cartStore';
import { CheckoutModal } from './CheckoutModal';
import { HeldSalesModal } from './HeldSalesModal';
import {
  Trash2, Minus, Plus, Pause, Play, Search, Layers, X, Delete,
  ShoppingCart, ScanBarcode,
} from 'lucide-react';

interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string;
  price: number;
  taxRate: number;
  imagePath?: string | null;
  categoryId: number | null;
}
interface Category { id: number; nameAr: string; nameEn: string; }

/**
 * Touch-optimized POS screen.
 *
 * Different from PosPage:
 *   - vertical category rail instead of free search-only
 *   - big square product tiles (image + name + price)
 *   - on-screen numpad pops up when a cart line qty is tapped
 *   - large +/- buttons, large checkout button
 *   - shares the same cart store and checkout flow
 */
export function PosTouchPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const qc = useQueryClient();
  const cart = useCart();
  const searchRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [showHoldPrompt, setShowHoldPrompt] = useState(false);
  const [holdName, setHoldName] = useState('');
  const [numpadFor, setNumpadFor] = useState<{ productId: number; current: number } | null>(null);

  const products = useQuery({
    queryKey: ['products.touch', q],
    queryFn: () => api<Product[]>('products.search', { q }),
  });
  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('categories.list', {}),
  });
  const customers = useQuery({
    queryKey: ['customers.list'],
    queryFn: () => api<Array<{ id: number; name: string }>>('customers.list', {}),
  });

  const totals = useMemo(() => computeTotals(cart.lines, cart.orderDiscount), [cart.lines, cart.orderDiscount]);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Group products into a stable list per category for tab filtering.
  const visibleProducts = useMemo(() => {
    const all = products.data ?? [];
    if (activeCat === 'all') return all;
    return all.filter((p) => p.categoryId === activeCat);
  }, [products.data, activeCat]);

  // Categories that actually contain products in the current search hit list.
  const usedCats = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of products.data ?? []) {
      if (p.categoryId != null) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    }
    return (cats.data ?? []).filter((c) => counts.has(c.id)).map((c) => ({ ...c, count: counts.get(c.id)! }));
  }, [products.data, cats.data]);

  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const byBarcode = await api<Product | null>('products.getByBarcode', { barcode: term }).catch(() => null);
    if (byBarcode) {
      cart.addProduct(byBarcode, lang);
      setQ('');
      return;
    }
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
          productId: l.productId, qty: l.qty, unitPriceOverride: l.unitPrice, lineDiscount: l.lineDiscount,
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
    <div className="-m-6 h-[calc(100vh-0px)] flex flex-col bg-slate-100">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 p-3 flex items-center gap-3 flex-shrink-0">
        <form onSubmit={onSearchSubmit} className="flex-1 relative">
          <ScanBarcode size={20} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
          <input
            ref={searchRef}
            className="input ps-10 text-lg py-3"
            placeholder={t('pos.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            inputMode="search"
          />
        </form>
        <select
          className="input py-3 max-w-xs"
          value={cart.customerId ?? ''}
          onChange={(e) => cart.setCustomer(e.target.value ? parseInt(e.target.value, 10) : null)}
        >
          <option value="">{t('pos.noCustomer')}</option>
          {(customers.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-secondary py-3 px-4" onClick={() => setShowHeld(true)}>
          <Play size={18} /> {t('pos.heldSales')}
        </button>
        <button
          className="btn-secondary py-3 px-4"
          onClick={() => setShowHoldPrompt(true)}
          disabled={cart.lines.length === 0}
        >
          <Pause size={18} /> {t('pos.hold')}
        </button>
      </div>

      {/* Body: 3 columns — category rail, product grid, cart */}
      <div className="flex-1 flex overflow-hidden">
        {/* Category rail */}
        <aside className="w-44 bg-white border-e border-slate-200 overflow-y-auto flex-shrink-0">
          <button
            onClick={() => setActiveCat('all')}
            className={`w-full p-4 text-start border-b border-slate-100 ${
              activeCat === 'all' ? 'bg-brand-600 text-white' : 'hover:bg-slate-50'
            }`}
          >
            <Layers size={20} className="mb-1" />
            <div className="font-semibold">{t('common.all')}</div>
            <div className="text-xs opacity-75">{(products.data ?? []).length}</div>
          </button>
          {usedCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`w-full p-4 text-start border-b border-slate-100 ${
                activeCat === c.id ? 'bg-brand-600 text-white' : 'hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold text-sm">{lang === 'ar' ? c.nameAr : c.nameEn}</div>
              <div className="text-xs opacity-75">{c.count}</div>
            </button>
          ))}
        </aside>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {visibleProducts.length === 0 ? (
            <div className="text-center text-slate-400 py-20">
              <Search size={48} className="mx-auto mb-3 opacity-40" />
              <div>{q.trim() ? t('pos.noResults') : t('pos.startTyping')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => cart.addProduct(p, lang)}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 text-start active:scale-95 active:bg-brand-50 transition-transform min-h-[140px] flex flex-col"
                >
                  {p.imagePath ? (
                    <img
                      src={`file://${p.imagePath}`}
                      alt=""
                      className="w-full h-16 object-contain mb-2"
                    />
                  ) : (
                    <div className="w-full h-16 bg-slate-50 rounded grid place-items-center text-slate-300 mb-2">
                      <Layers size={24} />
                    </div>
                  )}
                  <div className="font-semibold text-sm leading-tight line-clamp-2">
                    {lang === 'ar' ? p.nameAr : p.nameEn}
                  </div>
                  <div className="text-brand-700 font-bold mt-auto pt-1">{currency(p.price)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart panel */}
        <aside className="w-96 bg-white border-s border-slate-200 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingCart size={18} /> {t('pos.cart')} ({cart.lines.length})
            </h2>
            {cart.lines.length > 0 && (
              <button className="text-sm text-red-600" onClick={() => cart.clear()}>
                {t('pos.clearCart')}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.lines.length === 0 ? (
              <div className="text-center text-slate-300 py-16">
                <ShoppingCart size={48} className="mx-auto opacity-40" />
                <div className="mt-2 text-sm">{t('pos.emptyCart')}</div>
              </div>
            ) : (
              cart.lines.map((l) => (
                <div key={l.productId} className="border-b border-slate-100 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{l.name}</div>
                      <div className="text-xs text-slate-500">{currency(l.unitPrice)}</div>
                    </div>
                    <button
                      onClick={() => cart.removeLine(l.productId)}
                      className="p-2 text-red-500"
                      title={t('common.delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      className="w-12 h-12 rounded-lg bg-slate-100 active:bg-slate-200 grid place-items-center"
                      onClick={() => cart.setQty(l.productId, Math.max(0.01, l.qty - 1))}
                    >
                      <Minus size={20} />
                    </button>
                    <button
                      className="flex-1 h-12 rounded-lg border border-slate-200 font-bold text-lg"
                      onClick={() => setNumpadFor({ productId: l.productId, current: l.qty })}
                    >
                      {l.qty}
                    </button>
                    <button
                      className="w-12 h-12 rounded-lg bg-slate-100 active:bg-slate-200 grid place-items-center"
                      onClick={() => cart.setQty(l.productId, l.qty + 1)}
                    >
                      <Plus size={20} />
                    </button>
                    <div className="w-24 text-end font-bold text-brand-700">
                      {currency(l.qty * l.unitPrice - l.lineDiscount)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals + checkout */}
          <div className="border-t border-slate-200 p-4 space-y-2 flex-shrink-0">
            <div className="flex justify-between text-sm">
              <span>{t('common.subtotal')}</span>
              <span>{currency(totals.subtotal)}</span>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>{t('common.discount')}</span>
                <span>-{currency(totals.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>{t('common.tax')}</span>
              <span>{currency(totals.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-2xl font-bold pt-2 border-t border-slate-100">
              <span>{t('pos.grandTotal')}</span>
              <span className="text-brand-700">{currency(totals.grandTotal)}</span>
            </div>
            <button
              className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xl font-bold py-5 rounded-lg disabled:opacity-50 disabled:pointer-events-none mt-2"
              disabled={cart.lines.length === 0}
              onClick={() => setShowCheckout(true)}
            >
              {t('pos.checkout')} · {currency(totals.grandTotal)}
            </button>
          </div>
        </aside>
      </div>

      <CheckoutModal open={showCheckout} onClose={() => setShowCheckout(false)} totals={totals} />

      {showHeld && <HeldSalesModal onClose={() => setShowHeld(false)} />}

      {/* Hold prompt */}
      {showHoldPrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card p-5 w-full max-w-sm space-y-3">
            <h3 className="font-semibold text-lg">{t('pos.hold')}</h3>
            <input
              className="input text-lg py-3"
              placeholder={t('pos.holdName')}
              value={holdName}
              autoFocus
              onChange={(e) => setHoldName(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 py-3" onClick={() => setShowHoldPrompt(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary flex-1 py-3"
                disabled={!holdName.trim() || hold.isPending}
                onClick={() => hold.mutate(holdName.trim())}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Numpad */}
      {numpadFor && (
        <NumpadModal
          initial={numpadFor.current}
          onClose={() => setNumpadFor(null)}
          onConfirm={(v) => {
            if (v > 0) cart.setQty(numpadFor.productId, v);
            setNumpadFor(null);
          }}
        />
      )}
    </div>
  );
}

/** Big numpad popup for entering a quantity by tap. */
function NumpadModal({
  initial,
  onClose,
  onConfirm,
}: {
  initial: number;
  onClose: () => void;
  onConfirm: (n: number) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(String(initial));

  function press(s: string) {
    if (s === '.' && text.includes('.')) return;
    if (text === '0' && s !== '.') setText(s);
    else setText(text + s);
  }
  function back() {
    setText(text.length <= 1 ? '0' : text.slice(0, -1));
  }
  function confirm() {
    const n = parseFloat(text);
    if (!isNaN(n)) onConfirm(Math.round(n * 100) / 100);
  }

  const keys = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['.', '0', '⌫'],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-4 w-full max-w-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold">{t('common.qty')}</span>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-end text-3xl font-bold mb-3">
          {text}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {keys.flat().map((k) => (
            <button
              key={k}
              className="h-16 rounded-lg bg-slate-100 active:bg-slate-200 text-2xl font-semibold grid place-items-center"
              onClick={() => (k === '⌫' ? back() : press(k))}
            >
              {k === '⌫' ? <Delete size={22} /> : k}
            </button>
          ))}
        </div>
        <button
          className="w-full mt-3 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-lg font-bold py-4 rounded-lg"
          onClick={confirm}
        >
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
}
