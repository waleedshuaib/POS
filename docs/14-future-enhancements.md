# 14 — Future Enhancements & Hardening

Short, opinionated roadmap for the next lifecycle stages: production hardening, deployment, and protection against reverse engineering. Not prescriptive — pick what fits your risk model.

## Deployment to new devices / clients

**Install flow for a new shop terminal:**
1. Build once per OS: `npm run package:mac` / `npm run package:win` → `dist/POS-1.0.0.dmg` / `POS-Setup-1.0.0.exe`.
2. Ship the installer on a USB stick or via a signed download link.
3. On first launch the app seeds a full Palestinian catalog (see `src/main/seed-palestine.ts`). Login `admin / admin`, then change the password in *Users*.
4. Store owner runs **Settings → Export Backup** nightly to a USB / personal cloud.

**Auto-updates** (add in v1.1):
- Add [`electron-updater`](https://www.electron.build/auto-update) to `package.json`.
- Publish releases to GitHub Releases or an S3 bucket.
- On `app.ready`, `autoUpdater.checkForUpdatesAndNotify()`. Users get a "restart to install" prompt.
- Sign the update artifacts or the integrity check will refuse them.

**Multi-terminal / sync** (future):
- Each terminal keeps its own SQLite as source of truth.
- Add a nightly sync worker that pushes `sales`, `sale_items`, `sale_payments`, and `inventory_movements` to a central server; receives product/price updates back.
- Last-writer-wins is fine for product/price edits; sales are append-only so they just merge.

**Licensing / activation** (for paid deployments):
- Issue a license key tied to a hardware fingerprint (MAC + CPU serial, via `node-machine-id`).
- Store encrypted `license.json` in `userData`. On boot, validate signature with a public key embedded in the app.
- Offline-first: allow N days of grace on a failed check so network drops don't lock the shop out.

## Security against reverse engineering

Electron apps are, by default, **trivial to reverse** — `app.asar` is just a tar-like archive of your JS. Raise the cost of reading your code:

1. **Enable ASAR integrity** (one-line fix, stops casual tampering).
   In `package.json` → `build`:
   ```json
   "asarUnpack": [],
   "electronFuses": { "EnableEmbeddedAsarIntegrityValidation": true, "OnlyLoadAppFromAsar": true }
   ```
   Electron will refuse to load a tampered `app.asar`.

2. **Obfuscate the main-process bundle** with `javascript-obfuscator`.
   Add as an electron-vite rollup plugin targeting only `out/main/`. Don't obfuscate the renderer — it breaks DevTools debugging and adds 2–3× bundle size. Focus on the business logic the attacker cares about.

3. **Compile hot code to V8 bytecode** using [`bytenode`](https://github.com/bytenode/bytenode).
   Convert sensitive services (`src/main/services/checkout.ts`, `pricing.ts`, auth, license check) to `.jsc` files. Bytecode still decompilable but raises the bar significantly.

4. **Encrypt the SQLite database** — swap `better-sqlite3` for [`better-sqlite3-multiple-ciphers`](https://github.com/m4heshd/better-sqlite3-multiple-ciphers) (drop-in API). On first boot, derive the DB passphrase from the license key + a per-device salt so a copied `.db` file won't open on another machine.

5. **Code-sign + notarize**:
   - macOS: Apple Developer ID + `notarytool` — gives tamper-evident binaries and avoids Gatekeeper blocks.
   - Windows: EV/OV Authenticode certificate — prevents SmartScreen warnings.
   electron-builder runs both if you set `CSC_LINK` and related env vars.

6. **Harden the renderer** (already done, but worth auditing per release):
   `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, `setWindowOpenHandler` → `deny`. Disable DevTools in production via `electronFuses.RunAsNode: false`.

7. **Remove source maps** from production builds. They're a gift to reversers. In `electron.vite.config.ts` set `build.sourcemap: false` for production.

8. **Fingerprint anti-debug** checks in the main process — if `process.execArgv` contains `--inspect` or `--inspect-brk` in production, exit. Not foolproof, but filters 90% of casual attackers.

## Packaging recommendations

- **Format**: `.dmg` (macOS) and NSIS `.exe` (Windows). Avoid `.zip` — users don't know what to do with them.
- **Signed everywhere**: unsigned installers trigger OS warnings and dent trust. Both are worth the $100–$300/year cert.
- **Auto-updater channel**: separate `beta` and `stable` channels so pilots don't break the main customer base.
- **Single installer per OS**: with cross-arch (`x64` + `arm64`) in one .dmg via electron-builder.
- **Crash reporting**: wire up Sentry in the main process — for a retail app, silent crashes hurt sales.

## Feature roadmap (nice-to-haves)

Ranked by customer value per day of effort:
1. **CSV import for products** (half-day) — stores with existing catalogs on-board in minutes instead of hours.
2. **Promotions / happy-hour pricing** (2 days) — time-bound price overrides on a product or category.
3. **Loyalty points** (3 days) — points per ILS, redeemable at checkout.
4. **E-invoicing** (1 week) — Palestinian government is rolling out a mandatory e-invoice API. When specs drop, integrate.
5. **Mobile companion for stock-taking** (1 week) — React Native app that scans barcodes and writes to the main DB over LAN.
6. **X/Z report improvements** — hourly sales breakdown, returns summary, tax collected by rate.
7. **Multi-store consolidation dashboard** (2 weeks) — aggregate reports across N terminals with daily sync.

## Observability

- Add **structured logs** to a rotating file in `userData/logs/` (use `pino` or `winston`). Keep 14 days.
- Show a **"Copy diagnostics"** button on the Help page (already there) — include last 100 log lines so users can send them for support.
- Log every IPC action with its duration; anything over 200ms gets flagged.

## What to skip

- **Don't build your own licensing server** unless you're shipping 50+ units. Use Paddle / Gumroad / LemonSqueezy license keys.
- **Don't ship a custom-patched Electron**. Maintenance nightmare. Use upstream.
- **Don't obfuscate the renderer** — see above. Breaks debugging, kills performance.
- **Don't store secrets in the repo** even obfuscated. Keys go into the OS keychain via [`keytar`](https://github.com/atom/node-keytar) or generated at install time.
