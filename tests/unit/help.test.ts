import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { join } from 'path';

const dir = (lang: string) => join(process.cwd(), 'src/renderer/features/help/articles', lang);

describe('help articles', () => {
  it('arabic and english article sets match', () => {
    const ar = readdirSync(dir('ar')).filter((f) => f.endsWith('.md')).sort();
    const en = readdirSync(dir('en')).filter((f) => f.endsWith('.md')).sort();
    expect(ar).toEqual(en);
  });

  it('has the 12 expected slugs', () => {
    const expected = [
      'backup-restore.md',
      'customers-suppliers.md',
      'daily-closing.md',
      'faq.md',
      'getting-started.md',
      'printing.md',
      'products-inventory.md',
      'reports.md',
      'sales-checkout.md',
      'shortcuts.md',
      'troubleshooting.md',
      'users-roles.md',
    ];
    const ar = readdirSync(dir('ar')).filter((f) => f.endsWith('.md')).sort();
    expect(ar).toEqual(expected);
  });
});
