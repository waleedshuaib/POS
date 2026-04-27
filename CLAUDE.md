# CLAUDE.md

Context for AI assistants (and humans) working on this repo. Keep it short — link to `docs/` for depth.

## What this is

**Mizan / ميزان** — offline-first Point of Sale desktop app (Electron + React + SQLite) for retail in Palestine / West Bank. Bilingual Arabic (RTL) + English. Single-binary install (.dmg / .exe), all data local, optional ESC/POS thermal printing.

For the why and the high-level overview see [`docs/01-overview.md`](./docs/01-overview.md). The doc index is [`docs/README.md`](./docs/README.md).

## Stack one-liner

Electron 30 + electron-vite + React 18 + TypeScript + Tailwind + SQLite (better-sqlite3) + Drizzle ORM + Zustand + TanStack Query + react-i18next + Vitest + Playwright + argon2.

## Daily commands

```bash
npm run dev          # launch app (empty DB, just admin user)
npm run dev:seed     # launch with full Palestinian supermarket seed
npm test             # 96 unit + integration tests via Electron's Node
npm run verify       # typecheck + tests + smoke (CI-equivalent)
npm run package      # build .dmg + .exe in dist/
npm run rebuild:electron   # if native modules ever drift
```

Default login when DB is empty: `admin / admin`. With `dev:seed`: `admin/admin`, `manager/manager`, `cashier1|2|3 / cashier`. Change immediately in *Users*.

## Architecture in 5 lines

Three Electron processes: sandboxed React renderer → preload bridge exposes `window.pos.invoke({action, input, token})` → main-process typed router (Zod-validated, role-checked) → services (transactions, invariants) → repos → SQLite via Drizzle.

Full picture: [`docs/03-architecture.md`](./docs/03-architecture.md). Adding a feature end-to-end: [`docs/13-contributing.md`](./docs/13-contributing.md).

## Non-obvious things — read before changing

1. **Tests run through Electron's embedded Node**, not system Node. `npm test` is `ELECTRON_RUN_AS_NODE=1 electron …vitest.mjs run --pool=forks`. This avoids the ABI 127 vs 128 mismatch with `better-sqlite3` / `argon2`. Don't switch tests back to plain Node — you'll spend an afternoon on rebuild scripts.

2. **Native module gotcha**: `postinstall` runs `electron-rebuild -f`. If you ever see `NODE_MODULE_VERSION 127 vs 128`, run `npm run rebuild:electron`. Cause: `@electron/rebuild` silently downloads mismatched prebuilts and writes a wrong `.forge-meta` cache marker — `-f` busts it.

3. **Passwords are argon2-hashed and CANNOT be displayed.** Admin can *reset* any user's password OR *impersonate* (re-enter their own admin password to switch session). Don't add a "view password" feature — multiple users have asked, the answer is the same: it's cryptographically impossible by design.

4. **Stock-out does NOT block sales.** Inventory just goes negative; the shop refills from the backroom and reconciles via *Inventory → Adjust* later. Do not add validation that rejects sales when qty <= 0. Real West Bank shops sell faster than they update inventory.

5. **Per-cashier sales visibility**: `sales.list`, `sales.listHeld`, `sales.todayStats` IPC routes filter by `userId` when `ctx.session.role === 'cashier'`. Admin/manager see everything.

6. **i18n key parity is enforced by tests** (`tests/unit/i18n.test.ts`). Add a key to both `locales/ar/common.json` AND `locales/en/common.json` or CI fails.

7. **Money inputs use the `<MoneyInput>` component**, not raw `<input type="number">`. It rounds to 2 decimals on blur and shows EMPTY (not "0") when the value is null. See `src/renderer/components/NumberInput.tsx`.

8. **Forms use the validation primitives** in `src/renderer/components/Validation.tsx`: `<Field>`, `<ValidationSummary>`, `<ServerError>`. Pattern: local `errors` memo + `submitted` boolean → show errors only after the user tries to submit.

9. **Seed is gated on `POS_SEED=palestine`** env var. `npm run dev` always creates an admin user (so the app is loginable) but skips the rich Palestinian catalog. `npm run dev:seed` sets the env var to load the full 90-product catalog. Useful for screenshots, demos, and onboarding.

