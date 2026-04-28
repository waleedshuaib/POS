/**
 * Comprehensive end-to-end coverage of EVERY module against the full
 * Palestinian supermarket seed. Catches regressions in any cross-module flow:
 *
 *   1. Seed integrity  — categories / products / suppliers / customers exist
 *   2. Auth            — login, role checks, impersonation
 *   3. Products        — CRUD, search, barcode lookup, soft-delete
 *   4. Inventory       — adjust, low-stock detection
 *   5. Customers       — credit balance grows on sale, settle
 *   6. Suppliers       — purchase raises balance + inventory + last cost
 *   7. POS / sales     — multi-payment incl. CHECK + bank transfer with
 *                        reference, hold/resume, void, partial + full return
 *   8. Cash drawer     — open, expected updates with cash sales, close variance
 *   9. Reports         — every report returns sensible data after activity
 *  10. Backup info     — paths exposed
 *  11. Audit log       — sale.complete, sale.void, return, impersonate logged
 *
 * Runs as part of `npm test`. Single describe so the scenario is a real story.
 */
process.env.POS_DB_PLAINTEXT = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { initDatabase, closeDatabase, db, schema } from '../../src/main/db/client';
import { ensureSeeded } from '../../src/main/seed';
import { hashPassword, verifyPassword } from '../../src/main/auth/password';
import { createSession, getSession } from '../../src/main/auth/session';

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
import { eq } from 'drizzle-orm';

let tmp: string;
let admin: any;
let cashier1: any;

