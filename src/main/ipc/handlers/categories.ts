import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { categoryRepo } from '../../repos/categoryRepo';

registerRoutes({
  'categories.list': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => categoryRepo.list(),
  }),
  'categories.create': defineRoute({
    input: z.object({ nameAr: z.string().min(1), nameEn: z.string().min(1), parentId: z.number().nullable().optional() }),
    roles: ['admin', 'manager'],
    handler: (input) => ({ id: categoryRepo.insert(input.nameAr, input.nameEn, input.parentId ?? null) }),
  }),
  'categories.update': defineRoute({
    input: z.object({ id: z.number(), nameAr: z.string().optional(), nameEn: z.string().optional(), parentId: z.number().nullable().optional() }),
    roles: ['admin', 'manager'],
    handler: (input) => {
      const { id, ...patch } = input;
      categoryRepo.update(id, patch);
      return { ok: true };
    },
  }),
  'categories.remove': defineRoute({
    input: z.object({ id: z.number() }),
    roles: ['admin'],
    handler: (input) => {
      categoryRepo.remove(input.id);
      return { ok: true };
    },
  }),
});
