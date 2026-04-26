import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';

export const settingsRepo = {
  getAll(): Record<string, string> {
    const rows = db().select().from(schema.settings).all();
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
  get(key: string): string | undefined {
    return db().select().from(schema.settings).where(eq(schema.settings.key, key)).get()?.value;
  },
  set(key: string, value: string): void {
    const existing = db().select().from(schema.settings).where(eq(schema.settings.key, key)).get();
    if (existing) {
      db().update(schema.settings).set({ value, updatedAt: new Date() }).where(eq(schema.settings.key, key)).run();
    } else {
      db().insert(schema.settings).values({ key, value }).run();
    }
  },
  setMany(entries: Record<string, string>): void {
    for (const [k, v] of Object.entries(entries)) settingsRepo.set(k, v);
  },
};
