import { rawDb, db, schema } from '../db/client';
import { eq } from 'drizzle-orm';
import { productRepo } from '../repos/productRepo';
import { inventoryRepo } from '../repos/inventoryRepo';
import { saleRepo } from '../repos/saleRepo';
import { auditRepo } from '../repos/auditRepo';
import { customerRepo } from '../repos/partyRepo';
import { settingsRepo } from '../repos/settingsRepo';
import {
  computeTotals,
  computePayments,
  type CartLineInput,
  type OrderDiscount,
  type PaymentInput,
} from './pricing';

export interface CheckoutInput {
  userId: number;
  customerId?: number | null;
  lines: Array<{ productId: number; qty: number; unitPriceOverride?: number; lineDiscount?: number }>;
  orderDiscount?: OrderDiscount;
  payments: PaymentInput[];
  notes?: string | null;
  hold?: { name: string } | null;
}

export interface CheckoutResult {
  saleId: number;
  invoiceNo: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  changeDue: number;
  status: 'completed' | 'held';
}

export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  if (input.lines.length === 0) throw new Error('Empty cart');

  // Load products & build pricing lines
  const priceLines: CartLineInput[] = [];
  const productMap = new Map<number, ReturnType<typeof productRepo.findById>>();
  for (const l of input.lines) {
    const p = productRepo.findById(l.productId);
    if (!p) throw new Error(`Unknown product: ${l.productId}`);
    productMap.set(l.productId, p);
    priceLines.push({
      productId: p.id,
      name: p.nameAr,
      qty: l.qty,
      unitPrice: l.unitPriceOverride ?? p.price,
      lineDiscount: l.lineDiscount ?? 0,
      taxRate: p.taxRate,
    });
  }

  const totals = computeTotals(priceLines, input.orderDiscount ?? { type: 'none' });

  const isHeld = !!input.hold;
  const payments = isHeld ? [] : input.payments;
  const pay = computePayments(payments, totals.grandTotal);

  if (!isHeld && pay.shortfall > 0.009) {
    throw new Error(`Payment short by ${pay.shortfall.toFixed(2)}`);
  }

  const prefix = settingsRepo.get('invoice.prefix') ?? 'INV';

  const sqlite = rawDb();
  const tx = sqlite.transaction(() => {
    const invoiceNo = isHeld ? `HOLD-${Date.now()}` : saleRepo.nextInvoiceNo(prefix);

    const saleId = saleRepo.insertSaleWithItems({
      invoiceNo,
      customerId: input.customerId ?? null,
      userId: input.userId,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      paidTotal: pay.paidTotal,
      changeDue: pay.changeDue,
      status: isHeld ? 'held' : 'completed',
      heldName: input.hold?.name ?? null,
      notes: input.notes ?? null,
      items: totals.lines.map((l) => ({
        productId: l.productId,
        nameAtSale: productMap.get(l.productId)?.nameAr ?? l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineDiscount: l.lineDiscount,
        taxRate: l.taxRate,
        taxAmount: l.taxAmount,
        lineTotal: l.lineTotal,
      })),
      payments: payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference })),
    });

    if (!isHeld) {
      // Decrement inventory + log movements
      for (const l of totals.lines) {
        const p = productMap.get(l.productId);
        if (p && p.trackStock) {
          inventoryRepo.adjust(l.productId, -l.qty);
          inventoryRepo.logMovement({
            productId: l.productId,
            delta: -l.qty,
            reason: 'sale',
            refType: 'sale',
            refId: saleId,
            userId: input.userId,
          });
        }
      }
      // Customer credit if paid with credit method
      const credit = payments.filter((p) => p.method === 'credit').reduce((s, p) => s + p.amount, 0);
      if (credit > 0 && input.customerId) customerRepo.adjustBalance(input.customerId, credit);

      // Update open drawer expected amount with cash portion
      const cash = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0) - pay.changeDue;
      if (cash !== 0) {
        const open = db().select().from(schema.cashDrawers).where(eq(schema.cashDrawers.status, 'open')).get();
        if (open) {
          db()
            .update(schema.cashDrawers)
            .set({ expectedAmount: open.expectedAmount + cash })
            .where(eq(schema.cashDrawers.id, open.id))
            .run();
        }
      }
    }

    auditRepo.log({
      userId: input.userId,
      action: isHeld ? 'sale.hold' : 'sale.complete',
      entity: 'sale',
      entityId: saleId,
      payload: { invoiceNo, grandTotal: totals.grandTotal },
    });

    return {
      saleId,
      invoiceNo,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      paidTotal: pay.paidTotal,
      changeDue: pay.changeDue,
      status: isHeld ? ('held' as const) : ('completed' as const),
    };
  });

  return tx();
}

export async function voidSale(saleId: number, userId: number): Promise<void> {
  const sale = saleRepo.findById(saleId);
  if (!sale) throw new Error('Sale not found');
  if (sale.status !== 'completed') throw new Error('Only completed sales can be voided');

  const sqlite = rawDb();
  const tx = sqlite.transaction(() => {
    const items = saleRepo.listItems(saleId);
    for (const item of items) {
      const p = productRepo.findById(item.productId);
      if (p && p.trackStock) {
        inventoryRepo.adjust(item.productId, item.qty);
        inventoryRepo.logMovement({
          productId: item.productId,
          delta: item.qty,
          reason: 'void',
          refType: 'sale',
          refId: saleId,
          userId,
        });
      }
    }
    saleRepo.updateStatus(saleId, 'voided');
    auditRepo.log({ userId, action: 'sale.void', entity: 'sale', entityId: saleId });
  });
  tx();
}

export async function resumeHeldSale(saleId: number): Promise<{
  lines: Array<{ productId: number; qty: number; unitPrice: number; lineDiscount: number }>;
  customerId: number | null;
  notes: string | null;
}> {
  const sale = saleRepo.findById(saleId);
  if (!sale || sale.status !== 'held') throw new Error('Held sale not found');
  const items = saleRepo.listItems(saleId);
  const sqlite = rawDb();
  const tx = sqlite.transaction(() => {
    db().delete(schema.sales).where(eq(schema.sales.id, saleId)).run();
  });
  tx();
  return {
    lines: items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineDiscount: i.lineDiscount,
    })),
    customerId: sale.customerId,
    notes: sale.notes,
  };
}
