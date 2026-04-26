import { describe, it, expect } from 'vitest';
import { useTestDb, adminId } from '../helpers/db';
import { db, schema } from '../../src/main/db/client';
import { createPurchase } from '../../src/main/services/purchases';
import { inventoryRepo } from '../../src/main/repos/inventoryRepo';
import { supplierRepo } from '../../src/main/repos/partyRepo';
import { eq } from 'drizzle-orm';

describe('purchases service', () => {
  useTestDb();

  it('raises inventory and supplier balance', async () => {
    const supplierId = supplierRepo.insert({ name: 'Acme' });
    const res = db()
      .insert(schema.products)
      .values({ sku: 'X1', nameAr: 'X', nameEn: 'X', price: 10, cost: 5 })
      .run();
    const pid = Number(res.lastInsertRowid);
    inventoryRepo.upsert(pid, 2);

    await createPurchase({
      supplierId,
      userId: adminId,
      paid: 20,
      items: [{ productId: pid, qty: 5, unitCost: 6 }],
    });

    expect(inventoryRepo.getByProductId(pid)?.qtyOnHand).toBe(7);
    const supplier = supplierRepo.findById(supplierId)!;
    // Total 30, paid 20, owed 10
    expect(supplier.balance).toBe(10);
    // Cost is updated
    const updated = db().select().from(schema.products).where(eq(schema.products.id, pid)).get();
    expect(updated?.cost).toBe(6);
  });
});
