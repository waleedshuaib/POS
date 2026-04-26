import { seedPalestineSupermarket, PALESTINE_SETTINGS } from './seed-palestine';
import { db, schema } from './db/client';
import { hashPassword } from './auth/password';
import { eq } from 'drizzle-orm';

export const DEFAULT_SETTINGS = PALESTINE_SETTINGS;

/**
 * Minimal seeding always run on app start:
 *   - default store settings (idempotent: only inserts missing keys)
 *   - one admin user (admin / admin) so a fresh install is usable
 *
 * The full Palestinian supermarket dataset (categories, ~90 products,
 * suppliers, customers, extra users) is OPT-IN: pass POS_SEED=palestine
 * (e.g. `npm run dev:seed`) on a fresh DB.
 */
export async function ensureSeeded(): Promise<void> {
  const d = db();

  // Settings
  const existingSettings = new Set(d.select().from(schema.settings).all().map((s) => s.key));
  const toInsert = Object.entries(PALESTINE_SETTINGS)
    .filter(([k]) => !existingSettings.has(k))
    .map(([key, value]) => ({ key, value }));
  if (toInsert.length > 0) d.insert(schema.settings).values(toInsert).run();

  // Always ensure at least one admin so the app is loginable
  const userCount = d.select().from(schema.users).all().length;
  if (userCount === 0) {
    const hash = await hashPassword('admin');
    d.insert(schema.users)
      .values({
        username: 'admin',
        passwordHash: hash,
        fullName: 'Administrator',
        role: 'admin',
        active: true,
      })
      .run();
  }

  // Optional: full demo dataset
  if (process.env.POS_SEED === 'palestine') {
    await seedPalestineSupermarket();
  }
}

/** Re-hash and reset the default admin password. Used by tests. */
export async function resetDemoUser(): Promise<void> {
  const d = db();
  const hash = await hashPassword('admin');
  d.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.username, 'admin')).run();
}
