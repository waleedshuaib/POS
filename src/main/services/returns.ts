import { eq, inArray } from 'drizzle-orm';
import { rawDb, db, schema } from '../db/client';
import { saleRepo } from '../repos/saleRepo';
import { inventoryRepo } from '../repos/inventoryRepo';
import { productRepo } from '../repos/productRepo';
import { auditRepo } from '../repos/auditRepo';

export interface ReturnInput {
  saleId: number;
  userId: number;
  reason?: string;
  items: Array<{ saleItemId: number; qty: number }>;
}

export async function processReturn(input: ReturnInput): Promise<{ returnId: number; total: number }> {
  const sale = saleRepo.findById(input.saleId);
  if (!sale) throw new Error('Sale not found');
  if (sale.status === 'voided') throw new Error('Sale is voided');

  const allItems = saleRepo.listItems(input.saleId);
  const sqlite = rawDb();

  const result = sqlite.transaction(() => {
    let total = 0;
    const returnIns = db()
      .insert(schema.returns)
      .values({ saleId: input.saleId, userId: input.userId, reason: input.reason ?? null, total: 0 })
      .run();
    const returnId = Number(returnIns.lastInsertRowid);

    for (const r of input.items) {
      const si = allItems.find((i) => i.id === r.saleItemId);
      if (!si) throw new Error(`Sale item ${r.saleItemId} not in sale`);
      if (r.qty <= 0 || r.qty > si.qty) throw new Error(`Invalid return qty for item ${r.saleItemId}`);

      const perUnit = si.lineTotal / si.qty;
      const amount = Math.round(perUnit * r.qty * 100) / 100;
      total += amount;

      db().insert(schema.returnItems).values({ returnId, saleItemId: si.id, qty: r.qty, amount }).run();

      const product = productRepo.findById(si.productId);
      if (product && product.trackStock) {
        inventoryRepo.adjust(si.productId, r.qty);
        inventoryRepo.logMovement({
          productId: si.productId,
          delta: r.qty,
          reason: 'return',
          refType: 'return',
          refId: returnId,
          userId: input.userId,
        });
      }
    }

    db().update(schema.returns).set({ total }).where(eq(schema.returns.id, returnId)).run();

    // Aggregate ALL returns for this sale (not just this one) to know if the
    // sale is fully returned now.
    const allReturnsForSale = db()
      .select({ id: schema.returns.id })
      .from(schema.returns)
      .where(eq(schema.returns.saleId, input.saleId))
      .all();
    const ids = allReturnsForSale.map((r) => r.id);
    const returnedSoFar = ids.length
      ? db()
          .select({ qty: schema.returnItems.qty })
          .from(schema.returnItems)
          .where(inArray(schema.returnItems.returnId, ids))
          .all()
          .reduce((s, i) => s + i.qty, 0)
      : 0;
    const soldQty = allItems.reduce((s, i) => s + i.qty, 0);
    if (returnedSoFar >= soldQty - 1e-9) saleRepo.updateStatus(input.saleId, 'returned');

    auditRepo.log({ userId: input.userId, action: 'return', entity: 'return', entityId: returnId, payload: { saleId: input.saleId, total } });

    return { returnId, total: Math.round(total * 100) / 100 };
  });

  return result();
}