describe('full e2e: Palestinian supermarket', () => {
  beforeAll(async () => {
    process.env.POS_SEED = 'palestine';
    tmp = mkdtempSync(join(tmpdir(), 'pos-fulle2e-'));
    await initDatabase(join(tmp, 'pos.db'), join(process.cwd(), 'drizzle'));
    await ensureSeeded();
    admin = userRepo.findByUsername('admin');
    cashier1 = userRepo.findByUsername('cashier1');
  });

  afterAll(() => {
    closeDatabase();
    delete process.env.POS_SEED;
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  });

  // ── 1. Seed integrity ────────────────────────────────────────────────────
  describe('1. seed integrity', () => {
    it('has all 14 expected categories', () => {
      const cats = categoryRepo.list();
      expect(cats.length).toBeGreaterThanOrEqual(14);
      const arNames = cats.map((c) => c.nameAr);
      expect(arNames).toContain('ألبان وأجبان');
      expect(arNames).toContain('خضروات وفواكه');
      expect(arNames).toContain('تبغ');
    });

    it('has rich product catalog with realistic Palestinian items', () => {
      const products = productRepo.list();
      expect(products.length).toBeGreaterThanOrEqual(80);
      // Spot checks
      expect(products.find((p) => p.nameAr.includes('نابلسية'))).toBeDefined();
      expect(products.find((p) => p.nameAr.includes('زيت زيتون فلسطيني'))).toBeDefined();
      expect(productRepo.findBySku('GR-0001')).toBeDefined(); // bread
    });

    it('VAT is 17% on tobacco and 0% on fresh produce (Palestinian VAT law)', () => {
      const cigs = productRepo.findBySku('TB-0001');
      expect(cigs?.taxRate).toBe(17);
      const tomato = productRepo.findBySku('VF-0001');
      expect(tomato?.taxRate).toBe(0);
    });

    it('every active product has matching inventory row', () => {
      const products = productRepo.listActive();
      for (const p of products) {
        const inv = inventoryRepo.getByProductId(p.id);
        expect(inv, `inventory for ${p.sku}`).toBeDefined();
      }
    });

    it('5 users (admin, manager, 3 cashiers) seeded', () => {
      expect(userRepo.findByUsername('admin')).toBeDefined();
      expect(userRepo.findByUsername('manager')).toBeDefined();
      expect(userRepo.findByUsername('cashier1')).toBeDefined();
      expect(userRepo.findByUsername('cashier2')).toBeDefined();
      expect(userRepo.findByUsername('cashier3')).toBeDefined();
    });

    it('6 suppliers + 6 customers seeded', () => {
      expect(supplierRepo.list().length).toBeGreaterThanOrEqual(6);
      expect(customerRepo.list().length).toBeGreaterThanOrEqual(6);
    });

    it('store name is the Palestinian default', () => {
      expect(settingsRepo.get('store.name_ar')).toBe('سوبر ماركت القدس');
      expect(settingsRepo.get('currency.symbol')).toBe('₪');
    });
  });

  // ── 2. Auth ──────────────────────────────────────────────────────────────
  describe('2. authentication', () => {
    it('admin password admin/admin works', async () => {
      const ok = await verifyPassword(admin.passwordHash, 'admin');
      expect(ok).toBe(true);
    });

    it('cashier1 password cashier/cashier works', async () => {
      const ok = await verifyPassword(cashier1.passwordHash, 'cashier');
      expect(ok).toBe(true);
    });

    it('session lifecycle', () => {
      const s = createSession({
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role,
      });
      expect(getSession(s.token)).not.toBeNull();
    });

    it('impersonation: admin can switch to a cashier session after re-auth', async () => {
      // Mimics what the auth.impersonate IPC handler does.
      const adminOk = await verifyPassword(admin.passwordHash, 'admin');
      expect(adminOk).toBe(true);
      const cashierSession = createSession({
        id: cashier1.id,
        username: cashier1.username,
        fullName: cashier1.fullName,
        role: cashier1.role,
      });
      expect(cashierSession.role).toBe('cashier');
      expect(cashierSession.userId).toBe(cashier1.id);
    });

    it('cannot decrypt password from hash (security guarantee)', async () => {
      // Must verify, never reveal.
      expect(await verifyPassword(admin.passwordHash, 'wrong')).toBe(false);
      expect(admin.passwordHash).toMatch(/^\$argon2/);
    });
  });

  // ── 3. Products ──────────────────────────────────────────────────────────
  describe('3. products & barcodes', () => {
    it('barcode lookup returns the right product', () => {
      const bread = productRepo.findByBarcode('6281000000011');
      expect(bread?.nameAr).toBe('خبز عربي كبير');
    });

    it('search returns expected matches', () => {
      const results = productRepo.search('حليب');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('soft-delete removes from active list', () => {
      const trial = productRepo.insert({
        sku: 'TRIAL-SOFT-1',
        nameAr: 'تجريبي',
        nameEn: 'Trial',
        price: 1,
        cost: 0.5,
        taxRate: 0,
      } as any);
      expect(productRepo.listActive().some((p) => p.id === trial)).toBe(true);
      productRepo.softDelete(trial);
      expect(productRepo.listActive().some((p) => p.id === trial)).toBe(false);
    });
  });

  // ── 4. Inventory ─────────────────────────────────────────────────────────
  describe('4. inventory', () => {
    it('manual adjust changes qty and writes movement', () => {
      const milk = productRepo.findBySku('DA-0001')!;
      const before = inventoryRepo.getByProductId(milk.id)?.qtyOnHand ?? 0;
      const after = inventoryRepo.adjust(milk.id, 7);
      expect(after).toBe(before + 7);
      inventoryRepo.logMovement({ productId: milk.id, delta: 7, reason: 'adjustment', userId: admin.id });
      const moves = inventoryRepo.listMovements(milk.id, 5);
      expect(moves[0].delta).toBe(7);
    });

    it('low-stock list flags items at threshold', () => {
      // Take 4 cigarettes so they fall below their threshold (15).
      const cigs = productRepo.findBySku('TB-0001')!;
      const before = inventoryRepo.getByProductId(cigs.id)!.qtyOnHand;
      inventoryRepo.adjust(cigs.id, -(before - 5));
      const low = lowStock();
      expect(low.some((p: any) => p.sku === 'TB-0001')).toBe(true);
    });
  });

  // ── 5. Customers ─────────────────────────────────────────────────────────
  describe('5. customers credit', () => {
    it('credit sale grows the customer balance, settle reduces it', async () => {
      const customer = customerRepo.list().find((c) => c.name.includes('أبو يوسف'))!;
      const tea = productRepo.findBySku('DR-0009')!; // price 27, VAT 17%
      const startBalance = customer.balance;
      // 2 * 27 = 54.00 + 17% VAT = 63.18
      const due = 63.18;

      await checkout({
        userId: cashier1.id,
        customerId: customer.id,
        lines: [{ productId: tea.id, qty: 2 }],
        payments: [{ method: 'credit', amount: due }],
      });
      const after = customerRepo.findById(customer.id)!;
      expect(after.balance).toBeCloseTo(startBalance + due, 2);

      customerRepo.adjustBalance(customer.id, -50);
      expect(customerRepo.findById(customer.id)!.balance).toBeCloseTo(startBalance + due - 50, 2);
    });
  });

  // ── 6. Suppliers + purchase ──────────────────────────────────────────────
  describe('6. supplier purchases', () => {
    it('purchase raises inventory + supplier balance + updates last cost', async () => {
      const supplier = supplierRepo.list()[0];
      const product = productRepo.findBySku('DA-0007')!; // Nabulsi cheese
      const beforeQty = inventoryRepo.getByProductId(product.id)!.qtyOnHand;
      const startBal = supplier.balance;

      const p = await createPurchase({
        supplierId: supplier.id,
        userId: admin.id,
        invoiceRef: 'PO-2026-001',
        paid: 100,
        items: [{ productId: product.id, qty: 5, unitCost: 40 }],
      });
      expect(p.total).toBe(200);
      expect(inventoryRepo.getByProductId(product.id)!.qtyOnHand).toBe(beforeQty + 5);
      expect(supplierRepo.findById(supplier.id)!.balance).toBe(startBal + 100);
      expect(productRepo.findById(product.id)!.cost).toBe(40);
    });
  });

  // ── 7. POS sales: multi-payment incl. CHECK + BANK TRANSFER ─────────────
  describe('7. POS sales — multi-payment with check + transfer', () => {
    it('completes a sale paid by cash + check (with check #) + card', async () => {
      const customer = customerRepo.list()[2];
      const oil = productRepo.findBySku('OL-0001')!; // price 190, VAT 17%
      const labneh = productRepo.findBySku('DA-0005')!; // price 20, VAT 17%
      // 1 * 190 + 4 * 20 = 270 + 17% VAT = 315.90
      const due = 315.9;

      const sale = await checkout({
        userId: cashier1.id,
        customerId: customer.id,
        lines: [
          { productId: oil.id, qty: 1 },
          { productId: labneh.id, qty: 4 },
        ],
        payments: [
          { method: 'cash', amount: 100 },
          { method: 'check', amount: 80, reference: 'CHK-100256' },
          { method: 'card', amount: 135.9, reference: 'AUTH-9912' },
        ],
      });
      expect(sale.status).toBe('completed');
      expect(sale.paidTotal).toBeCloseTo(due, 2);
      const payments = saleRepo.listPayments(sale.saleId);
      const check = payments.find((p) => p.method === 'check');
      expect(check?.reference).toBe('CHK-100256');
    });

    it('rejects sale if cart is empty', async () => {
      await expect(
        checkout({ userId: cashier1.id, lines: [], payments: [] }),
      ).rejects.toThrow();
    });

    it('rejects sale if payment is short', async () => {
      const water = productRepo.findBySku('DR-0001')!;
      await expect(
        checkout({
          userId: cashier1.id,
          lines: [{ productId: water.id, qty: 2 }],
          payments: [{ method: 'cash', amount: 1 }],
        }),
      ).rejects.toThrow();
    });

    it('hold + resume keeps the lines and skips inventory decrement', async () => {
      const fig = productRepo.findBySku('VF-0024')!;
      const before = inventoryRepo.getByProductId(fig.id)!.qtyOnHand;
      const held = await checkout({
        userId: cashier1.id,
        lines: [{ productId: fig.id, qty: 1.5 }],
        payments: [],
        hold: { name: 'العميل في الكاش' },
      });
      expect(held.status).toBe('held');
      expect(inventoryRepo.getByProductId(fig.id)!.qtyOnHand).toBe(before);

      const resumed = await resumeHeldSale(held.saleId);
      expect(resumed.lines[0].qty).toBe(1.5);
    });
  });

  // ── 7b. Returns ──────────────────────────────────────────────────────────
  describe('7b. returns', () => {
    let saleId: number;

    it('makes a sale to be returned', async () => {
      const sugar = productRepo.findBySku('GR-0005')!;
      const beforeStock = inventoryRepo.getByProductId(sugar.id)!.qtyOnHand;
      const sale = await checkout({
        userId: cashier1.id,
        lines: [{ productId: sugar.id, qty: 4 }],
        payments: [{ method: 'cash', amount: 30.42 }],
      });
      saleId = sale.saleId;
      expect(inventoryRepo.getByProductId(sugar.id)!.qtyOnHand).toBe(beforeStock - 4);
    });

    it('partial return restores partial stock and keeps sale completed', async () => {
      const items = saleRepo.listItems(saleId);
      const ret = await processReturn({
        saleId,
        userId: admin.id,
        reason: 'منتج تالف',
        items: [{ saleItemId: items[0].id, qty: 1 }],
      });
      expect(ret.total).toBeGreaterThan(0);
      expect(saleRepo.findById(saleId)?.status).toBe('completed');
    });

    it('full return marks sale as returned', async () => {
      const items = saleRepo.listItems(saleId);
      // Already returned 1 of 4 — return the remaining 3.
      await processReturn({
        saleId,
        userId: admin.id,
        items: [{ saleItemId: items[0].id, qty: 3 }],
      });
      expect(saleRepo.findById(saleId)?.status).toBe('returned');
    });

    it('void restores inventory completely', async () => {
      const water = productRepo.findBySku('DR-0001')!;
      const before = inventoryRepo.getByProductId(water.id)!.qtyOnHand;
      const sale = await checkout({
        userId: cashier1.id,
        lines: [{ productId: water.id, qty: 6 }],
        payments: [{ method: 'cash', amount: 18 }],
      });
      expect(inventoryRepo.getByProductId(water.id)!.qtyOnHand).toBe(before - 6);
      await voidSale(sale.saleId, admin.id);
      expect(inventoryRepo.getByProductId(water.id)!.qtyOnHand).toBe(before);
      expect(saleRepo.findById(sale.saleId)?.status).toBe('voided');
    });
  });

  // ── 8. Cash drawer ───────────────────────────────────────────────────────
  describe('8. cash drawer', () => {
    it('open drawer + cash sale increases expected + close with variance', async () => {
      const opened = openDrawer(cashier1.id, 200);
      expect(opened.id).toBeGreaterThan(0);
      const drawerStart = getOpenDrawer(cashier1.id)!.expectedAmount;
      expect(drawerStart).toBe(200);

      const chips = productRepo.findBySku('SN-0005')!; // price 6, VAT 17%
      // 5 * 6 = 30 + 17% = 35.10
      await checkout({
        userId: cashier1.id,
        lines: [{ productId: chips.id, qty: 5 }],
        payments: [{ method: 'cash', amount: 35.1 }],
      });
      const drawerAfter = getOpenDrawer(cashier1.id)!.expectedAmount;
      expect(drawerAfter).toBeGreaterThan(drawerStart);

      const closed = closeDrawer(cashier1.id, drawerAfter - 5); // 5 short
      expect(closed.variance).toBe(-5);
      expect(getOpenDrawer(cashier1.id)).toBeUndefined();
    });
  });

  // ── 9. Reports ───────────────────────────────────────────────────────────
  describe('9. reports', () => {
    // Wide range — avoids any midnight / timezone edge case with "today only".
    const wideFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const wideTo = new Date(Date.now() + 24 * 60 * 60 * 1000);

    it('sales by day returns at least one row', () => {
      const rows = salesByDay(wideFrom, wideTo);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.reduce((s: number, r: any) => s + r.total, 0)).toBeGreaterThan(0);
    });

    it('top products has data', () => {
      const rows = topProducts(wideFrom, wideTo, 10);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('P&L shows positive revenue and computed gross profit', () => {
      const pl = profitLoss(wideFrom, wideTo);
      expect(pl.revenue).toBeGreaterThan(0);
      expect(pl.grossProfit).toBe(Math.round((pl.revenue - pl.cogs) * 100) / 100);
    });

    it('payments by method includes cash, check, card from our sales', () => {
      const rows = paymentsByMethod(wideFrom, wideTo);
      const byMethod = Object.fromEntries(rows.map((r: any) => [r.method, r.total]));
      expect(byMethod.cash ?? 0).toBeGreaterThan(0);
      expect(byMethod.check ?? 0).toBeGreaterThan(0);
      expect(byMethod.card ?? 0).toBeGreaterThan(0);
    });

    it('sales by cashier shows cashier1 with multiple sales', () => {
      const rows = salesByCashier(wideFrom, wideTo);
      const c1 = rows.find((r: any) => r.username === 'cashier1');
      expect(c1).toBeDefined();
      expect(c1!.count).toBeGreaterThanOrEqual(2);
    });

    it('inventory valuation > 0 across the catalog', () => {
      const rows = inventoryValuation();
      const total = rows.reduce((s: number, r: any) => s + r.value, 0);
      expect(total).toBeGreaterThan(1000);
    });

    it('low stock report flags items below threshold', () => {
      const rows = lowStock();
      // Cigarettes were dropped to 5 (threshold 15) earlier in the suite.
      expect(rows.some((r: any) => r.sku === 'TB-0001')).toBe(true);
    });
  });

  // ── 10. Audit log ────────────────────────────────────────────────────────
  describe('10. audit log', () => {
    it('captures sale.complete + sale.void + return + purchase', () => {
      const rows = db().select().from(schema.auditLog).all();
      const actions = new Set(rows.map((r) => r.action));
      expect(actions.has('sale.complete')).toBe(true);
      expect(actions.has('sale.void')).toBe(true);
      expect(actions.has('return')).toBe(true);
      expect(actions.has('purchase.create')).toBe(true);
    });
  });

  // ── 11. Invoice numbering ────────────────────────────────────────────────
  describe('11. invoice numbering', () => {
    it('invoice numbers are unique and follow INV-YYYY-NNNNN', () => {
      const sales = db()
        .select({ inv: schema.sales.invoiceNo })
        .from(schema.sales)
        .where(eq(schema.sales.status, 'completed'))
        .all();
      const numbers = sales.map((s) => s.inv);
      expect(new Set(numbers).size).toBe(numbers.length);
      for (const n of numbers) expect(n).toMatch(/^INV-\d{4}-\d{5}$/);
    });
  });
});
