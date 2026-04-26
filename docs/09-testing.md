# 09 — Testing

Three layers.

## Unit tests (Vitest)

Pure functions — pricing engine, formatters, i18n key completeness. No DB, no Electron.

- `tests/unit/pricing.test.ts` — exhaustive: empty carts, negative discounts, over-discount clamping, percent vs amount, multi-line tax.
- `tests/unit/i18n.test.ts` — AR and EN keysets are equal.
- `tests/unit/format.test.ts` — currency, date formatters.

Run: `npm test`.

## Integration tests (Vitest)

Real SQLite in a temp dir. Exercise service → repo → DB flows. No Electron main process; we import modules directly after stubbing `electron.app.getPath`.

- `tests/integration/checkout.test.ts` — full checkout, inventory decrement, invoice number sequencing, multi-payment, hold/resume, overpayment change, underpayment failure.
- `tests/integration/returns.test.ts` — partial and full return flows.
- `tests/integration/purchases.test.ts` — purchase raises inventory & supplier balance.
- `tests/integration/reports.test.ts` — sales-by-day and P&L over known data.
- `tests/integration/drawer.test.ts` — open/close variance.

Each test uses `beforeEach` to spin up a fresh in-memory SQLite, run migrations, and seed a user.

## E2E (Playwright)

Launches the built Electron app (`out/` after `npm run build`) and drives the renderer.

- `tests/e2e/happy-path.spec.ts` — login → create product → ring up sale → reprint → assert in Sales list.

Run: `npm run build && npm run test:e2e`.

## Coverage

`npm run test:coverage` enforces:
- Lines ≥ 80% overall.
- 100% on `src/main/services/pricing.ts` (pure, easy to cover).

## What's NOT tested automatically

- Actual thermal printing (requires hardware).
- System print dialog / OS-level PDF viewer.
- Code signing of installers.

These are documented as manual verification steps in the README.
