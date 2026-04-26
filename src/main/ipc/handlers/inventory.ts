import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { inventoryRepo } from '../../repos/inventoryRepo';
import { auditRepo } from '../../repos/auditRepo';

registerRoutes({
  'inventory.list': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => inventoryRepo.listStock(),
  }),
  'inventory.adjust': defineRoute({
    input: z.object({ productId: z.number(), delta: z.number(), note: z.string().optional() }),
    roles: ['admin', 'manager'],
    handler: (input, ctx) => {
      const newQty = inventoryRepo.adjust(input.productId, input.delta);
      inventoryRepo.logMovement({
        productId: input.productId,
        delta: input.delta,
        reason: 'adjustment',
        note: input.note,
        userId: ctx.session?.userId,
      });
      auditRepo.log({
        userId: ctx.session?.userId,
        action: 'inventory.adjust',
        entity: 'product',
        entityId: input.productId,
        payload: { delta: input.delta, note: input.note },
      });
      return { newQty };
    },
  }),
  'inventory.set': defineRoute({
    input: z.object({ productId: z.number(), qty: z.number().min(0), note: z.string().optional() }),
    roles: ['admin', 'manager'],
    handler: (input, ctx) => {
      const existing = inventoryRepo.getByProductId(input.productId);
      const delta = input.qty - (existing?.qtyOnHand ?? 0);
      inventoryRepo.upsert(input.productId, input.qty);
      if (delta !== 0) {
        inventoryRepo.logMovement({
          productId: input.productId,
          delta,
          reason: 'adjustment',
          note: input.note,
          userId: ctx.session?.userId,
        });
      }
      auditRepo.log({ userId: ctx.session?.userId, action: 'inventory.set', entity: 'product', entityId: input.productId, payload: { qty: input.qty } });
      return { ok: true };
    },
  }),
  'inventory.movements': defineRoute({
    input: z.object({ productId: z.number(), limit: z.number().optional() }),
    handler: (input) => inventoryRepo.listMovements(input.productId, input.limit ?? 100),
  }),
});
