import { eq, like, or } from 'drizzle-orm';
import { db, schema } from '../db/client';
import type { Customer, Supplier } from '../db/schema';

export const customerRepo = {
  list: (): Customer[] => db().select().from(schema.customers).orderBy(schema.customers.name).all(),
  findById: (id: number): Customer | undefined =>
    db().select().from(schema.customers).where(eq(schema.customers.id, id)).get(),
  search: (q: string): Customer[] => {
    const l = `%${q}%`;
    return db()
      .select()
      .from(schema.customers)
      .where(or(like(schema.customers.name, l), like(schema.customers.phone, l)))
      .limit(50)
      .all();
  },
  insert: (c: { name: string; phone?: string | null; email?: string | null; taxId?: string | null; address?: string | null; balance?: number }): number => {
    const res = db()
      .insert(schema.customers)
      .values({
        name: c.name,
        phone: c.phone ?? null,
        email: c.email ?? null,
        taxId: c.taxId ?? null,
        address: c.address ?? null,
        balance: c.balance ?? 0,
      })
      .run();
    return Number(res.lastInsertRowid);
  },
  update: (id: number, patch: Partial<Customer>) => {
    db()
      .update(schema.customers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.customers.id, id))
      .run();
  },
  adjustBalance: (id: number, delta: number) => {
    const c = customerRepo.findById(id);
    if (!c) return;
    db()
      .update(schema.customers)
      .set({ balance: c.balance + delta, updatedAt: new Date() })
      .where(eq(schema.customers.id, id))
      .run();
  },
  remove: (id: number) => db().delete(schema.customers).where(eq(schema.customers.id, id)).run(),
};

export const supplierRepo = {
  list: (): Supplier[] => db().select().from(schema.suppliers).orderBy(schema.suppliers.name).all(),
  findById: (id: number): Supplier | undefined =>
    db().select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).get(),
  insert: (s: { name: string; phone?: string | null; email?: string | null; taxId?: string | null; address?: string | null; balance?: number }): number => {
    const res = db()
      .insert(schema.suppliers)
      .values({
        name: s.name,
        phone: s.phone ?? null,
        email: s.email ?? null,
        taxId: s.taxId ?? null,
        address: s.address ?? null,
        balance: s.balance ?? 0,
      })
      .run();
    return Number(res.lastInsertRowid);
  },
  update: (id: number, patch: Partial<Supplier>) => {
    db()
      .update(schema.suppliers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.suppliers.id, id))
      .run();
  },
  adjustBalance: (id: number, delta: number) => {
    const s = supplierRepo.findById(id);
    if (!s) return;
    db()
      .update(schema.suppliers)
      .set({ balance: s.balance + delta, updatedAt: new Date() })
      .where(eq(schema.suppliers.id, id))
      .run();
  },
  remove: (id: number) => db().delete(schema.suppliers).where(eq(schema.suppliers.id, id)).run(),
};
