import type Database from 'better-sqlite3';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Simple file-based migration runner.
 * Migrations live in `migrationsDir` as NNNN_name.sql files (sorted by name).
 * Each file may contain multiple statements separated by `--> statement-breakpoint`.
 * Applied migrations are tracked in `_migrations` table.
 */
export function runMigrations(sqlite: Database.Database, migrationsDir: string): number {
  if (!existsSync(migrationsDir)) return 0;

  sqlite.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);

  const applied = new Set<string>(
    sqlite
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r: any) => r.name),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const tx = sqlite.transaction(() => {
      for (const stmt of statements) sqlite.exec(stmt);
      sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    });
    tx();
    count++;
  }
  return count;
}
