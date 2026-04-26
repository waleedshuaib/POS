import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { generateReceiptPdf, printViaEscPos } from '../../printing/receipt';
import { shell, BrowserWindow } from 'electron';

const LangSchema = z.enum(['ar', 'en']);

registerRoutes({
  'printer.receiptPdf': defineRoute({
    input: z.object({ saleId: z.number(), language: LangSchema.optional() }),
    handler: async (input) => {
      const lang = input.language ?? 'ar';
      const path = await generateReceiptPdf(input.saleId, lang);
      return { path };
    },
  }),
  'printer.openPdf': defineRoute({
    input: z.object({ path: z.string() }),
    handler: async (input) => {
      await shell.openPath(input.path);
      return { ok: true };
    },
  }),
  'printer.printNow': defineRoute({
    input: z.object({ saleId: z.number(), language: LangSchema.optional() }),
    handler: async (input) => {
      const lang = input.language ?? 'ar';
      const res = await printViaEscPos(input.saleId, lang);
      if (!res.printed) {
        // Fallback: open system print dialog via preview window showing the PDF.
        const pdf = await generateReceiptPdf(input.saleId, lang);
        const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
        await win.loadFile(pdf);
        win.webContents.print({ silent: false, printBackground: true }, () => win.close());
        return { method: 'system', path: pdf, message: res.message };
      }
      return { method: 'escpos', path: null, message: res.message };
    },
  }),
  'printer.test': defineRoute({
    input: z.object({}).optional().default({}),
    roles: ['admin', 'manager'],
    handler: async () => {
      const res = await printViaEscPos(-1, 'en');
      return res;
    },
  }),
});
