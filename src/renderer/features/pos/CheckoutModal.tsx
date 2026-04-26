import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { currency } from '../../lib/format';
import { Modal } from '../../components/Modal';
import { Plus, Trash2, Banknote, CreditCard, Building2, FileText, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCart } from './cartStore';
import type { PaymentMethod } from '@shared/types';

interface Totals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

interface PaymentRow {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

const METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer', 'credit', 'check'];

const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote size={14} />,
  card: <CreditCard size={14} />,
  bank_transfer: <Building2 size={14} />,
  credit: <Clock size={14} />,
  check: <FileText size={14} />,
};

/** Methods that need a reference (check #, bank ref, card auth code, etc.) */
const NEEDS_REF: ReadonlyArray<PaymentMethod> = ['check', 'bank_transfer'];

export function CheckoutModal({
  open,
  onClose,
  totals,
}: {
  open: boolean;
  onClose: () => void;
  totals: Totals;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const cart = useCart();
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: 'cash', amount: totals.grandTotal }]);
  const [lastSale, setLastSale] = useState<{ saleId: number; invoiceNo: string; changeDue: number } | null>(null);

  const paid = useMemo(
    () => Math.round(payments.reduce((s, p) => s + (isFinite(p.amount) ? p.amount : 0), 0) * 100) / 100,
    [payments],
  );
  const diff = Math.round((paid - totals.grandTotal) * 100) / 100;
  const shortfall = diff < 0 ? -diff : 0;
  const change = diff > 0 ? diff : 0;

  // Client-side validation: every payment row must have a positive amount,
  // and check / bank_transfer must include a non-empty reference.
  const validation = useMemo(() => {
    const errs: string[] = [];
    if (payments.length === 0) errs.push(t('checkout.err.noPayments'));
    payments.forEach((p, i) => {
      if (p.amount <= 0) errs.push(t('checkout.err.invalidAmount', { row: i + 1 }));
      if (NEEDS_REF.includes(p.method) && !(p.reference ?? '').trim()) {
        errs.push(t('checkout.err.referenceRequired', { row: i + 1, method: t(`payment.${p.method}`) }));
      }
    });
    if (shortfall > 0.001) errs.push(t('checkout.err.shortPayment', { amount: shortfall.toFixed(2) }));
    return errs;
  }, [payments, shortfall, t]);

  const checkout = useMutation({
    mutationFn: () =>
      api<{ saleId: number; invoiceNo: string; changeDue: number }>('sales.checkout', {
        customerId: cart.customerId,
        lines: cart.lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPriceOverride: l.unitPrice,
          lineDiscount: l.lineDiscount,
        })),
        orderDiscount: cart.orderDiscount,
        payments: payments
          .filter((p) => p.amount > 0)
          .map((p) => ({ method: p.method, amount: p.amount, reference: p.reference?.trim() || undefined })),
      }),
    onSuccess: (sale) => {
      setLastSale(sale);
      cart.clear();
      qc.invalidateQueries();
    },
  });

  async function printReceipt() {
    if (!lastSale) return;
    await api('printer.printNow', { saleId: lastSale.saleId, language: i18n.language === 'ar' ? 'ar' : 'en' });
  }

  function done() {
    setLastSale(null);
    setPayments([{ method: 'cash', amount: totals.grandTotal }]);
    onClose();
  }

  function updateRow(idx: number, patch: Partial<PaymentRow>) {
    setPayments((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <Modal
      open={open}
      onClose={lastSale ? done : onClose}
      title={t('pos.checkout')}
      size="lg"
      footer={
        lastSale ? (
          <>
            <button className="btn-secondary" onClick={done}>
              {t('common.close')}
            </button>
            <button className="btn-primary" onClick={printReceipt}>
              {t('pos.printReceipt')}
            </button>
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary"
              disabled={validation.length > 0 || checkout.isPending || cart.lines.length === 0}
              onClick={() => checkout.mutate()}
            >
              <CheckCircle2 size={16} />
              {t('pos.completeSale')}
            </button>
          </>
        )
      }
    >
      {lastSale ? (
        <div className="space-y-3 text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <div className="text-green-700 font-bold text-xl">{t('common.success')}</div>
          <div className="text-lg">
            {t('sales.invoice')}: <span className="font-mono font-semibold">{lastSale.invoiceNo}</span>
          </div>
          {lastSale.changeDue > 0 && (
            <div className="text-2xl font-bold text-brand-700">
              {t('pos.change')}: {currency(lastSale.changeDue)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Totals card */}
          <div className="card p-3 bg-slate-50 space-y-1">
            <div className="flex justify-between text-sm">
              <span>{t('common.subtotal')}</span>
              <span>{currency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t('common.tax')}</span>
              <span>{currency(totals.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-slate-200 mt-2 pt-2">
              <span>{t('pos.grandTotal')}</span>
              <span className="text-brand-700">{currency(totals.grandTotal)}</span>
            </div>
          </div>

          {/* Payment rows */}
          <div className="space-y-2">
            <label className="label">{t('pos.payments')}</label>
            {payments.map((p, idx) => {
              const needsRef = NEEDS_REF.includes(p.method);
              return (
                <div key={idx} className="border border-slate-200 rounded-md p-2 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 px-2 text-slate-500">{METHOD_ICON[p.method]}</div>
                    <select
                      className="input flex-1"
                      value={p.method}
                      onChange={(e) => updateRow(idx, { method: e.target.value as PaymentMethod })}
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {t(`payment.${m}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input w-32"
                      type="number"
                      step="0.01"
                      min={0}
                      value={p.amount}
                      onChange={(e) => updateRow(idx, { amount: parseFloat(e.target.value) || 0 })}
                    />
                    <button
                      className="btn-secondary p-2"
                      onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                      title={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {needsRef && (
                    <input
                      className="input"
                      placeholder={
                        p.method === 'check' ? t('checkout.checkNumberPlaceholder') : t('checkout.transferRefPlaceholder')
                      }
                      value={p.reference ?? ''}
                      onChange={(e) => updateRow(idx, { reference: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
            <button
              className="btn-secondary text-sm"
              onClick={() =>
                setPayments([
                  ...payments,
                  { method: 'cash', amount: Math.max(0, totals.grandTotal - paid) },
                ])
              }
            >
              <Plus size={14} /> {t('pos.addPayment')}
            </button>
          </div>

          {/* Tally */}
          <div className="card p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{t('pos.paid')}</span>
              <span className="font-semibold">{currency(paid)}</span>
            </div>
            {shortfall > 0 && (
              <div className="flex justify-between text-red-600">
                <span>{t('pos.shortfall')}</span>
                <span className="font-semibold">{currency(shortfall)}</span>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between text-green-600">
                <span>{t('pos.change')}</span>
                <span className="font-semibold">{currency(change)}</span>
              </div>
            )}
          </div>

          {/* Validation messages */}
          {validation.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-md p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                {t('common.validationErrors')}
              </div>
              <ul className="list-disc ps-5 space-y-0.5">
                {validation.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {checkout.error && (
            <div className="border border-red-200 bg-red-50 text-red-700 rounded-md p-3 text-sm">
              {(checkout.error as Error).message}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
