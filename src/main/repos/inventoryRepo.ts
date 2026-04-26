import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/client';

export interface StockLine {
  productId: number;
  sku: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string;
  qtyOnHand: number;
  lowStockThreshold: number;
  cost: number;
  price: number;
}

export const inventoryRepo = {
  getByProductId(productId: number): { qtyOnHand: number } | undefined {
    const row = db()
      .select({ qty: schema.inventory.qtyOnHand })
      .from(schema.inventory)
      .where(eq(schema.inventory.productId, productId))
      .get();
    return row ? { qtyOnHand: row.qty } : undefined;
  },
  upsert(productId: number, qty: number): void {
    const existing = db()
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.productId, productId))
      .get();
    if (existing) {
      db().update(schema.inventory).set({ qtyOnHand: qty }).where(eq(schema.inventory.productId, productId)).run();
    } else {
      db().insert(schema.inventory).values({ productId, qtyOnHand: qty }).run();
    }
  },
  adjust(productId: number, delta: number): number {
    const existing = db()
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.productId, productId))
      .get();
    const newQty = (existing?.qtyOnHand ?? 0) + delta;
    if (existing) {
      db()
        .update(schema.inventory)
        .set({ qtyOnHand: newQty })
        .where(eq(schema.inventory.productId, productId))
        .run();
    } else {
      db().insert(schema.inventory).values({ productId, qtyOnHand: newQty }).run();
    }
    return newQty;
  },
  logMovement(input: {
    productId: number;
    delta: number;
    reason: 'sale' | 'return' | 'purchase' | 'adjustment' | 'initial' | 'void';
    refType?: string;
    refId?: number;
    note?: string;
    userId?: number;
  }): void {
    db()
      .insert(schema.inventoryMovements)
      .values({
        productId: input.productId,
        delta: input.delta,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        note: input.note,
        userId: input.userId,
      })
      .run();
  },
  listStock(): StockLine[] {
    const rows = db()
      .select({
        productId: schema.products.id,
        sku: schema.products.sku,
        barcode: schema.products.barcode,
        nameAr: schema.products.nameAr,
        nameEn: schema.products.nameEn,
        qtyOnHand: sql<number>`COALESCE(${schema.inventory.qtyOnHand}, 0)`,
        lowStockThreshold: schema.products.lowStockThreshold,
        cost: schema.products.cost,
        price: schema.products.price,
      })
      .from(schema.products)
      .leftJoin(schema.inventory, eq(schema.inventory.productId, schema.products.id))
      .where(eq(schema.products.active, true))
      .orderBy(schema.products.nameAr)
      .all();
    return rows as StockLine[];
  },
  listMovements(productId: number, limit = 100) {
    return db()
      .select()
      .from(schema.inventoryMovements)
      .where(eq(schema.inventoryMovements.productId, productId))
      .orderBy(sql`${schema.inventoryMovements.createdAt} DESC, ${schema.inventoryMovements.id} DESC`)
      .limit(limit)
      .all();
  },
};
