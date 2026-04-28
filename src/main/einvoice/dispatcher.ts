import type { EInvoiceProvider } from './provider';
import { noopProvider } from './noop';
import { palestineTaxProvider } from './palestine-tax';
import { settingsRepo } from '../repos/settingsRepo';
import { saleRepo } from '../repos/saleRepo';
import { customerRepo } from '../repos/partyRepo';
import { auditRepo } from '../repos/auditRepo';
import { log } from '../logger';

const REGISTRY: Record<string, EInvoiceProvider> = {
  none: noopProvider,
  'palestine-tax': palestineTaxProvider,
};

export function activeProvider(): EInvoiceProvider {
  const key = settingsRepo.get('einvoice.provider') ?? 'none';
  return REGISTRY[key] ?? noopProvider;
}

/**
 * Submit a completed sale to the active provider asynchronously.
 * Never throws; logs + audits the outcome. Called from the checkout service
 * AFTER the sale is committed to the local DB so a network failure can't
 * undo a real cash transaction.
 */
export async function dispatchSale(saleId: number): Promise<void> {
  const provider = activeProvider();
  if (provider.name === 'none') return;

  const sale = saleRepo.findById(saleId);
  if (!sale || sale.status !== 'completed') return;

  const items = saleRepo.listItems(saleId);
  const payments = saleRepo.listPayments(saleId);
  const customer = sale.customerId ? customerRepo.findById(sale.customerId) : null;

  const settings = settingsRepo.getAll();
  const language = (settings['language.default'] === 'en' ? 'en' : 'ar') as 'ar' | 'en';

  let result;
  try {
    result = await provider.submit({
      sale,
      items,
      payments,
      context: {
        storeName: language === 'ar' ? settings['store.name_ar'] ?? '' : settings['store.name_en'] ?? '',
        storeAddress: settings['store.address'],
        storeTaxId: settings['store.tax_id'],
        customerName: customer?.name ?? null,
        customerTaxId: customer?.taxId ?? null,
        language,
        currency: settings['currency.symbol'] ?? '₪',
      },
    });
  } catch (err) {
    result = { ok: false, message: (err as Error).message };
  }

  log(result.ok ? 'info' : 'warn', 'einvoice.dispatch', {
    saleId, provider: provider.name, ok: result.ok, externalId: result.externalId, message: result.message,
  });
  auditRepo.log({
    action: 'einvoice.dispatch',
    entity: 'sale',
    entityId: saleId,
    payload: { provider: provider.name, result },
  });
}
