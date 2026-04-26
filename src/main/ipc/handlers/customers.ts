import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { customerRepo } from '../../repos/partyRepo';
import { eq, desc, and } from 'drizzle-orm';
import { db, schema } from '../../db/client';

registerRoutes({
  'customers.list': defineRoute({
    input: z.object({ q: z.string().optional() }).optional().default({}),
    handler: (input) => (input?.q ? customerRepo.search(input.q) : customerRepo.list()),
  }),
  'customers.get': defineRoute({
    input: z.object({ id: z.number() }),
    handler: (input) => customerRepo.findById(input.id) ?? null,
  }),
  'customers.create': defineRoute({
    input: z.object({
      name: z.string().min(1),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      taxId: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    }),
    roles: ['admin', 'manager', 'cashier'],
    handler: (input) => ({ id: customerRepo.insert(input as any) }),
  }),
  'customers.update': defineRoute({
    input: z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      taxId: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    }),
    roles: ['admin', 'manager'],
    handler: (input) => {
      const { id, ...patch } = input;
      customerRepo.update(id, patch as any);
      return { ok: true };
    },
  }),
  'customers.payCredit': defineRoute({
    input: z.object({ id: z.number(), amount: z.number().positive() }),
    roles: ['admin', 'manager', 'cashier'],
    handler: (input) => {
      customerRepo.adjustBalance(input.id, -input.amount);
      return { ok: true };
    },
  }),
  'customers.history': defineRoute({
    input: z.object({ id: z.number() }),
    handler: (input) =>
      db()
        .select()
        .from(schema.sales)
        .where(and(eq(schema.sales.customerId, input.id), eq(schema.sales.status, 'completed')))
        .orderBy(desc(schema.sales.createdAt))
        .limit(200)
        .all(),
  }),
  'customers.remove': defineRoute({
    input: z.object({ id: z.number() }),
    roles: ['admin'],
    handler: (input) => {
      customerRepo.remove(input.id);
      return { ok: true };
    },
  }),
});
