import { rawDb, db, schema } from '../db/client';
import { inventoryRepo } from '../repos/inventoryRepo';
import { supplierRepo } from '../repos/partyRepo';
import { productRepo } from '../repos/productRepo';
import { auditRepo } from '../repos/auditRepo';

export interface PurchaseInput {
  supplierId: number;
  userId: number;
  invoiceRef?: string;
  paid?: number;
  notes?: string;
  items: Array<{ productId: number; qty: number; unitCost: number }>;
}

export async function createPurchase(input: PurchaseInput): Promise<{ purchaseId: number; total: number }> {
  if (input.items.length === 0) throw new Error('Empty purchase');
  const supplier = supplierRepo.findById(input.supplierId);
  if (!supplier) throw new Error('Supplier not found');

  const sqlite = rawDb();
  return sqlite.transaction(() => {
    let subtotal = 0;
    for (const it of input.items) {
      if (it.qty <= 0) throw new Error('Invalid qty');
      if (it.unitCost < 0) throw new Error('Invalid unit cost');
      subtotal += it.qty * it.unitCost;
    }
    const total = Math.round(subtotal * 100) / 100;
    const paid = input.paid ?? 0;

    const pIns = db()
      .insert(schema.purchases)
      .values({
        supplierId: input.supplierId,
        invoiceRef: input.invoiceRef ?? null,
        subtotal: total,
        taxTotal: 0,
        total,
        paid,
        status: 'completed',
        notes: input.notes ?? null,
        userId: input.userId,
      })
      .run();
    const purchaseId = Number(pIns.lastInsertRowid);

    for (const it of input.items) {
      const lineTotal = Math.round(it.qty * it.unitCost * 100) / 100;
      db().insert(schema.purchaseItems).values({ purchaseId, ...it, lineTotal }).run();

      const product = productRepo.findById(it.productId);
      if (product && product.trackStock) {
        inventoryRepo.adjust(it.productId, it.qty);
        inventoryRepo.logMovement({
          productId: it.productId,
          delta: it.qty,
          reason: 'purchase',
          refType: 'purchase',
          refId: purchaseId,
          userId: input.userId,
        });
      }
      // Update last cost on product
      if (product) productRepo.update(product.id, { cost: it.unitCost });
    }

    const owed = total - paid;
    if (owed !== 0) supplierRepo.adjustBalance(input.supplierId, owed);

    auditRepo.log({ userId: input.userId, action: 'purchase.create', entity: 'purchase', entityId: purchaseId, payload: { total, paid } });

    return { purchaseId, total };
  })();
}
