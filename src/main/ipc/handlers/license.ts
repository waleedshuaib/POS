import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { checkLicense, installLicense, uninstallLicense, machineFingerprint, isAdminAllowed } from '../../licensing/license';
import { auditRepo } from '../../repos/auditRepo';

registerRoutes({
  'license.status': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => ({
      ...checkLicense(),
      machineId: machineFingerprint(),
      adminAllowed: isAdminAllowed(),
    }),
  }),
  'license.install': defineRoute({
    input: z.object({ json: z.string().min(10) }),
    roles: ['admin'],
    handler: (input, ctx) => {
      const result = installLicense(input.json);
      auditRepo.log({
        userId: ctx.session?.userId,
        action: 'license.install',
        entity: 'license',
        payload: { state: result.state },
      });
      return result;
    },
  }),
  'license.uninstall': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin'],
    handler: (_input, ctx) => {
      uninstallLicense();
      auditRepo.log({ userId: ctx.session?.userId, action: 'license.uninstall', entity: 'license' });
      return { ok: true };
    },
  }),
});
