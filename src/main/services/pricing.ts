/**
 * Pure pricing engine. No DB, no I/O. All inputs are numbers; all outputs are numbers.
 * Tested exhaustively.
 */

export interface CartLineInput {
  productId: number;
  name: string;
  qty: number;
  unitPrice: number;
  /** Per-line discount as absolute amount subtracted from (qty*unitPrice) */
  lineDiscount?: number;
  /** Tax rate as percent (e.g. 16 for 16%). */
  taxRate: number;
}

export interface ComputedLine {
  productId: number;
  name: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  taxRate: number;
  /** Base = qty*unitPrice - lineDiscount (before tax, before order discount) */
  base: number;
  taxAmount: number;
  lineTotal: number;
}

export type OrderDiscount =
  | { type: 'none' }
  | { type: 'amount'; amount: number }
  | { type: 'percent'; percent: number };

export interface CartTotals {
  lines: ComputedLine[];
  subtotal: number; // sum of line bases (after line discount, before tax, before order discount)
  discountTotal: number; // line discounts + order discount portion
  taxTotal: number;
  grandTotal: number;
}

export function round2(n: number): number {
  // Number.EPSILON nudge so 1.005 rounds to 1.01, not 1 (floating-point quirk).
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotals(
  lines: CartLineInput[],
  orderDiscount: OrderDiscount = { type: 'none' },
): CartTotals {
  const computedBases: { base: number; taxRate: number; line: CartLineInput; lineDiscount: number }[] = [];
  let linesDiscount = 0;
  let subtotal = 0;

  for (const l of lines) {
    if (l.qty <= 0) throw new Error(`Invalid qty for product ${l.productId}`);
    if (l.unitPrice < 0) throw new Error(`Invalid price for product ${l.productId}`);
    const gross = l.qty * l.unitPrice;
    const lineDiscount = Math.max(0, Math.min(l.lineDiscount ?? 0, gross));
    linesDiscount += lineDiscount;
    const base = gross - lineDiscount;
    subtotal += base;
    computedBases.push({ base, taxRate: l.taxRate, line: l, lineDiscount });
  }

  // Order discount distributed proportionally across line bases.
  let orderDiscountAmount = 0;
  if (orderDiscount.type === 'amount') {
    orderDiscountAmount = Math.max(0, Math.min(orderDiscount.amount, subtotal));
  } else if (orderDiscount.type === 'percent') {
    orderDiscountAmount = (Math.max(0, Math.min(orderDiscount.percent, 100)) / 100) * subtotal;
  }

  const discountRatio = subtotal > 0 ? orderDiscountAmount / subtotal : 0;

  const computedLines: ComputedLine[] = [];
  let taxTotal = 0;

  for (const c of computedBases) {
    const effBase = c.base * (1 - discountRatio);
    const taxAmount = round2((effBase * c.taxRate) / 100);
    const lineTotal = round2(effBase + taxAmount);
    taxTotal += taxAmount;
    computedLines.push({
      productId: c.line.productId,
      name: c.line.name,
      qty: c.line.qty,
      unitPrice: c.line.unitPrice,
      lineDiscount: round2(c.lineDiscount),
      taxRate: c.taxRate,
      base: round2(effBase),
      taxAmount,
      lineTotal,
    });
  }

  const subtotalR = round2(subtotal - orderDiscountAmount);
  const taxTotalR = round2(taxTotal);
  const grandTotal = round2(subtotalR + taxTotalR);
  const discountTotal = round2(linesDiscount + orderDiscountAmount);

  return {
    lines: computedLines,
    subtotal: subtotalR,
    discountTotal,
    taxTotal: taxTotalR,
    grandTotal,
  };
}

export interface PaymentInput {
  method: 'cash' | 'card' | 'bank_transfer' | 'credit' | 'check';
  amount: number;
  reference?: string;
}

export interface PaymentResult {
  paidTotal: number;
  changeDue: number;
  shortfall: number;
}

export function computePayments(payments: PaymentInput[], grandTotal: number): PaymentResult {
  const paidTotal = round2(payments.reduce((s, p) => s + p.amount, 0));
  const diff = round2(paidTotal - grandTotal);
  return {
    paidTotal,
    changeDue: diff > 0 ? diff : 0,
    shortfall: diff < 0 ? -diff : 0,
  };
}
