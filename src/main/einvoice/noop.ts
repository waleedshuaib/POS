import type { EInvoiceProvider, EInvoicePayload, EInvoiceResult } from './provider';

/** Default: do nothing, succeed silently. Used when no provider is configured. */
export const noopProvider: EInvoiceProvider = {
  name: 'none',
  async submit(_p: EInvoicePayload): Promise<EInvoiceResult> {
    return { ok: true, message: 'e-invoicing disabled' };
  },
  async healthCheck(): Promise<EInvoiceResult> {
    return { ok: true, message: 'noop' };
  },
};