10. **Auto-backup runs on app start (if stale) + every 24h**. Two slots at `userData/backups/`: `pos-new.zip` (latest) + `pos-old.zip` (previous). On each fire: rename old new → old, write fresh new. Customer always has 2 restore points.

11. **Daily logs** at `userData/logs/YYYY-MM-DD.log`, 14-day retention. Every IPC call is logged with duration; warns on >200ms. Format is grep-friendly: `<ISO ts> <LEVEL> <event> <json>`.

## Where things live

```
src/
├── main/                    # Electron main process (Node)
│   ├── db/                  # schema (Drizzle), migration runner, client
│   ├── repos/               # one file per aggregate; pure DB access
│   ├── services/            # business logic + transactions
│   ├── auth/                # argon2 + in-memory sessions
│   ├── printing/            # ESC/POS + pdf-lib fallback
│   ├── ipc/
│   │   ├── router.ts        # Zod validation + role check + dispatch + log
│   │   ├── handlers.ts      # central side-effect import (load order safe)
│   │   └── handlers/*.ts    # one file per domain
│   ├── logger.ts            # daily rotating log
│   ├── backup-scheduler.ts  # daily auto-backup with old/new pair
│   └── seed*.ts             # admin always; Palestinian catalog if POS_SEED=palestine
├── preload/index.ts         # contextBridge exposing window.pos
├── renderer/                # React app
│   ├── components/          # AppShell, Modal, NumberInput, Validation, …
│   ├── features/<name>/     # one folder per feature (auth, pos, products, …)
│   ├── lib/                 # api.ts (typed wrapper over IPC), format.ts
│   └── i18n/locales/{ar,en}/common.json   # ALL UI strings; parity enforced
├── shared/                  # types/zod schemas used by both sides
tests/
├── unit/                    # pure functions (pricing, i18n parity, help)
├── integration/             # services + real SQLite in temp dir
│   ├── checkout.test.ts
│   ├── returns.test.ts
│   ├── purchases.test.ts
│   ├── reports.test.ts
│   ├── drawer.test.ts
│   ├── smoke.test.ts        # 22-step single-day scenario
│   └── full-e2e.test.ts     # 37 cross-module assertions on Palestinian seed
└── e2e/                     # Playwright against the packaged binary
docs/                        # 16 short topic files; start at docs/README.md
drizzle/                     # hand-written migration SQL (committed)
scripts/                     # verify.sh, seed-dev, reset-db
```

## Conventions

- **No business logic in IPC handlers.** Handlers do: validate input → check role → call a service → return data. Anything more complex goes in `src/main/services/`.
- **Never touch the DB outside a repo.** Repos are the only place with `db().select(…)` calls.
- **Wrap multi-step state changes in a transaction**: `rawDb().transaction(() => { … })`. See `services/checkout.ts` for the pattern.
- **All mutating services accept `userId`** and write to `audit_log` for non-trivial actions (sale.complete, sale.void, return, purchase, drawer open/close, impersonate).
- **Comments are rare.** Only when the WHY is non-obvious. Don't restate what the code already says.
- **Branding constants**: app brand is "Mizan / ميزان". Per-customer store name comes from the `settings` table (`store.name_ar` / `store.name_en`) and shows beside the brand in the sidebar.

## What NOT to commit

`.gitignore` already excludes `node_modules/`, `out/`, `dist/`, `*.db*`, `*.tsbuildinfo`, `.pos-dev/`. Don't commit:
- generated build artifacts
- the dev SQLite DB
- screenshots from your local machine (put them in `docs/` only if they're general-purpose)
- secrets (there are none in the repo today; keep it that way)

## When something breaks

1. `npm run verify` — first, make sure the baseline is green.
2. Check `userData/logs/<today>.log` — every IPC call is in there with timing.
3. The latest auto-backup at `userData/backups/pos-new.zip` lets you restore the DB to ≤24h ago state.
4. For Electron-specific weirdness ("module compiled against different Node"): `npm run rebuild:electron`.

## Roadmap

See [`docs/14-future-enhancements.md`](./docs/14-future-enhancements.md) — short, prioritized list including security hardening (ASAR integrity, code signing, SQLite encryption), auto-updates, multi-terminal sync, and Palestinian e-invoicing integration.
