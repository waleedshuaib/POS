/**
 * E-invoice provider abstraction.
 *
 * Why this exists today even though Palestine's e-invoice spec isn't final:
 * the contract surface is small and stable across countries (KSA ZATCA,
 * Egypt's e-invoice, EU PEPPOL, etc.). When the PA Tax & Customs API ships,
 * we add one new file (palestine-tax.ts), wire it into the registry below,
 * and the rest of the app doesn't move. Saves 2-3 days of "where do we put
 * this" panic when the deadline arrives.
 */

import type { Sale, SaleItem, SalePayment } from '../db/schema';

export interface EInvoiceContext {
  storeName: string;
  storeAddress?: string;
  storeTaxId?: string;
  customerName?: string | null;
  customerTaxId?: string | null;
  language: 'ar' | 'en';
  currency: string;
}

export interface EInvoicePayload {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
  context: EInvoiceContext;
}

export interface EInvoiceResult {
  ok: boolean;
  /** Provider-issued external id (e.g. UUID, QR string, PDF hash). */
  externalId?: string;
  /** Pre-rendered QR data (base64 PNG or raw text) when the spec mandates one. */
  qrData?: string;
  /** Free-text status / error message from the provider. */
  message?: string;
}

export interface EInvoiceProvider {
  readonly name: string;
  /** Submit a completed sale. Must NEVER throw — return { ok: false, message }. */
  submit(payload: EInvoicePayload): Promise<EInvoiceResult>;
  /** Optional health-check pinged from Settings → "Test e-invoice". */
  healthCheck?(): Promise<EInvoiceResult>;
}
