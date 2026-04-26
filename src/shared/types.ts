import { z } from 'zod';

export type Role = 'admin' | 'manager' | 'cashier';

export const ROLES: readonly Role[] = ['admin', 'manager', 'cashier'] as const;

export const RoleSchema = z.enum(['admin', 'manager', 'cashier']);

export const PaymentMethodSchema = z.enum(['cash', 'card', 'bank_transfer', 'credit', 'check']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const SaleStatusSchema = z.enum(['completed', 'held', 'voided', 'returned']);
export type SaleStatus = z.infer<typeof SaleStatusSchema>;

export const UnitSchema = z.enum(['pc', 'kg', 'g', 'l', 'ml', 'm']);
export type Unit = z.infer<typeof UnitSchema>;

export interface SessionInfo {
  token: string;
  userId: number;
  username: string;
  fullName: string;
  role: Role;
  expiresAt: number;
}
