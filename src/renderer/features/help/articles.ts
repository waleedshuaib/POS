// Bundle all help articles as raw strings via Vite's ?raw import.
// Each locale has the same 12 slugs; we import them eagerly so they work offline.

import getting_started_ar from './articles/ar/getting-started.md?raw';
import sales_checkout_ar from './articles/ar/sales-checkout.md?raw';
import products_inventory_ar from './articles/ar/products-inventory.md?raw';
import customers_suppliers_ar from './articles/ar/customers-suppliers.md?raw';
import reports_ar from './articles/ar/reports.md?raw';
import daily_closing_ar from './articles/ar/daily-closing.md?raw';
import printing_ar from './articles/ar/printing.md?raw';
import backup_restore_ar from './articles/ar/backup-restore.md?raw';
import users_roles_ar from './articles/ar/users-roles.md?raw';
import troubleshooting_ar from './articles/ar/troubleshooting.md?raw';
import shortcuts_ar from './articles/ar/shortcuts.md?raw';
import faq_ar from './articles/ar/faq.md?raw';

import getting_started_en from './articles/en/getting-started.md?raw';
import sales_checkout_en from './articles/en/sales-checkout.md?raw';
import products_inventory_en from './articles/en/products-inventory.md?raw';
import customers_suppliers_en from './articles/en/customers-suppliers.md?raw';
import reports_en from './articles/en/reports.md?raw';
import daily_closing_en from './articles/en/daily-closing.md?raw';
import printing_en from './articles/en/printing.md?raw';
import backup_restore_en from './articles/en/backup-restore.md?raw';
import users_roles_en from './articles/en/users-roles.md?raw';
import troubleshooting_en from './articles/en/troubleshooting.md?raw';
import shortcuts_en from './articles/en/shortcuts.md?raw';
import faq_en from './articles/en/faq.md?raw';

export interface HelpArticle {
  slug: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}

function extractTitle(md: string, fallback: string): string {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : fallback;
}

export const ARTICLES: HelpArticle[] = [
  { slug: 'getting-started', bodyAr: getting_started_ar, bodyEn: getting_started_en, titleAr: extractTitle(getting_started_ar, 'Getting Started'), titleEn: extractTitle(getting_started_en, 'Getting Started') },
  { slug: 'sales-checkout', bodyAr: sales_checkout_ar, bodyEn: sales_checkout_en, titleAr: extractTitle(sales_checkout_ar, 'Sales'), titleEn: extractTitle(sales_checkout_en, 'Sales') },
  { slug: 'products-inventory', bodyAr: products_inventory_ar, bodyEn: products_inventory_en, titleAr: extractTitle(products_inventory_ar, 'Products'), titleEn: extractTitle(products_inventory_en, 'Products') },
  { slug: 'customers-suppliers', bodyAr: customers_suppliers_ar, bodyEn: customers_suppliers_en, titleAr: extractTitle(customers_suppliers_ar, 'Customers'), titleEn: extractTitle(customers_suppliers_en, 'Customers') },
  { slug: 'reports', bodyAr: reports_ar, bodyEn: reports_en, titleAr: extractTitle(reports_ar, 'Reports'), titleEn: extractTitle(reports_en, 'Reports') },
  { slug: 'daily-closing', bodyAr: daily_closing_ar, bodyEn: daily_closing_en, titleAr: extractTitle(daily_closing_ar, 'Closing'), titleEn: extractTitle(daily_closing_en, 'Closing') },
  { slug: 'printing', bodyAr: printing_ar, bodyEn: printing_en, titleAr: extractTitle(printing_ar, 'Printing'), titleEn: extractTitle(printing_en, 'Printing') },
  { slug: 'backup-restore', bodyAr: backup_restore_ar, bodyEn: backup_restore_en, titleAr: extractTitle(backup_restore_ar, 'Backup'), titleEn: extractTitle(backup_restore_en, 'Backup') },
  { slug: 'users-roles', bodyAr: users_roles_ar, bodyEn: users_roles_en, titleAr: extractTitle(users_roles_ar, 'Users'), titleEn: extractTitle(users_roles_en, 'Users') },
  { slug: 'troubleshooting', bodyAr: troubleshooting_ar, bodyEn: troubleshooting_en, titleAr: extractTitle(troubleshooting_ar, 'Troubleshooting'), titleEn: extractTitle(troubleshooting_en, 'Troubleshooting') },
  { slug: 'shortcuts', bodyAr: shortcuts_ar, bodyEn: shortcuts_en, titleAr: extractTitle(shortcuts_ar, 'Shortcuts'), titleEn: extractTitle(shortcuts_en, 'Shortcuts') },
  { slug: 'faq', bodyAr: faq_ar, bodyEn: faq_en, titleAr: extractTitle(faq_ar, 'FAQ'), titleEn: extractTitle(faq_en, 'FAQ') },
];

export function getArticle(slug: string): HelpArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
