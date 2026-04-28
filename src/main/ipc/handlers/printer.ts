import { z } from 'zod';
import { defineRoute, registerRoutes } from '../router';
import { generateReceiptPdf, printViaEscPos } from '../../printing/receipt';
import { settingsRepo } from '../../repos/settingsRepo';
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
    input: z.object({ saleId: z.number(), language: LangSchema.optional(), forcePreview: z.boolean().optional() }),
    handler: async (input) => {
      const lang = input.language ?? 'ar';
      const previewDefault = settingsRepo.get('receipt.preview_default') === 'true';
      const wantPreview = input.forcePreview === true || (input.forcePreview === undefined && previewDefault);

      // PDF preview path: render the PDF, open it in a hidden window, and let
      // the user click "Print" themselves via Electron's print dialog.
      if (wantPreview) {
        const pdf = await generateReceiptPdf(input.saleId, lang);
        const win = new BrowserWindow({
          width: 480,
          height: 720,
          title: `Receipt — ${input.saleId}`,
          webPreferences: { sandbox: true },
        });
        await win.loadFile(pdf);
        win.show();
        return { method: 'preview', path: pdf };
      }

      // Silent print path: try thermal first, fall back to system print dialog.
      const res = await printViaEscPos(input.saleId, lang);
      if (!res.printed) {
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
