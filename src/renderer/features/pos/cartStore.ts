import { create } from 'zustand';

export interface CartLine {
  productId: number;
  name: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  taxRate: number;
}

export type OrderDiscount =
  | { type: 'none' }
  | { type: 'amount'; amount: number }
  | { type: 'percent'; percent: number };

interface CartState {
  lines: CartLine[];
  customerId: number | null;
  orderDiscount: OrderDiscount;
  addProduct: (p: { id: number; nameAr: string; nameEn: string; price: number; taxRate: number }, language: 'ar' | 'en') => void;
  removeLine: (productId: number) => void;
  setQty: (productId: number, qty: number) => void;
  setLineDiscount: (productId: number, d: number) => void;
  setUnitPrice: (productId: number, p: number) => void;
  setCustomer: (id: number | null) => void;
  setOrderDiscount: (d: OrderDiscount) => void;
  clear: () => void;
  loadFromHeld: (lines: CartLine[], customerId: number | null) => void;
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  customerId: null,
  orderDiscount: { type: 'none' },
  addProduct: (p, language) => {
    const existing = get().lines.find((l) => l.productId === p.id);
    if (existing) {
      set({
        lines: get().lines.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l)),
      });
    } else {
      set({
        lines: [
          ...get().lines,
          {
            productId: p.id,
            name: language === 'ar' ? p.nameAr : p.nameEn,
            qty: 1,
            unitPrice: p.price,
            lineDiscount: 0,
            taxRate: p.taxRate,
          },
        ],
      });
    }
  },
  removeLine: (productId) => set({ lines: get().lines.filter((l) => l.productId !== productId) }),
  setQty: (productId, qty) =>
    set({ lines: get().lines.map((l) => (l.productId === productId ? { ...l, qty: Math.max(0.01, qty) } : l)) }),
  setLineDiscount: (productId, d) =>
    set({ lines: get().lines.map((l) => (l.productId === productId ? { ...l, lineDiscount: Math.max(0, d) } : l)) }),
  setUnitPrice: (productId, p) =>
    set({ lines: get().lines.map((l) => (l.productId === productId ? { ...l, unitPrice: Math.max(0, p) } : l)) }),
  setCustomer: (id) => set({ customerId: id }),
  setOrderDiscount: (d) => set({ orderDiscount: d }),
  clear: () => set({ lines: [], customerId: null, orderDiscount: { type: 'none' } }),
  loadFromHeld: (lines, customerId) => set({ lines, customerId, orderDiscount: { type: 'none' } }),
}));

export function computeTotals(lines: CartLine[], orderDiscount: OrderDiscount) {
  let subtotal = 0;
  let linesDiscount = 0;
  for (const l of lines) {
    const gross = l.qty * l.unitPrice;
    const disc = Math.max(0, Math.min(l.lineDiscount, gross));
    linesDiscount += disc;
    subtotal += gross - disc;
  }
  let orderDiscAmt = 0;
  if (orderDiscount.type === 'amount') orderDiscAmt = Math.max(0, Math.min(orderDiscount.amount, subtotal));
  else if (orderDiscount.type === 'percent') orderDiscAmt = (Math.max(0, Math.min(orderDiscount.percent, 100)) / 100) * subtotal;

  const ratio = subtotal > 0 ? orderDiscAmt / subtotal : 0;
  let taxTotal = 0;
  for (const l of lines) {
    const gross = l.qty * l.unitPrice;
    const disc = Math.max(0, Math.min(l.lineDiscount, gross));
    const base = (gross - disc) * (1 - ratio);
    taxTotal += (base * l.taxRate) / 100;
  }
  const sub = Math.round((subtotal - orderDiscAmt) * 100) / 100;
  const tax = Math.round(taxTotal * 100) / 100;
  const total = Math.round((sub + tax) * 100) / 100;
  const discountTotal = Math.round((linesDiscount + orderDiscAmt) * 100) / 100;
  return { subtotal: sub, discountTotal, taxTotal: tax, grandTotal: total };
}
