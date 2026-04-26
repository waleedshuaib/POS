import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import type { NewUser, User } from '../db/schema';

export const userRepo = {
  findById(id: number): User | undefined {
    return db().select().from(schema.users).where(eq(schema.users.id, id)).get();
  },
  findByUsername(username: string): User | undefined {
    return db().select().from(schema.users).where(eq(schema.users.username, username)).get();
  },
  list(): User[] {
    return db().select().from(schema.users).all();
  },
  insert(u: NewUser): number {
    const res = db().insert(schema.users).values(u).run();
    return Number(res.lastInsertRowid);
  },
  update(id: number, patch: Partial<NewUser>): void {
    db()
      .update(schema.users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .run();
  },
  deactivate(id: number): void {
    db().update(schema.users).set({ active: false }).where(eq(schema.users.id, id)).run();
  },
  activate(id: number): void {
    db().update(schema.users).set({ active: true }).where(eq(schema.users.id, id)).run();
  },
};
