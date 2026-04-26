import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { openDrawer, closeDrawer, getOpenDrawer, listDrawers } from '../../services/drawer';

registerRoutes({
  'drawer.open': defineRoute({
    input: z.object({ openingAmount: z.number().min(0), notes: z.string().optional() }),
    handler: (input, ctx) => openDrawer(ctx.session!.userId, input.openingAmount, input.notes),
  }),
  'drawer.close': defineRoute({
    input: z.object({ countedAmount: z.number().min(0), notes: z.string().optional() }),
    handler: (input, ctx) => closeDrawer(ctx.session!.userId, input.countedAmount, input.notes),
  }),
  'drawer.current': defineRoute({
    input: z.object({}).optional().default({}),
    handler: (_input, ctx) => getOpenDrawer(ctx.session!.userId) ?? null,
  }),
  'drawer.history': defineRoute({
    input: z.object({ limit: z.number().optional() }).optional().default({}),
    roles: ['admin', 'manager'],
    handler: (input) => listDrawers(input?.limit ?? 50),
  }),
});
