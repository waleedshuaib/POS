# 12 — Hardware

## Barcode scanners

Any USB scanner that behaves as an HID keyboard works. That covers 95% of the market (Honeywell, Zebra, cheap generics).

- No driver, no config. Just plug in.
- Scanner types the barcode + Enter into the focused input.
- On the POS screen, the search field is always focused. Submitting triggers `products.getByBarcode`; if no match it falls back to `products.search`.

If your scanner is in "non-keyboard" mode (e.g., serial over USB), switch it to HID via the manufacturer's programming sheet.

## Thermal printers

Tested targets (ESC/POS-compatible):
- Epson TM-T20 / TM-T88 (USB + Ethernet).
- Xprinter XP-58 / XP-80 (USB).
- Bixolon SRP-350.
- Most MENA-market unbranded 58mm/80mm ESC/POS clones.

Setup:
- USB: find vendor/product IDs with `lsusb` (macOS/Linux) or Device Manager (Windows). Set `printer.vendor_id` and `printer.product_id` in Settings.
- Network: set `printer.host` and `printer.port` (usually 9100).

Arabic printing:
- Modern Epson TM-T88VI supports CP1256 in firmware — set `printer.arabic_mode = cp1256`.
- Cheap clones usually don't. Use `printer.arabic_mode = image` — the main process renders Arabic text to a small bitmap and sends it as an ESC/POS raster image.

## Cash drawer

Any RJ11/RJ12 drawer that opens on the printer's "kick" pulse works. When the ESC/POS code emits the pulse after a sale, the drawer opens. No separate config.

## POS terminal

Runs fine on:
- Mac mini (M1/M2) with a USB-C hub.
- Any Windows 10/11 x64 machine with 4+ GB RAM.
- Touch screens work out of the box — POS buttons are large and Tailwind's hit targets are 44px+.
