import { describe, it, expect } from 'vitest';
import { useTestDb, adminId } from '../helpers/db';
import { db, schema } from '../../src/main/db/client';
import { checkout } from '../../src/main/services/checkout';
import { processReturn } from '../../src/main/services/returns';
import { inventoryRepo } from '../../src/main/repos/inventoryRepo';
import { saleRepo } from '../../src/main/repos/saleRepo';

function addProduct(name: string, price: number, stock = 10): number {
  const res = db()
    .insert(schema.products)
    .values({ sku: `S-${Math.random().toString(36).slice(2, 8)}`, nameAr: name, nameEn: name, price, cost: price / 2 })
    .run();
  const id = Number(res.lastInsertRowid);
  inventoryRepo.upsert(id, stock);
  return id;
}

describe('returns service', () => {
  useTestDb();

  it('processes a partial return and restores inventory', async () => {
    const p = addProduct('Widget', 10, 5);
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 3 }],
      payments: [{ method: 'cash', amount: 30 }],
    });
    const items = saleRepo.listItems(sale.saleId);

    await processReturn({
      saleId: sale.saleId,
      userId: adminId,
      items: [{ saleItemId: items[0].id, qty: 1 }],
    });

    expect(inventoryRepo.getByProductId(p)?.qtyOnHand).toBe(3); // 5 - 3 + 1
    const after = saleRepo.findById(sale.saleId);
    expect(after?.status).toBe('completed'); // not full return
  });

  it('marks sale returned when fully returned', async () => {
    const p = addProduct('Full', 10, 5);
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 2 }],
      payments: [{ method: 'cash', amount: 20 }],
    });
    const items = saleRepo.listItems(sale.saleId);
    await processReturn({
      saleId: sale.saleId,
      userId: adminId,
      items: [{ saleItemId: items[0].id, qty: 2 }],
    });
    const after = saleRepo.findById(sale.saleId);
    expect(after?.status).toBe('returned');
  });

  it('rejects returning more than sold', async () => {
    const p = addProduct('Over', 10);
    const sale = await checkout({
      userId: adminId,
      lines: [{ productId: p, qty: 1 }],
      payments: [{ method: 'cash', amount: 10 }],
    });
    const items = saleRepo.listItems(sale.saleId);
    await expect(
      processReturn({
        saleId: sale.saleId,
        userId: adminId,
        items: [{ saleItemId: items[0].id, qty: 5 }],
      }),
    ).rejects.toThrow();
  });
});
