#!/usr/bin/env node
/**
 * Reset script: removes the dev DB and re-seeds.
 * Run with: `npm run db:reset`
 */
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const dir = process.env.POS_DB_PATH ? join(process.env.POS_DB_PATH, '..') : join(process.cwd(), '.pos-dev');
if (existsSync(dir)) {
  rmSync(dir, { recursive: true, force: true });
  console.log('✓ Removed', dir);
}

// Re-seed
await import('./seed-dev.ts');
