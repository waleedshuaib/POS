import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { checkout, voidSale, resumeHeldSale } from '../../services/checkout';
import { saleRepo } from '../../repos/saleRepo';
import { PaymentMethodSchema } from '@shared/types';

registerRoutes({
  'sales.checkout': defineRoute({
    input: z.object({
      customerId: z.number().nullable().optional(),
      lines: z.array(
        z.object({
          productId: z.number(),
          qty: z.number().positive(),
          unitPriceOverride: z.number().min(0).optional(),
          lineDiscount: z.number().min(0).optional(),
        }),
      ).nonempty(),
      orderDiscount: z
        .union([
          z.object({ type: z.literal('none') }),
          z.object({ type: z.literal('amount'), amount: z.number().min(0) }),
          z.object({ type: z.literal('percent'), percent: z.number().min(0).max(100) }),
        ])
        .optional(),
      payments: z.array(
        z.object({
          method: PaymentMethodSchema,
          amount: z.number().min(0),
          reference: z.string().optional(),
        }),
      ),
      notes: z.string().optional(),
      hold: z.object({ name: z.string().min(1) }).nullable().optional(),
    }),
    handler: (input, ctx) =>
      checkout({
        ...input,
        userId: ctx.session!.userId,
        customerId: input.customerId ?? null,
        hold: input.hold ?? null,
      }),
  }),
  'sales.list': defineRoute({
    input: z.object({
      status: z.enum(['completed', 'held', 'voided', 'returned']).optional(),
      limit: z.number().optional(),
    }).optional().default({}),
    handler: (input, ctx) => {
      const cashierOnly = ctx.session?.role === 'cashier';
      const userId = cashierOnly ? ctx.session!.userId : undefined;
      if (input?.status) return saleRepo.listByStatus(input.status, input.limit ?? 200, userId);
      return saleRepo.listRecent(input?.limit ?? 100, userId);
    },
  }),
  'sales.listHeld': defineRoute({
    input: z.object({}).optional().default({}),
    handler: (_input, ctx) => {
      const userId = ctx.session?.role === 'cashier' ? ctx.session.userId : undefined;
      return saleRepo.listByStatus('held', 100, userId);
    },
  }),
  'sales.get': defineRoute({
    input: z.object({ id: z.number() }),
    handler: (input) => {
      const sale = saleRepo.findById(input.id);
      if (!sale) return null;
      return {
        ...sale,
        items: saleRepo.listItems(input.id),
        payments: saleRepo.listPayments(input.id),
      };
    },
  }),
  'sales.getByInvoice': defineRoute({
    input: z.object({ invoiceNo: z.string() }),
    handler: (input) => {
      const sale = saleRepo.findByInvoiceNo(input.invoiceNo);
      if (!sale) return null;
      return { ...sale, items: saleRepo.listItems(sale.id), payments: saleRepo.listPayments(sale.id) };
    },
  }),
  'sales.void': defineRoute({
    input: z.object({ id: z.number() }),
    roles: ['admin', 'manager'],
    handler: async (input, ctx) => {
      await voidSale(input.id, ctx.session!.userId);
      return { ok: true };
    },
  }),
  'sales.resumeHeld': defineRoute({
    input: z.object({ id: z.number() }),
    handler: async (input) => resumeHeldSale(input.id),
  }),
  'sales.todayStats': defineRoute({
    input: z.object({}).optional().default({}),
    handler: (_input, ctx) => {
      const userId = ctx.session?.role === 'cashier' ? ctx.session.userId : undefined;
      return saleRepo.countToday(userId);
    },
  }),
});
