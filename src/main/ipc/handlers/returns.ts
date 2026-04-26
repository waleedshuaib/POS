import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { processReturn } from '../../services/returns';
import { db, schema } from '../../db/client';
import { desc, eq } from 'drizzle-orm';

registerRoutes({
  'returns.create': defineRoute({
    input: z.object({
      saleId: z.number(),
      reason: z.string().optional(),
      items: z.array(z.object({ saleItemId: z.number(), qty: z.number().positive() })).nonempty(),
    }),
    roles: ['admin', 'manager', 'cashier'],
    handler: (input, ctx) => processReturn({ ...input, userId: ctx.session!.userId }),
  }),
  'returns.list': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => db().select().from(schema.returns).orderBy(desc(schema.returns.createdAt)).limit(200).all(),
  }),
  'returns.get': defineRoute({
    input: z.object({ id: z.number() }),
    handler: (input) => {
      const r = db().select().from(schema.returns).where(eq(schema.returns.id, input.id)).get();
      if (!r) return null;
      const items = db().select().from(schema.returnItems).where(eq(schema.returnItems.returnId, input.id)).all();
      return { ...r, items };
    },
  }),
});
