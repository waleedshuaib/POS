import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { userRepo } from '../../repos/userRepo';
import { hashPassword } from '../../auth/password';
import { auditRepo } from '../../repos/auditRepo';
import { RoleSchema } from '@shared/types';

registerRoutes({
  'users.list': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin', 'manager'],
    handler: () =>
      userRepo.list().map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        active: u.active,
        lastLoginAt: u.lastLoginAt,
      })),
  }),
  'users.create': defineRoute({
    input: z.object({
      username: z.string().min(2),
      password: z.string().min(4),
      fullName: z.string().min(1),
      role: RoleSchema,
    }),
    roles: ['admin'],
    handler: async (input, ctx) => {
      if (userRepo.findByUsername(input.username)) throw new Error('Username already exists');
      const hash = await hashPassword(input.password);
      const id = userRepo.insert({
        username: input.username,
        passwordHash: hash,
        fullName: input.fullName,
        role: input.role,
        active: true,
      });
      auditRepo.log({ userId: ctx.session?.userId, action: 'user.create', entity: 'user', entityId: id });
      return { id };
    },
  }),
  'users.update': defineRoute({
    input: z.object({
      id: z.number(),
      fullName: z.string().optional(),
      role: RoleSchema.optional(),
      active: z.boolean().optional(),
      newPassword: z.string().min(4).optional(),
    }),
    roles: ['admin'],
    handler: async (input, ctx) => {
      const patch: any = {};
      if (input.fullName !== undefined) patch.fullName = input.fullName;
      if (input.role !== undefined) patch.role = input.role;
      if (input.active !== undefined) patch.active = input.active;
      if (input.newPassword) patch.passwordHash = await hashPassword(input.newPassword);
      userRepo.update(input.id, patch);
      auditRepo.log({ userId: ctx.session?.userId, action: 'user.update', entity: 'user', entityId: input.id });
      return { ok: true };
    },
  }),
});
