/**
 * Palestinian e-invoice provider — PLACEHOLDER.
 *
 * Filled in once the PA Tax & Customs department publishes the official spec.
 * The contract here matches what neighbouring countries (KSA ZATCA, Egypt) ask
 * for, so the eventual real implementation is mostly mapping fields, signing
 * with the merchant's certificate, and POSTing to the gov endpoint.
 *
 * Settings keys this consumer reads (planned):
 *   einvoice.endpoint     — gov API URL
 *   einvoice.merchant_id  — taxpayer registration number
 *   einvoice.cert_path    — path to the merchant's signing certificate
 *   einvoice.environment  — "sandbox" | "production"
 */

import type { EInvoiceProvider, EInvoicePayload, EInvoiceResult } from './provider';
import { settingsRepo } from '../repos/settingsRepo';

export const palestineTaxProvider: EInvoiceProvider = {
  name: 'palestine-tax',
  async submit(payload: EInvoicePayload): Promise<EInvoiceResult> {
    const endpoint = settingsRepo.get('einvoice.endpoint');
    if (!endpoint) {
      return { ok: false, message: 'einvoice.endpoint not configured' };
    }
    // TODO: build signed UBL/JSON payload per PA spec, POST, parse response.
    // For now: pretend-acknowledge so the rest of the pipeline can be tested.
    return {
      ok: true,
      externalId: `PS-PENDING-${payload.sale.invoiceNo}`,
      message: 'Spec pending — sale recorded locally; will be retried when implemented',
    };
  },
  async healthCheck(): Promise<EInvoiceResult> {
    const endpoint = settingsRepo.get('einvoice.endpoint');
    if (!endpoint) return { ok: false, message: 'No endpoint configured' };
    return { ok: true, message: `Configured: ${endpoint}` };
  },
};
