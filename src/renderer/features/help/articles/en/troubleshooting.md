# Troubleshooting

## App won't start
- Make sure Node.js 20+ is installed.
- macOS: install Xcode Command Line Tools (`xcode-select --install`).
- Windows: install build tools via `npm i -g windows-build-tools`.

## Printer not working
- Make sure **Printer enabled** is set in *Settings*.
- USB: check the device is connected.
- Network: check IP address and port.
- If thermal printing fails, a PDF preview opens and prints to your default printer.

## Barcode not adding products
- Make sure the search field is focused.
- Check that the product's recorded barcode matches the label.
- Some scanners need programming to send Enter after scan — see the scanner manual.

## Corrupted database
- Restore the latest backup from *Settings*.
- Don't manually delete the database file while the app is running.

## Arabic numbers
Numbers display in Western format (ISO) by default. This will be configurable in a future version.
