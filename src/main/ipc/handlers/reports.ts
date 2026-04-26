import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import * as reports from '../../services/reports';

const DateRange = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

registerRoutes({
  'reports.salesByDay': defineRoute({
    input: DateRange,
    roles: ['admin', 'manager'],
    handler: (input) => reports.salesByDay(input.from, input.to),
  }),
  'reports.topProducts': defineRoute({
    input: DateRange.extend({ limit: z.number().optional() }),
    roles: ['admin', 'manager'],
    handler: (input) => reports.topProducts(input.from, input.to, input.limit ?? 10),
  }),
  'reports.profitLoss': defineRoute({
    input: DateRange,
    roles: ['admin', 'manager'],
    handler: (input) => reports.profitLoss(input.from, input.to),
  }),
  'reports.paymentsByMethod': defineRoute({
    input: DateRange,
    roles: ['admin', 'manager'],
    handler: (input) => reports.paymentsByMethod(input.from, input.to),
  }),
  'reports.salesByCashier': defineRoute({
    input: DateRange,
    roles: ['admin', 'manager'],
    handler: (input) => reports.salesByCashier(input.from, input.to),
  }),
  'reports.inventoryValuation': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin', 'manager'],
    handler: () => reports.inventoryValuation(),
  }),
  'reports.lowStock': defineRoute({
    input: z.object({}).optional().default({}),
    handler: () => reports.lowStock(),
  }),
});
