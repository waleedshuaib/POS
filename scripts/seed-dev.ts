#!/usr/bin/env node
/**
 * Dev-only seeding script: creates sample categories and products against a
 * temporary DB path (so it doesn't clobber real user data).
 * Run with: `npm run db:seed`
 */
import { initDatabase, closeDatabase } from '../src/main/db/client';
import { ensureSeeded } from '../src/main/seed';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function main() {
  process.env.POS_SEED_SAMPLE = '1';
  const target = process.env.POS_DB_PATH ?? join(process.cwd(), '.pos-dev/pos.db');
  const dir = join(target, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  process.env.POS_DB_PATH = target;
  await initDatabase(target, join(process.cwd(), 'drizzle'));
  await ensureSeeded();
  closeDatabase();
  console.log('✓ Seeded DB at', target);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
