import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { createPurchase } from '../../services/purchases';
import { db, schema } from '../../db/client';
import { desc, eq } from 'drizzle-orm';

registerRoutes({
  'purchases.list': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => db().select().from(schema.purchases).orderBy(desc(schema.purchases.createdAt)).limit(200).all(),
  }),
  'purchases.get': defineRoute({
    input: z.object({ id: z.number() }),
    handler: (input) => {
      const p = db().select().from(schema.purchases).where(eq(schema.purchases.id, input.id)).get();
      if (!p) return null;
      const items = db().select().from(schema.purchaseItems).where(eq(schema.purchaseItems.purchaseId, input.id)).all();
      return { ...p, items };
    },
  }),
  'purchases.create': defineRoute({
    input: z.object({
      supplierId: z.number(),
      invoiceRef: z.string().optional(),
      paid: z.number().min(0).optional(),
      notes: z.string().optional(),
      items: z.array(
        z.object({
          productId: z.number(),
          qty: z.number().positive(),
          unitCost: z.number().min(0),
        }),
      ).nonempty(),
    }),
    roles: ['admin', 'manager'],
    handler: (input, ctx) =>
      createPurchase({ ...input, userId: ctx.session!.userId }),
  }),
});
