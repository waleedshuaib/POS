import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { productRepo } from '../../repos/productRepo';
import { inventoryRepo } from '../../repos/inventoryRepo';
import { categoryRepo } from '../../repos/categoryRepo';
import { UnitSchema } from '@shared/types';
import { auditRepo } from '../../repos/auditRepo';
import { rawDb } from '../../db/client';
import { parseCsvToObjects } from '../../utils/csv';
import { dialog } from 'electron';
import { readFileSync } from 'fs';

const ProductInput = z.object({
  sku: z.string().min(1),
  barcode: z.string().nullable().optional(),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  categoryId: z.number().nullable().optional(),
  cost: z.number().min(0).default(0),
  price: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  unit: UnitSchema.default('pc'),
  trackStock: z.boolean().default(true),
  lowStockThreshold: z.number().min(0).default(0),
  imagePath: z.string().nullable().optional(),
  active: z.boolean().default(true),
  initialStock: z.number().min(0).optional(),
});

registerRoutes({
  'products.list': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => productRepo.list(),
  }),
  'products.search': defineRoute({
    input: z.object({ q: z.string() }),
    handler: (input) => (input.q.trim().length === 0 ? productRepo.listActive().slice(0, 50) : productRepo.search(input.q.trim())),
  }),
  'products.getByBarcode': defineRoute({
    input: z.object({ barcode: z.string() }),
    handler: (input) => productRepo.findByBarcode(input.barcode) ?? null,
  }),
  'products.get': defineRoute({
    input: z.object({ id: z.number() }),
    handler: (input) => productRepo.findById(input.id) ?? null,
  }),
  'products.create': defineRoute({
    input: ProductInput,
    roles: ['admin', 'manager'],
    handler: (input, ctx) => {
      if (productRepo.findBySku(input.sku)) throw new Error('SKU already exists');
      if (input.barcode && productRepo.findByBarcode(input.barcode)) throw new Error('Barcode already exists');
      const { initialStock, ...prod } = input;
      const id = productRepo.insert(prod as any);
      const stock = initialStock ?? 0;
      inventoryRepo.upsert(id, stock);
      if (stock > 0) {
        inventoryRepo.logMovement({
          productId: id,
          delta: stock,
          reason: 'initial',
          userId: ctx.session?.userId,
        });
      }
      auditRepo.log({ userId: ctx.session?.userId, action: 'product.create', entity: 'product', entityId: id });
      return { id };
    },
  }),
  'products.update': defineRoute({
    input: ProductInput.partial().extend({ id: z.number() }),
    roles: ['admin', 'manager'],
    handler: (input, ctx) => {
      const { id, initialStock, ...patch } = input;
      productRepo.update(id, patch as any);
      auditRepo.log({ userId: ctx.session?.userId, action: 'product.update', entity: 'product', entityId: id });
      return { ok: true };
    },
  }),
  'products.remove': defineRoute({
    input: z.object({ id: z.number() }),
    roles: ['admin'],
    handler: (input, ctx) => {
      productRepo.softDelete(input.id);
      auditRepo.log({ userId: ctx.session?.userId, action: 'product.remove', entity: 'product', entityId: input.id });
      return { ok: true };
    },
  }),

  /**
   * Pick a CSV file and return parsed rows + auto-detected column-to-field mapping.
   * Headers we accept (case-insensitive, fuzzy on whitespace):
   *   sku, barcode, name_ar, name_en, price, cost, tax, unit, category,
   *   stock, low_stock
   * Returns the raw rows so the renderer can preview before committing.
   */
  'products.pickImportFile': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin', 'manager'],
    handler: async () => {
      const result = await dialog.showOpenDialog({
        title: 'Select products CSV',
        properties: ['openFile'],
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (result.canceled || !result.filePaths[0]) return null;
      const text = readFileSync(result.filePaths[0], 'utf8');
      const parsed = parseCsvToObjects(text);
      return { ...parsed, path: result.filePaths[0] };
    },
  }),

  /**
   * Commit a previously-parsed batch. Returns per-row results so the UI can
   * show a final summary. Each row is processed in its own try/catch so one
   * bad row doesn't take down the rest.
   */
  'products.bulkImport': defineRoute({
    input: z.object({
      rows: z.array(z.object({
        sku: z.string().min(1),
        barcode: z.string().optional().nullable(),
        nameAr: z.string().min(1),
        nameEn: z.string().min(1),
        price: z.number().min(0),
        cost: z.number().min(0).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        unit: UnitSchema.optional(),
        category: z.string().optional(),
        initialStock: z.number().min(0).optional(),
        lowStockThreshold: z.number().min(0).optional(),
      })).nonempty(),
    }),
    roles: ['admin', 'manager'],
    handler: (input, ctx) => {
      const sqlite = rawDb();
      // Resolve / lazily create categories by name (ar OR en match).
      const cats = categoryRepo.list();
      const findCat = (name: string | undefined): number | null => {
        if (!name) return null;
        const trimmed = name.trim();
        const hit = cats.find((c) => c.nameAr === trimmed || c.nameEn === trimmed);
        if (hit) return hit.id;
        const id = categoryRepo.insert(trimmed, trimmed, null);
        cats.push({ id, nameAr: trimmed, nameEn: trimmed } as any);
        return id;
      };

      const results: Array<{ sku: string; ok: boolean; reason?: string; id?: number }> = [];

      const tx = sqlite.transaction(() => {
        for (const row of input.rows) {
          try {
            if (productRepo.findBySku(row.sku)) {
              results.push({ sku: row.sku, ok: false, reason: 'SKU exists' });
              continue;
            }
            if (row.barcode && productRepo.findByBarcode(row.barcode)) {
              results.push({ sku: row.sku, ok: false, reason: 'Barcode exists' });
              continue;
            }
            const id = productRepo.insert({
              sku: row.sku,
              barcode: row.barcode ?? null,
              nameAr: row.nameAr,
              nameEn: row.nameEn,
              categoryId: findCat(row.category),
              price: row.price,
              cost: row.cost ?? 0,
              taxRate: row.taxRate ?? 17,
              unit: row.unit ?? 'pc',
              trackStock: true,
              lowStockThreshold: row.lowStockThreshold ?? 0,
              active: true,
            } as any);
            const stock = row.initialStock ?? 0;
            inventoryRepo.upsert(id, stock);
            if (stock > 0) {
              inventoryRepo.logMovement({
                productId: id,
                delta: stock,
                reason: 'initial',
                userId: ctx.session?.userId,
              });
            }
            results.push({ sku: row.sku, ok: true, id });
          } catch (err) {
            results.push({ sku: row.sku, ok: false, reason: (err as Error).message });
          }
        }
      });
      tx();

      const okCount = results.filter((r) => r.ok).length;
      auditRepo.log({
        userId: ctx.session?.userId,
        action: 'products.bulkImport',
        entity: 'product',
        payload: { total: results.length, ok: okCount },
      });
      return { results, okCount, total: results.length };
    },
  }),
});
