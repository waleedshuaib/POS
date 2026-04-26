# 01 — Overview

A production-quality, offline-first Point of Sale (POS) desktop application, packaged with Electron, built for retail shops in Palestine/West Bank (Arabic-first, 16% VAT, cash-heavy). Runs on macOS and Windows with a single installer.

## What it does

- **Sales & checkout** with multi-payment (cash, card, credit, check, bank transfer), held sales, returns, voids, change calculation.
- **Products & inventory** with barcode, SKU, category, image, per-product tax rate, low-stock alerts, adjustment movements.
- **Customers & suppliers** with credit balances, settle-credit flow, purchase orders that raise inventory.
- **Reports** for sales-by-day, top products, P&L, payments-by-method, cashier performance, inventory valuation, low stock. CSV export.
- **Daily cash closing** with open/close drawer, expected vs counted variance, Z-report.
- **Multi-user auth** with Admin / Manager / Cashier roles, argon2-hashed passwords.
- **Arabic + English** UI with full RTL, bilingual receipts.
- **Backup / restore** to a zip file containing DB + images.
- **In-app Help** with 12 bilingual articles and full-text search.

## What it isn't

- Not a cloud POS. All data is local; there is no sync yet.
- Not an ERP. It covers retail POS and the adjacent basics.
- Not an accounting system. It produces reports you can hand to an accountant.
