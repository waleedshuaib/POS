import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { settingsRepo } from '../../repos/settingsRepo';

registerRoutes({
  'settings.getAll': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => settingsRepo.getAll(),
  }),
  'settings.set': defineRoute({
    input: z.record(z.string(), z.string()),
    roles: ['admin', 'manager'],
    handler: (input) => {
      settingsRepo.setMany(input);
      return { ok: true };
    },
  }),
});
