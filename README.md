# POS — Offline Point of Sale (Arabic / English)

A production-quality, **offline-first** desktop Point of Sale for retail shops in Palestine / West Bank. Packaged with Electron, backed by SQLite, Arabic-first (RTL) with full English support. All data stays on your machine.

## Features

- Sales with multi-payment (cash, card, credit, bank transfer, check), hold & resume, returns, voids, change calculation.
- Products with barcode, SKU, category, image, per-product tax rate, low-stock alerts.
- Inventory with manual adjustments and full movement history.
- Customers & suppliers with credit balances.
- Purchases from suppliers that auto-update inventory.
- Reports: sales by day, top products, P&L, payments by method, cashier performance, inventory valuation, low stock — all exportable to CSV.
- Cash drawer open/close with expected-vs-counted variance (Z-report).
- Multi-user with **admin / manager / cashier** roles and argon2-hashed passwords.
- Full **Arabic (RTL)** and **English** UI with bilingual receipts.
- Backup & restore to a zip file you can put on a USB stick.
- **In-app Help** with 12 bilingual articles and full-text search, plus contextual `?` buttons on every page.
- Developer docs under [`docs/`](./docs/README.md).

## Prerequisites

- **Node.js 20+** (`node --version`)
- Build tools for native modules (`better-sqlite3`, `argon2`):
  - **macOS**: Xcode Command Line Tools — `xcode-select --install`
  - **Windows**: Visual Studio Build Tools (C++ workload) — or `npm i -g windows-build-tools` once.
  - **Linux** (dev only): `build-essential`, `python3`.

## Quick start

```bash
# 1. Install dependencies (will compile native modules)
npm install

# 2. (Optional) Drop Amiri-Regular.ttf into src/renderer/assets/fonts/
#    for Arabic PDF receipts. Download from:
#    https://github.com/aliftype/amiri/releases

# 3. Run the app in dev mode
npm run dev
```

The app opens with seeded users:

| Username | Password | Role    |
|----------|----------|---------|
| `admin`  | `admin`  | admin   |
| `cashier`| `cashier`| cashier |

**Change these passwords from the Users page immediately.**

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Launch the app with hot reload |
| `npm run build` | Compile main + preload + renderer to `out/` |
| `npm run package` | Build then produce installers in `dist/` |
| `npm run package:mac` | Build a signed-or-unsigned `.dmg` for macOS |
| `npm run package:win` | Build a `.exe` NSIS installer for Windows |
| `npm test` | Run unit + integration tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Coverage report with 80% threshold |
| `npm run test:e2e` | Playwright E2E against the packaged app |
| `npm run smoke` | Standalone end-to-end smoke test of the backend (no GUI). Exercises auth, products, inventory, sales, multi-payment, hold/resume, void, returns, purchases, drawer, and reports in one run. |
| `npm run verify` | **One-shot verification**: typecheck + unit + integration tests + smoke scenario. This is the command to run to confirm the whole backend is healthy. |
| `npm run rebuild:electron` | Rebuild native modules against Electron's ABI (done automatically after `npm install`). |
| `npm run rebuild:node` | Rebuild native modules against your system Node (needed before `npm test` if you just ran the app). |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run format` | Prettier |
| `npm run db:seed` | Seed sample products to a dev DB |
| `npm run db:reset` | Delete dev DB and re-seed |

## Native module ABI: Electron vs Node

`better-sqlite3` and `argon2` are native modules with C++ code. Electron ships its own Node runtime with a different ABI (NODE_MODULE_VERSION) than your system Node. After `npm install`, a `postinstall` hook rebuilds them for Electron so `npm run dev` just works.

The flipside: Vitest/tsx run under your **system** Node, so before running `npm test` or `npm run smoke` after `npm run dev`, run `npm run rebuild:node` once. `npm run verify` does this flip automatically — prefer it.

## Testing

- **Unit tests** cover the pure pricing engine, formatters, and i18n key completeness.
- **Integration tests** run against a real SQLite DB in a temp dir (no Electron) and cover full checkout, returns, purchases, reports, and drawer flows.
- **E2E tests** launch the packaged Electron app and exercise login → add product → sale.

Run everything:

```bash
npm test
npm run build && npm run test:e2e
```

## Packaging

```bash
npm run package        # both mac and win (on appropriate hosts)
npm run package:mac    # mac only
npm run package:win    # windows only
```

Installers land in `dist/`. They are **unsigned** — to sign later, set `CSC_LINK` / `CSC_KEY_PASSWORD` env vars and re-package.

## Where your data lives

- **macOS**: `~/Library/Application Support/pos/pos.db`
- **Windows**: `%APPDATA%\pos\pos.db`
- Product images: `<userData>/images/`

You can back up these files manually, or use **Settings → Backup** which wraps them in a zip.

## Architecture (one-line tour)

Three Electron processes: sandboxed React renderer → preload bridge exposes `window.pos.invoke` → main-process typed router (Zod-validated, role-checked) → services → repos → SQLite via Drizzle.

See [`docs/03-architecture.md`](./docs/03-architecture.md) for the full picture.

## Troubleshooting

- **Native module build fails on install**: verify Xcode CLT (mac) / VS Build Tools (win) are installed. Then `rm -rf node_modules && npm install`.
- **App opens but barcode scanner does nothing**: click the search box on the POS screen — scanners emit keystrokes into the focused input. Some scanners need reprogramming to send Enter; check your scanner's manual.
- **Arabic PDF receipt shows boxes (tofu)**: drop `Amiri-Regular.ttf` into `src/renderer/assets/fonts/` and re-run.
- **Thermal printer silent**: enable it in *Settings → Printer*. Without it, the app falls back to the system printer via a PDF.

More in [`docs/`](./docs/README.md) and the in-app *Help* page.

## License

MIT.
