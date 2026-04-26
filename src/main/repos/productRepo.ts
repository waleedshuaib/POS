import { eq, like, or, and } from 'drizzle-orm';
import { db, schema } from '../db/client';
import type { NewProduct, Product } from '../db/schema';

export const productRepo = {
  findById(id: number): Product | undefined {
    return db().select().from(schema.products).where(eq(schema.products.id, id)).get();
  },
  findByBarcode(barcode: string): Product | undefined {
    return db().select().from(schema.products).where(eq(schema.products.barcode, barcode)).get();
  },
  findBySku(sku: string): Product | undefined {
    return db().select().from(schema.products).where(eq(schema.products.sku, sku)).get();
  },
  list(): Product[] {
    return db().select().from(schema.products).orderBy(schema.products.nameAr).all();
  },
  listActive(): Product[] {
    return db()
      .select()
      .from(schema.products)
      .where(eq(schema.products.active, true))
      .orderBy(schema.products.nameAr)
      .all();
  },
  search(q: string): Product[] {
    const like_ = `%${q}%`;
    return db()
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.active, true),
          or(
            like(schema.products.nameAr, like_),
            like(schema.products.nameEn, like_),
            like(schema.products.sku, like_),
            like(schema.products.barcode, like_),
          ),
        ),
      )
      .limit(50)
      .all();
  },
  insert(p: NewProduct): number {
    const res = db().insert(schema.products).values(p).run();
    return Number(res.lastInsertRowid);
  },
  update(id: number, patch: Partial<NewProduct>): void {
    db()
      .update(schema.products)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .run();
  },
  softDelete(id: number): void {
    db().update(schema.products).set({ active: false }).where(eq(schema.products.id, id)).run();
  },
};
