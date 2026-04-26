import { describe, it, expect } from 'vitest';
import { useTestDb, adminId } from '../helpers/db';
import { db, schema } from '../../src/main/db/client';
import { checkout } from '../../src/main/services/checkout';
import { inventoryRepo } from '../../src/main/repos/inventoryRepo';
import { profitLoss, salesByDay, topProducts, paymentsByMethod } from '../../src/main/services/reports';

function addProduct(name: string, price: number, cost: number, stock = 100): number {
  const res = db()
    .insert(schema.products)
    .values({ sku: `R-${Math.random().toString(36).slice(2, 8)}`, nameAr: name, nameEn: name, price, cost })
    .run();
  const id = Number(res.lastInsertRowid);
  inventoryRepo.upsert(id, stock);
  return id;
}

describe('reports', () => {
  useTestDb();

  it('computes P&L over a range', async () => {
    const p = addProduct('P', 100, 60);
    await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 2 }],
      payments: [{ method: 'cash', amount: 200 }],
    });
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const pl = profitLoss(from, to);
    expect(pl.revenue).toBe(200);
    expect(pl.cogs).toBe(120);
    expect(pl.grossProfit).toBe(80);
  });

  it('groups sales by day', async () => {
    const p = addProduct('Q', 10, 5);
    await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      payments: [{ method: 'cash', amount: 10 }],
    });
    const today = new Date();
    const rows = salesByDay(today, today);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].total).toBe(10);
  });

  it('returns top products', async () => {
    const p1 = addProduct('Top1', 30, 10);
    const p2 = addProduct('Top2', 20, 10);
    await checkout({
      userId: adminId,
      lines: [{ productId: p1, qty: 3 }],
      payments: [{ method: 'cash', amount: 90 }],
    });
    await checkout({
      userId: adminId,
      lines: [{ productId: p2, qty: 5 }],
      payments: [{ method: 'cash', amount: 100 }],
    });
    const today = new Date();
    const rows = topProducts(today, today, 5);
    expect(rows[0].revenue).toBeGreaterThanOrEqual(rows[1].revenue);
  });

  it('totals payments by method', async () => {
    const p = addProduct('Pay', 50, 20);
    await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      payments: [
        { method: 'cash', amount: 30 },
        { method: 'card', amount: 20 },
      ],
    });
    const today = new Date();
    const rows = paymentsByMethod(today, today);
    const byMethod = Object.fromEntries(rows.map((r) => [r.method, r.total]));
    expect(byMethod.cash).toBe(30);
    expect(byMethod.card).toBe(20);
  });
});
