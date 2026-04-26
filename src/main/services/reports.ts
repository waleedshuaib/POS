import { and, eq, gte, lte, sql, desc } from 'drizzle-orm';
import { db, schema } from '../db/client';

function bounds(from: Date, to: Date): { from: Date; to: Date } {
  const f = new Date(from);
  f.setHours(0, 0, 0, 0);
  const t = new Date(to);
  t.setHours(23, 59, 59, 999);
  return { from: f, to: t };
}

export function salesByDay(fromD: Date, toD: Date) {
  const { from, to } = bounds(fromD, toD);
  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${schema.sales.createdAt} / 1000, 'unixepoch', 'localtime')`;
  return db()
    .select({
      day: dayExpr,
      count: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(${schema.sales.grandTotal}), 0)`,
      tax: sql<number>`COALESCE(SUM(${schema.sales.taxTotal}), 0)`,
      discount: sql<number>`COALESCE(SUM(${schema.sales.discountTotal}), 0)`,
    })
    .from(schema.sales)
    .where(
      and(
        eq(schema.sales.status, 'completed'),
        gte(schema.sales.createdAt, from),
        lte(schema.sales.createdAt, to),
      ),
    )
    .groupBy(dayExpr)
    .orderBy(dayExpr)
    .all();
}

export function topProducts(fromD: Date, toD: Date, limit = 10) {
  const { from, to } = bounds(fromD, toD);
  return db()
    .select({
      productId: schema.saleItems.productId,
      name: schema.saleItems.nameAtSale,
      qty: sql<number>`COALESCE(SUM(${schema.saleItems.qty}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${schema.saleItems.lineTotal}), 0)`,
    })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .where(
      and(
        eq(schema.sales.status, 'completed'),
        gte(schema.sales.createdAt, from),
        lte(schema.sales.createdAt, to),
      ),
    )
    .groupBy(schema.saleItems.productId, schema.saleItems.nameAtSale)
    .orderBy(desc(sql<number>`COALESCE(SUM(${schema.saleItems.lineTotal}), 0)`))
    .limit(limit)
    .all();
}

export function profitLoss(fromD: Date, toD: Date) {
  const { from, to } = bounds(fromD, toD);
  const row = db()
    .select({
      revenue: sql<number>`COALESCE(SUM(${schema.saleItems.lineTotal} - ${schema.saleItems.taxAmount}), 0)`,
      cogs: sql<number>`COALESCE(SUM(${schema.saleItems.qty} * ${schema.products.cost}), 0)`,
    })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .innerJoin(schema.products, eq(schema.products.id, schema.saleItems.productId))
    .where(
      and(
        eq(schema.sales.status, 'completed'),
        gte(schema.sales.createdAt, from),
        lte(schema.sales.createdAt, to),
      ),
    )
    .get();
  const revenue = row?.revenue ?? 0;
  const cogs = row?.cogs ?? 0;
  return { revenue, cogs, grossProfit: Math.round((revenue - cogs) * 100) / 100 };
}

export function paymentsByMethod(fromD: Date, toD: Date) {
  const { from, to } = bounds(fromD, toD);
  return db()
    .select({
      method: schema.salePayments.method,
      total: sql<number>`COALESCE(SUM(${schema.salePayments.amount}), 0)`,
    })
    .from(schema.salePayments)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.salePayments.saleId))
    .where(
      and(
        eq(schema.sales.status, 'completed'),
        gte(schema.sales.createdAt, from),
        lte(schema.sales.createdAt, to),
      ),
    )
    .groupBy(schema.salePayments.method)
    .all();
}

export function salesByCashier(fromD: Date, toD: Date) {
  const { from, to } = bounds(fromD, toD);
  return db()
    .select({
      userId: schema.sales.userId,
      username: schema.users.username,
      count: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(${schema.sales.grandTotal}), 0)`,
    })
    .from(schema.sales)
    .innerJoin(schema.users, eq(schema.users.id, schema.sales.userId))
    .where(
      and(
        eq(schema.sales.status, 'completed'),
        gte(schema.sales.createdAt, from),
        lte(schema.sales.createdAt, to),
      ),
    )
    .groupBy(schema.sales.userId, schema.users.username)
    .all();
}

export function inventoryValuation() {
  return db()
    .select({
      productId: schema.products.id,
      sku: schema.products.sku,
      nameAr: schema.products.nameAr,
      qty: sql<number>`COALESCE(${schema.inventory.qtyOnHand}, 0)`,
      cost: schema.products.cost,
      value: sql<number>`COALESCE(${schema.inventory.qtyOnHand} * ${schema.products.cost}, 0)`,
    })
    .from(schema.products)
    .leftJoin(schema.inventory, eq(schema.inventory.productId, schema.products.id))
    .where(eq(schema.products.active, true))
    .all();
}

export function lowStock() {
  return db()
    .select({
      productId: schema.products.id,
      sku: schema.products.sku,
      nameAr: schema.products.nameAr,
      nameEn: schema.products.nameEn,
      qty: sql<number>`COALESCE(${schema.inventory.qtyOnHand}, 0)`,
      threshold: schema.products.lowStockThreshold,
    })
    .from(schema.products)
    .leftJoin(schema.inventory, eq(schema.inventory.productId, schema.products.id))
    .where(
      and(
        eq(schema.products.active, true),
        eq(schema.products.trackStock, true),
        sql`COALESCE(${schema.inventory.qtyOnHand}, 0) <= ${schema.products.lowStockThreshold}`,
      ),
    )
    .all();
}
