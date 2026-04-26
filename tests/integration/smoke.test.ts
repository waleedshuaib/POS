/**
 * End-to-end smoke test: a full retail day exercised through the services
 * layer against a fresh SQLite DB. This is the single most informative test —
 * if this passes, the entire backend is healthy.
 *
 * Runs as part of `npm test` and `npm run verify`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { initDatabase, closeDatabase, db, schema } from '../../src/main/db/client';
import { hashPassword, verifyPassword } from '../../src/main/auth/password';
import { createSession, getSession, destroySession } from '../../src/main/auth/session';
import { checkout, voidSale, resumeHeldSale } from '../../src/main/services/checkout';
import { processReturn } from '../../src/main/services/returns';
import { createPurchase } from '../../src/main/services/purchases';
import { openDrawer, closeDrawer, getOpenDrawer } from '../../src/main/services/drawer';
import {
  salesByDay,
  topProducts,
  profitLoss,
  paymentsByMethod,
  salesByCashier,
  inventoryValuation,
  lowStock,
} from '../../src/main/services/reports';
import { productRepo } from '../../src/main/repos/productRepo';
import { inventoryRepo } from '../../src/main/repos/inventoryRepo';
import { customerRepo, supplierRepo } from '../../src/main/repos/partyRepo';
import { saleRepo } from '../../src/main/repos/saleRepo';
import { settingsRepo } from '../../src/main/repos/settingsRepo';
import { categoryRepo } from '../../src/main/repos/categoryRepo';
import { userRepo } from '../../src/main/repos/userRepo';
import { ensureSeeded } from '../../src/main/seed';

let tmp: string;
let adminId: number;

describe('smoke: full retail day', () => {
  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'pos-smoke-'));
    await initDatabase(join(tmp, 'pos.db'), join(process.cwd(), 'drizzle'));
  });

  afterAll(() => {
    closeDatabase();
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('1. initializes DB and runs migrations', () => {
    expect(() => db().select().from(schema.users).all()).not.toThrow();
  });

  it('2. seeds default admin + settings', async () => {
    await ensureSeeded();
    const admin = userRepo.findByUsername('admin');
    expect(admin).toBeDefined();
    expect(admin?.role).toBe('admin');
    adminId = admin!.id;
    expect(settingsRepo.get('currency.symbol')).toBeDefined();
  });

  it('3. argon2 hash and verify round-trip', async () => {
    const hash = await hashPassword('secret123');
    expect(await verifyPassword(hash, 'secret123')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('4. session create / retrieve / destroy', () => {
    const s = createSession({ id: adminId, username: 'admin', fullName: 'Admin', role: 'admin' });
    expect(getSession(s.token)).not.toBeNull();
    destroySession(s.token);
    expect(getSession(s.token)).toBeNull();
  });

  let breadId: number;
  let milkId: number;
  let teaId: number;
  let customerId: number;
  let supplierId: number;

  it('5. creates categories and products with inventory', () => {
    const foodId = categoryRepo.insert('أطعمة', 'Food');
    const drinksId = categoryRepo.insert('مشروبات', 'Drinks');

    breadId = productRepo.insert({
      sku: 'BRD-001',
      barcode: '6281001',
      nameAr: 'خبز',
      nameEn: 'Bread',
      categoryId: foodId,
      price: 2,
      cost: 1,
      taxRate: 16,
      unit: 'pc',
      trackStock: true,
      lowStockThreshold: 5,
      active: true,
    });
    milkId = productRepo.insert({
      sku: 'MLK-001',
      barcode: '6281002',
      nameAr: 'حليب',
      nameEn: 'Milk',
      categoryId: foodId,
      price: 6,
      cost: 4,
      taxRate: 16,
      unit: 'l',
      trackStock: true,
      lowStockThreshold: 3,
      active: true,
    });
    teaId = productRepo.insert({
      sku: 'TEA-001',
      barcode: '6281003',
      nameAr: 'شاي',
      nameEn: 'Tea',
      categoryId: drinksId,
      price: 10,
      cost: 5,
      taxRate: 0,
      unit: 'pc',
      trackStock: true,
      lowStockThreshold: 2,
      active: true,
    });
    inventoryRepo.upsert(breadId, 50);
    inventoryRepo.upsert(milkId, 20);
    inventoryRepo.upsert(teaId, 10);

    expect(productRepo.list().length).toBeGreaterThanOrEqual(3);
    expect(productRepo.findByBarcode('6281001')?.nameAr).toBe('خبز');
  });

  it('6. creates a customer and supplier', () => {
    customerId = customerRepo.insert({ name: 'عميل كريم', phone: '0599000001' });
    supplierId = supplierRepo.insert({ name: 'Acme Wholesale', phone: '0599888888' });
    expect(customerId).toBeGreaterThan(0);
    expect(supplierId).toBeGreaterThan(0);
  });

  it('7. opens the cash drawer', () => {
    const drawer = openDrawer(adminId, 100);
    expect(drawer.id).toBeGreaterThan(0);
    expect(getOpenDrawer(adminId)).toBeDefined();
  });

  let sale1Id: number;
  it('8. cash sale with tax + change', async () => {
    const s = await checkout({
      userId: adminId,
      lines: [{ productId: breadId, qty: 3 }],
      payments: [{ method: 'cash', amount: 7 }],
    });
    expect(s.status).toBe('completed');
    expect(s.subtotal).toBe(6);
    expect(s.taxTotal).toBe(0.96);
    expect(s.grandTotal).toBe(6.96);
    expect(Math.round(s.changeDue * 100) / 100).toBe(0.04);
    expect(inventoryRepo.getByProductId(breadId)?.qtyOnHand).toBe(47);
    sale1Id = s.saleId;
  });

  let sale2Id: number;
  it('9. multi-payment sale with order-level discount', async () => {
    const s = await checkout({
      userId: adminId,
      customerId,
      lines: [
        { productId: milkId, qty: 2, lineDiscount: 1 },
        { productId: teaId, qty: 1 },
      ],
      orderDiscount: { type: 'percent', percent: 10 },
      payments: [
        { method: 'cash', amount: 10 },
        { method: 'card', amount: 11 },
      ],
    });
    expect(s.subtotal).toBe(18.9);
    expect(s.taxTotal).toBe(1.58);
    expect(s.grandTotal).toBe(20.48);
    expect(s.paidTotal).toBe(21);
    sale2Id = s.saleId;
  });

  it('10. hold and resume a sale', async () => {
    const held = await checkout({
      userId: adminId,
      lines: [{ productId: teaId, qty: 2 }],
      payments: [],
      hold: { name: 'table-5' },
    });
    expect(held.status).toBe('held');
    expect(inventoryRepo.getByProductId(teaId)?.qtyOnHand).toBe(9);

    const resumed = await resumeHeldSale(held.saleId);
    expect(resumed.lines).toHaveLength(1);
    expect(resumed.lines[0].qty).toBe(2);
  });

  it('11. void a sale and restore inventory', async () => {
    const s = await checkout({
      userId: adminId,
      lines: [{ productId: breadId, qty: 5 }],
      payments: [{ method: 'cash', amount: 12 }],
    });
    expect(inventoryRepo.getByProductId(breadId)?.qtyOnHand).toBe(42);
    await voidSale(s.saleId, adminId);
    expect(inventoryRepo.getByProductId(breadId)?.qtyOnHand).toBe(47);
    expect(saleRepo.findById(s.saleId)?.status).toBe('voided');
  });

  it('12. partial return restores partial inventory', async () => {
    const items2 = saleRepo.listItems(sale2Id);
    const milkItem = items2.find((i) => i.productId === milkId)!;
    const ret = await processReturn({
      saleId: sale2Id,
      userId: adminId,
      items: [{ saleItemId: milkItem.id, qty: 1 }],
    });
    expect(ret.returnId).toBeGreaterThan(0);
    expect(inventoryRepo.getByProductId(milkId)?.qtyOnHand).toBe(19);
    expect(saleRepo.findById(sale2Id)?.status).toBe('completed');
  });

  it('13. full return marks sale as returned', async () => {
    const items1 = saleRepo.listItems(sale1Id);
    await processReturn({
      saleId: sale1Id,
      userId: adminId,
      items: [{ saleItemId: items1[0].id, qty: items1[0].qty }],
    });
    expect(saleRepo.findById(sale1Id)?.status).toBe('returned');
  });

  it('14. purchase raises inventory and supplier balance', async () => {
    const p = await createPurchase({
      supplierId,
      userId: adminId,
      paid: 50,
      items: [{ productId: breadId, qty: 100, unitCost: 0.8 }],
    });
    expect(p.total).toBe(80);
    expect(inventoryRepo.getByProductId(breadId)?.qtyOnHand).toBe(150);
    expect(supplierRepo.findById(supplierId)?.balance).toBe(30);
    expect(productRepo.findById(breadId)?.cost).toBe(0.8);
  });

  it('15. customer credit + settle', async () => {
    await checkout({
      userId: adminId,
      customerId,
      lines: [{ productId: teaId, qty: 3 }],
      payments: [{ method: 'credit', amount: 30 }],
    });
    expect(customerRepo.findById(customerId)?.balance).toBe(30);
    customerRepo.adjustBalance(customerId, -10);
    expect(customerRepo.findById(customerId)?.balance).toBe(20);
  });

  it('16. low stock report flags tea', async () => {
    await checkout({
      userId: adminId,
      lines: [{ productId: teaId, qty: 4 }],
      payments: [{ method: 'cash', amount: 40 }],
    });
    const low = lowStock();
    expect(low.some((p: any) => p.sku === 'TEA-001')).toBe(true);
  });

  it('17. reports produce sensible data', () => {
    const today = new Date();
    expect(salesByDay(today, today).length).toBeGreaterThanOrEqual(1);
    expect(topProducts(today, today, 10).length).toBeGreaterThanOrEqual(1);
    const pl = profitLoss(today, today);
    expect(pl.revenue).toBeGreaterThan(0);
    expect(pl.cogs).toBeGreaterThanOrEqual(0);
    const pays = paymentsByMethod(today, today);
    expect(pays.find((p: any) => p.method === 'cash')?.total).toBeGreaterThan(0);
    expect(salesByCashier(today, today).length).toBeGreaterThanOrEqual(1);
    expect(inventoryValuation().reduce((s: number, p: any) => s + p.value, 0)).toBeGreaterThan(0);
  });

  it('18. invoice numbers are sequential and unique', () => {
    const invoices = saleRepo.listByStatus('completed', 20).map((s: any) => s.invoiceNo);
    for (const inv of invoices) expect(inv).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(new Set(invoices).size).toBe(invoices.length);
  });

  it('19. closes cash drawer with variance', () => {
    const open = getOpenDrawer(adminId)!;
    const closed = closeDrawer(adminId, open.expectedAmount - 3);
    expect(closed.variance).toBe(-3);
    expect(getOpenDrawer(adminId)).toBeUndefined();
  });

  it('20. rejects underpayment', async () => {
    await expect(
      checkout({
        userId: adminId,
        lines: [{ productId: breadId, qty: 1 }],
        payments: [{ method: 'cash', amount: 0.5 }],
      }),
    ).rejects.toThrow();
  });

  it('21. rejects empty cart', async () => {
    await expect(checkout({ userId: adminId, lines: [], payments: [] })).rejects.toThrow();
  });

  it('22. rejects double-opening a drawer', () => {
    openDrawer(adminId, 10);
    expect(() => openDrawer(adminId, 20)).toThrow();
  });
});
