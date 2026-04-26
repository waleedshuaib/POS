import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface ReceiptLine {
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  invoiceNo: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  date: Date;
  cashier: string;
  customer?: string | null;
  currency: string;
  lines: ReceiptLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  payments: Array<{ method: string; amount: number }>;
  changeDue: number;
  header?: string;
  footer?: string;
  language: 'ar' | 'en';
}

export async function renderReceiptPdf(data: ReceiptData, outPath: string, arabicFontPath?: string): Promise<string> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  let font = await doc.embedFont(StandardFonts.Helvetica);
  let bold = await doc.embedFont(StandardFonts.HelveticaBold);

  if (data.language === 'ar' && arabicFontPath && existsSync(arabicFontPath)) {
    const bytes = readFileSync(arabicFontPath);
    font = await doc.embedFont(bytes, { subset: true });
    bold = font;
  }

  const width = 226; // 80mm receipt ~= 226pt
  const margin = 12;
  let y = 800;
  const page = doc.addPage([width, 800]);
  const lineH = 14;

  const write = (text: string, opts: { bold?: boolean; size?: number; align?: 'left' | 'right' | 'center' } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? bold : font;
    const textWidth = f.widthOfTextAtSize(text, size);
    let x = margin;
    if (opts.align === 'right') x = width - margin - textWidth;
    else if (opts.align === 'center') x = (width - textWidth) / 2;
    page.drawText(text, { x, y, size, font: f, color: rgb(0, 0, 0) });
    y -= lineH;
  };

  const sep = () => {
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: width - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 6;
  };

  write(data.storeName, { bold: true, size: 12, align: 'center' });
  if (data.storeAddress) write(data.storeAddress, { align: 'center', size: 9 });
  if (data.storePhone) write(data.storePhone, { align: 'center', size: 9 });
  if (data.header) write(data.header, { align: 'center', size: 9 });
  sep();

  write(`${data.language === 'ar' ? 'فاتورة' : 'Invoice'}: ${data.invoiceNo}`);
  write(`${data.language === 'ar' ? 'التاريخ' : 'Date'}: ${data.date.toLocaleString()}`);
  write(`${data.language === 'ar' ? 'الكاشير' : 'Cashier'}: ${data.cashier}`);
  if (data.customer) write(`${data.language === 'ar' ? 'العميل' : 'Customer'}: ${data.customer}`);
  sep();

  for (const l of data.lines) {
    write(l.name, { size: 9 });
    write(`  ${l.qty} x ${l.unitPrice.toFixed(2)}`, { size: 9 });
    write(`${l.lineTotal.toFixed(2)} ${data.currency}`, { size: 9, align: 'right' });
  }
  sep();

  write(`${data.language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}: ${data.subtotal.toFixed(2)} ${data.currency}`, { align: 'right' });
  if (data.discountTotal > 0) write(`${data.language === 'ar' ? 'الخصم' : 'Discount'}: ${data.discountTotal.toFixed(2)} ${data.currency}`, { align: 'right' });
  if (data.taxTotal > 0) write(`${data.language === 'ar' ? 'الضريبة' : 'Tax'}: ${data.taxTotal.toFixed(2)} ${data.currency}`, { align: 'right' });
  write(`${data.language === 'ar' ? 'الإجمالي' : 'Total'}: ${data.grandTotal.toFixed(2)} ${data.currency}`, { bold: true, size: 12, align: 'right' });
  sep();

  for (const p of data.payments) {
    write(`${p.method}: ${p.amount.toFixed(2)}`, { align: 'right', size: 9 });
  }
  if (data.changeDue > 0) write(`${data.language === 'ar' ? 'الباقي' : 'Change'}: ${data.changeDue.toFixed(2)}`, { align: 'right', size: 9 });

  if (data.footer) {
    sep();
    write(data.footer, { align: 'center', size: 9 });
  }

  const pdfBytes = await doc.save();
  writeFileSync(outPath, pdfBytes);
  return outPath;
}

export function findArabicFont(): string | null {
  const candidates = [
    join(process.cwd(), 'src/renderer/assets/fonts/Amiri-Regular.ttf'),
    join(process.cwd(), 'assets/fonts/Amiri-Regular.ttf'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
