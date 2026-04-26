import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { supplierRepo } from '../../repos/partyRepo';

registerRoutes({
  'suppliers.list': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => supplierRepo.list(),
  }),
  'suppliers.get': defineRoute({
    input: z.object({ id: z.number() }),
    handler: (input) => supplierRepo.findById(input.id) ?? null,
  }),
  'suppliers.create': defineRoute({
    input: z.object({
      name: z.string().min(1),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      taxId: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    }),
    roles: ['admin', 'manager'],
    handler: (input) => ({ id: supplierRepo.insert(input as any) }),
  }),
  'suppliers.update': defineRoute({
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
      supplierRepo.update(id, patch as any);
      return { ok: true };
    },
  }),
  'suppliers.paySupplier': defineRoute({
    input: z.object({ id: z.number(), amount: z.number().positive() }),
    roles: ['admin', 'manager'],
    handler: (input) => {
      supplierRepo.adjustBalance(input.id, -input.amount);
      return { ok: true };
    },
  }),
  'suppliers.remove': defineRoute({
    input: z.object({ id: z.number() }),
    roles: ['admin'],
    handler: (input) => {
      supplierRepo.remove(input.id);
      return { ok: true };
    },
  }),
});
