# 07 — Printing

Two paths: ESC/POS (thermal) and PDF fallback.

## ESC/POS thermal

Enabled when `printer.enabled` = `true` in settings. Implementation lives in `src/main/printing/receipt.ts::printViaEscPos`. Uses **node-thermal-printer** loaded lazily so the app doesn't crash on systems without USB permissions or the package installed.

Required settings keys:
- `printer.type`: `usb` or `network`.
- For USB: set `printer.host` to a device path (e.g. `/dev/usb/lp0` on Linux, `printer:auto` to auto-detect, or `printer:VID:PID`).
- For network: set `printer.host` (IP) and `printer.port` (usually `9100`).
- Character set is `PC864_ARABIC` by default; edit `receipt.ts` if your printer needs a different code page.

## PDF fallback

`src/main/printing/invoice-pdf.ts::renderReceiptPdf` generates an 80-mm wide PDF (226pt) using `pdf-lib`. English text uses the bundled Helvetica; Arabic uses **Amiri** loaded via `@pdf-lib/fontkit`.

### Installing the Arabic font

Download Amiri OTF/TTF from [github.com/aliftype/amiri/releases](https://github.com/aliftype/amiri) and drop `Amiri-Regular.ttf` into `src/renderer/assets/fonts/` (or `assets/fonts/` in the packaged app). The app auto-detects it.

Without Amiri, Arabic receipts render as tofu (▫). The English fallback and the transactional behavior still work.

## Flow

1. User checks out → `sales.checkout` returns `saleId`.
2. Renderer calls `printer.printNow` with `saleId` + `language`.
3. Main tries ESC/POS; on failure, generates a PDF and opens it in a hidden `BrowserWindow` with `webContents.print({ silent: false })` so the user picks their printer.

## Reprint

`printer.receiptPdf` returns a path; renderer can then call `shell.openPath(path)` to open the system PDF viewer.
