import { beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import { join } from 'path';
import { initDatabase, closeDatabase, db, schema } from '../../src/main/db/client';
import { hashPassword } from '../../src/main/auth/password';

// Tests run against a plaintext DB so they don't depend on the SQLCipher
// driver being installed in the test environment.
process.env.POS_DB_PLAINTEXT = '1';

export let adminId: number;

export function useTestDb() {
  let tmp: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(os.tmpdir(), 'pos-it-'));
    const dbPath = join(tmp, 'pos.db');
    await initDatabase(dbPath, join(process.cwd(), 'drizzle'));
    const hash = await hashPassword('test');
    const res = db()
      .insert(schema.users)
      .values({ username: 'admin', passwordHash: hash, fullName: 'Admin', role: 'admin', active: true })
      .run();
    adminId = Number(res.lastInsertRowid);
    db().insert(schema.settings).values({ key: 'invoice.prefix', value: 'INV' }).run();
  });

  afterEach(() => {
    closeDatabase();
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });
}
