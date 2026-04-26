import { describe, it, expect } from 'vitest';
import { useTestDb, adminId } from '../helpers/db';
import { db, schema } from '../../src/main/db/client';
import { checkout, voidSale, resumeHeldSale } from '../../src/main/services/checkout';
import { inventoryRepo } from '../../src/main/repos/inventoryRepo';

function addProduct(opts: { name: string; price: number; tax?: number; stock?: number; barcode?: string }): number {
  const res = db()
    .insert(schema.products)
    .values({
      sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
      barcode: opts.barcode ?? null,
      nameAr: opts.name,
      nameEn: opts.name,
      price: opts.price,
      cost: opts.price / 2,
      taxRate: opts.tax ?? 0,
      trackStock: true,
    })
    .run();
  const id = Number(res.lastInsertRowid);
  inventoryRepo.upsert(id, opts.stock ?? 10);
  return id;
}

describe('checkout service', () => {
  useTestDb();

  it('completes a basic cash sale and decrements inventory', async () => {
    const p = addProduct({ name: 'A', price: 10, stock: 5 });
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 2 }],
      payments: [{ method: 'cash', amount: 20 }],
    });
    expect(sale.grandTotal).toBe(20);
    expect(sale.status).toBe('completed');
    expect(inventoryRepo.getByProductId(p)?.qtyOnHand).toBe(3);
  });

  it('handles multi-payment', async () => {
    const p = addProduct({ name: 'B', price: 50 });
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      payments: [
        { method: 'cash', amount: 30 },
        { method: 'card', amount: 20 },
      ],
    });
    expect(sale.paidTotal).toBe(50);
    expect(sale.changeDue).toBe(0);
  });

  it('computes change due on overpayment', async () => {
    const p = addProduct({ name: 'C', price: 15 });
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      payments: [{ method: 'cash', amount: 20 }],
    });
    expect(sale.changeDue).toBe(5);
  });

  it('fails on underpayment', async () => {
    const p = addProduct({ name: 'D', price: 100 });
    await expect(
      checkout({
        userId: adminId,
        lines: [{ productId: p, qty: 1 }],
        payments: [{ method: 'cash', amount: 50 }],
      }),
    ).rejects.toThrow();
  });

  it('applies tax correctly', async () => {
    const p = addProduct({ name: 'E', price: 100, tax: 16 });
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      payments: [{ method: 'cash', amount: 116 }],
    });
    expect(sale.taxTotal).toBe(16);
    expect(sale.grandTotal).toBe(116);
  });

  it('applies order-level percent discount', async () => {
    const p = addProduct({ name: 'F', price: 100 });
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      orderDiscount: { type: 'percent', percent: 10 },
      payments: [{ method: 'cash', amount: 90 }],
    });
    expect(sale.grandTotal).toBe(90);
    expect(sale.discountTotal).toBe(10);
  });

  it('hold then resume', async () => {
    const p = addProduct({ name: 'G', price: 20 });
    const held = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 3 }],
      payments: [],
      hold: { name: 'test hold' },
    });
    expect(held.status).toBe('held');
    // inventory should not have been decremented
    expect(inventoryRepo.getByProductId(p)?.qtyOnHand).toBe(10);

    const resumed = await resumeHeldSale(held.saleId);
    expect(resumed.lines).toHaveLength(1);
    expect(resumed.lines[0].qty).toBe(3);
  });

  it('void restores inventory', async () => {
    const p = addProduct({ name: 'H', price: 10, stock: 5 });
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 2 }],
      payments: [{ method: 'cash', amount: 20 }],
    });
    expect(inventoryRepo.getByProductId(p)?.qtyOnHand).toBe(3);
    await voidSale(sale.saleId, adminId);
    expect(inventoryRepo.getByProductId(p)?.qtyOnHand).toBe(5);
  });

  it('generates sequential invoice numbers', async () => {
    const p = addProduct({ name: 'I', price: 10 });
    const s1 = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      payments: [{ method: 'cash', amount: 10 }],
    });
    const s2 = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      payments: [{ method: 'cash', amount: 10 }],
    });
    expect(s1.invoiceNo).not.toBe(s2.invoiceNo);
    expect(s1.invoiceNo.startsWith('INV-')).toBe(true);
  });
});
