import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { productRepo } from '../../repos/productRepo';
import { inventoryRepo } from '../../repos/inventoryRepo';
import { UnitSchema } from '@shared/types';
import { auditRepo } from '../../repos/auditRepo';

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
});
