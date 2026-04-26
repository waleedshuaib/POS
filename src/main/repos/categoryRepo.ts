import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';

export const categoryRepo = {
  list: () => db().select().from(schema.categories).all(),
  findById: (id: number) =>
    db().select().from(schema.categories).where(eq(schema.categories.id, id)).get(),
  insert: (nameAr: string, nameEn: string, parentId?: number | null): number => {
    const res = db().insert(schema.categories).values({ nameAr, nameEn, parentId: parentId ?? null }).run();
    return Number(res.lastInsertRowid);
  },
  update: (id: number, patch: { nameAr?: string; nameEn?: string; parentId?: number | null }) => {
    db()
      .update(schema.categories)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.categories.id, id))
      .run();
  },
  remove: (id: number) => db().delete(schema.categories).where(eq(schema.categories.id, id)).run(),
};
