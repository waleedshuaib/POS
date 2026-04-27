import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { defineRoute, registerRoutes } from '../router';
import { db, schema } from '../../db/client';
import { hashPassword, verifyPassword } from '../../auth/password';
import { createSession, destroySession } from '../../auth/session';
import { auditRepo } from '../../repos/auditRepo';

registerRoutes({
  'auth.login': defineRoute({
    input: z.object({ username: z.string().min(1), password: z.string().min(1) }),
    roles: 'public',
    handler: async ({ username, password }) => {
      const d = db();
      const user = d.select().from(schema.users).where(eq(schema.users.username, username)).get();
      if (!user || !user.active) throw new Error('Invalid credentials');
      const ok = await verifyPassword(user.passwordHash, password);
      if (!ok) throw new Error('Invalid credentials');

      d.update(schema.users)
        .set({ lastLoginAt: new Date() })
        .where(eq(schema.users.id, user.id))
        .run();

      const session = createSession({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      });
      return {
        token: session.token,
        userId: session.userId,
        username: session.username,
        fullName: session.fullName,
        role: session.role,
        expiresAt: session.expiresAt,
      };
    },
  }),
  'auth.me': defineRoute({
    input: z.object({}).optional().default({}),
    handler: async (_input, ctx) => {
      if (!ctx.session) throw new Error('No session');
      return {
        userId: ctx.session.userId,
        username: ctx.session.username,
        fullName: ctx.session.fullName,
        role: ctx.session.role,
        expiresAt: ctx.session.expiresAt,
      };
    },
  }),
  'auth.logout': defineRoute({
    input: z.object({}).optional().default({}),
    handler: async (_input, ctx) => {
      if (ctx.token) destroySession(ctx.token);
      return { ok: true };
    },
  }),
  'auth.changePassword': defineRoute({
    input: z.object({ oldPassword: z.string(), newPassword: z.string().min(4) }),
    handler: async (input, ctx) => {
      if (!ctx.session) throw new Error('No session');
      const d = db();
      const user = d.select().from(schema.users).where(eq(schema.users.id, ctx.session.userId)).get();
      if (!user) throw new Error('User not found');
      const ok = await verifyPassword(user.passwordHash, input.oldPassword);
      if (!ok) throw new Error('Old password incorrect');
      const hash = await hashPassword(input.newPassword);
      d.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, user.id)).run();
      return { ok: true };
    },
  }),
  'auth.impersonate': defineRoute({
    input: z.object({ targetUserId: z.number(), adminPassword: z.string().min(1) }),
    roles: ['admin'],
    handler: async (input, ctx) => {
      if (!ctx.session) throw new Error('No session');
      const d = db();
      const admin = d.select().from(schema.users).where(eq(schema.users.id, ctx.session.userId)).get();
      if (!admin || admin.role !== 'admin') throw new Error('Admin only');
      const ok = await verifyPassword(admin.passwordHash, input.adminPassword);
      if (!ok) throw new Error('Admin password incorrect');
      const target = d.select().from(schema.users).where(eq(schema.users.id, input.targetUserId)).get();
      if (!target) throw new Error('Target user not found');
      if (!target.active) throw new Error('Target user is disabled');
      d.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, target.id)).run();
      const session = createSession({
        id: target.id,
        username: target.username,
        fullName: target.fullName,
        role: target.role,
      });
      // Audit-log so the admin's impersonation is traceable.
      auditRepo.log({
        userId: ctx.session.userId,
        action: 'auth.impersonate',
        entity: 'user',
        entityId: target.id,
        payload: { admin: admin.username, target: target.username },
      });
      return {
        token: session.token,
        userId: session.userId,
        username: session.username,
        fullName: session.fullName,
        role: session.role,
        expiresAt: session.expiresAt,
      };
    },
  }),
});
