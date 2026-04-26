import { renderReceiptPdf, findArabicFont, type ReceiptData } from './invoice-pdf';
import { settingsRepo } from '../repos/settingsRepo';
import { saleRepo } from '../repos/saleRepo';
import { userRepo } from '../repos/userRepo';
import { customerRepo } from '../repos/partyRepo';
import { join } from 'path';
import { tmpdir } from 'os';

function electronTempDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('electron');
    return mod?.app?.getPath?.('temp') ?? tmpdir();
  } catch {
    return tmpdir();
  }
}

function buildReceiptData(saleId: number, language: 'ar' | 'en'): ReceiptData {
  const sale = saleRepo.findById(saleId);
  if (!sale) throw new Error('Sale not found');
  const items = saleRepo.listItems(saleId);
  const payments = saleRepo.listPayments(saleId);
  const cashier = userRepo.findById(sale.userId);
  const customer = sale.customerId ? customerRepo.findById(sale.customerId) : null;
  const settings = settingsRepo.getAll();

  return {
    invoiceNo: sale.invoiceNo,
    storeName: language === 'ar' ? settings['store.name_ar'] ?? 'Store' : settings['store.name_en'] ?? 'Store',
    storeAddress: settings['store.address'],
    storePhone: settings['store.phone'],
    date: sale.createdAt,
    cashier: cashier?.fullName ?? '',
    customer: customer?.name ?? null,
    currency: settings['currency.symbol'] ?? '₪',
    language,
    lines: items.map((i) => ({
      name: i.nameAtSale,
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotal: sale.subtotal,
    discountTotal: sale.discountTotal,
    taxTotal: sale.taxTotal,
    grandTotal: sale.grandTotal,
    payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
    changeDue: sale.changeDue,
    header: settings['receipt.header'],
    footer: settings['receipt.footer'],
  };
}

export async function generateReceiptPdf(saleId: number, language: 'ar' | 'en'): Promise<string> {
  const data = buildReceiptData(saleId, language);
  const outDir = electronTempDir();
  const outPath = join(outDir, `receipt-${data.invoiceNo}.pdf`);
  const arabicFont = language === 'ar' ? findArabicFont() : null;
  await renderReceiptPdf(data, outPath, arabicFont ?? undefined);
  return outPath;
}

export interface PrintResult {
  printed: boolean;
  message: string;
}

/**
 * Prints a receipt on an ESC/POS thermal printer.
 * Loads node-thermal-printer dynamically so the app still runs on systems without it.
 * On any failure, the caller should fall back to the PDF+system-print path.
 */
export async function printViaEscPos(saleId: number, language: 'ar' | 'en'): Promise<PrintResult> {
  const settings = settingsRepo.getAll();
  if (settings['printer.enabled'] !== 'true') {
    return { printed: false, message: 'Printer not enabled in settings' };
  }

  try {
    const ntp: any = await import('node-thermal-printer').catch(() => null);
    if (!ntp) return { printed: false, message: 'Thermal printer library unavailable' };

    const { printer: Printer, types: Types } = ntp;
    const type = Types.EPSON; // safe default; works for most ESC/POS clones

    const connectionType = settings['printer.type'] === 'network' ? 'tcp' : 'usb';
    let interfaceStr: string;
    if (connectionType === 'tcp') {
      const host = settings['printer.host'];
      const port = settings['printer.port'] ?? '9100';
      if (!host) return { printed: false, message: 'Network printer host not set' };
      interfaceStr = `tcp://${host}:${port}`;
    } else {
      // USB: node-thermal-printer accepts a vendor/product id as 'printer:VID:PID'
      // or a device path on *nix. We let the user configure via printer.host for flexibility;
      // fallback to printer:auto.
      interfaceStr = settings['printer.host'] || 'printer:auto';
    }

    const printer = new Printer({
      type,
      interface: interfaceStr,
      characterSet: 'PC864_ARABIC',
      width: 48,
      removeSpecialCharacters: false,
    });

    const connected = await printer.isPrinterConnected?.().catch(() => false);
    if (connected === false) return { printed: false, message: 'Thermal printer is not connected' };

    const data = buildReceiptData(saleId, language);

    printer.alignCenter();
    printer.bold(true);
    printer.println(data.storeName);
    printer.bold(false);
    if (data.storeAddress) printer.println(data.storeAddress);
    if (data.storePhone) printer.println(data.storePhone);
    if (data.header) printer.println(data.header);
    printer.drawLine();

    printer.alignLeft();
    printer.println(`${language === 'ar' ? 'فاتورة' : 'Invoice'}: ${data.invoiceNo}`);
    printer.println(`${language === 'ar' ? 'التاريخ' : 'Date'}: ${data.date.toLocaleString()}`);
    printer.println(`${language === 'ar' ? 'الكاشير' : 'Cashier'}: ${data.cashier}`);
    if (data.customer) printer.println(`${language === 'ar' ? 'العميل' : 'Customer'}: ${data.customer}`);
    printer.drawLine();

    for (const l of data.lines) {
      printer.tableCustom([
        { text: l.name, align: 'LEFT', width: 0.5 },
        { text: String(l.qty), align: 'CENTER', width: 0.15 },
        { text: l.unitPrice.toFixed(2), align: 'RIGHT', width: 0.15 },
        { text: l.lineTotal.toFixed(2), align: 'RIGHT', width: 0.2 },
      ]);
    }
    printer.drawLine();

    const pad = (label: string, value: string) => {
      const line = `${label}: ${value}`;
      printer.alignRight();
      printer.println(line);
    };
    pad(language === 'ar' ? 'المجموع الفرعي' : 'Subtotal', `${data.subtotal.toFixed(2)} ${data.currency}`);
    if (data.discountTotal > 0)
      pad(language === 'ar' ? 'الخصم' : 'Discount', `${data.discountTotal.toFixed(2)} ${data.currency}`);
    if (data.taxTotal > 0)
      pad(language === 'ar' ? 'الضريبة' : 'Tax', `${data.taxTotal.toFixed(2)} ${data.currency}`);
    printer.bold(true);
    pad(language === 'ar' ? 'الإجمالي' : 'Total', `${data.grandTotal.toFixed(2)} ${data.currency}`);
    printer.bold(false);

    for (const p of data.payments) pad(p.method, p.amount.toFixed(2));
    if (data.changeDue > 0) pad(language === 'ar' ? 'الباقي' : 'Change', data.changeDue.toFixed(2));

    if (data.footer) {
      printer.drawLine();
      printer.alignCenter();
      printer.println(data.footer);
    }

    printer.cut();
    // Fire the drawer "kick" so a connected cash drawer opens.
    printer.openCashDrawer?.();

    const ok = await printer.execute();
    return { printed: !!ok, message: ok ? 'Printed' : 'Printer execute failed' };
  } catch (err) {
    return { printed: false, message: `Printer error: ${(err as Error).message}` };
  }
}
