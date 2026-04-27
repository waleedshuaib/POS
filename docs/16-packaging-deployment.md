# 16 — Packaging & Deployment

End-to-end recipe for taking Mizan POS from source code to a running install on a customer's terminal in Palestine / West Bank.

## TL;DR

```bash
# Developer machine, once per release:
npm version patch                    # bump 1.0.0 → 1.0.1
npm run verify                       # 96 tests must pass
npm run package:mac                  # → dist/Mizan POS-1.0.1.dmg
npm run package:win                  # → dist/Mizan POS Setup 1.0.1.exe
# Hand the .dmg/.exe to the customer (USB stick, signed download, courier).
```

## Build outputs

`electron-builder` produces:

| Target | Output | Notes |
|---|---|---|
| macOS Universal | `dist/Mizan POS-X.Y.Z-arm64.dmg` + `-x64.dmg` | Intel + Apple Silicon binaries |
| Windows x64 | `dist/Mizan POS Setup X.Y.Z.exe` | NSIS installer with custom path option |

Configure once in `package.json` → `build` (already done). For Linux, add a `linux` block targeting `AppImage` or `deb`.

## Pre-release checklist

1. **Bump version**: `npm version patch|minor|major` — tags the commit and updates `package.json`.
2. **Run verify**: `npm run verify` → typecheck + 96 tests + smoke. Refuse to ship a red build.
3. **Smoke the actual binary**: build, install on a clean VM, boot, log in (`admin/admin`), ring up one sale, take a backup. Five minutes saves a callback.
4. **Update the release notes** — what changed since last version, in plain language for the shop owner.

## First-time install on a customer terminal

### macOS

1. Copy `Mizan POS-X.Y.Z-arm64.dmg` (or `-x64.dmg`) to the Mac.
2. Double-click → drag *Mizan POS* to Applications.
3. Right-click → **Open** the first time (Gatekeeper prompt; needed because we're not Apple-signed yet).
4. App launches → seeded admin user available (`admin / admin`).
5. **Customer must change the admin password** — *Users* page, edit admin, set a new password.
6. Open *Settings* → fill store name (Arabic + English), phone, address, tax ID, currency.
7. (Optional) Enable thermal printer, configure host/USB.
8. Take a manual backup to a USB stick to verify the backup flow works on this Mac.

### Windows

1. Copy `Mizan POS Setup X.Y.Z.exe` to the PC.
2. Double-click → SmartScreen warning (because no Authenticode cert yet) → **More info** → **Run anyway**.
3. Choose install path (default `C:\Program Files\Mizan POS\`).
4. Same post-install steps as macOS.

## Where the data lives on customer's machine

| Item | macOS | Windows |
|---|---|---|
| Database | `~/Library/Application Support/Mizan POS/pos.db` | `%APPDATA%\Mizan POS\pos.db` |
| Product images | `…/Mizan POS/images/` | `…\Mizan POS\images\` |
| Auto-backups | `…/Mizan POS/backups/` (`pos-new.zip`, `pos-old.zip`) | `…\Mizan POS\backups\` |
| Daily logs | `…/Mizan POS/logs/YYYY-MM-DD.log` | `…\Mizan POS\logs\YYYY-MM-DD.log` |

These survive uninstalls — the customer keeps their data even if they reinstall.

## Per-customer customization

Every install gets the **same** binary; the differences live in the database, settable from *Settings*:
- `store.name_ar` / `store.name_en` — appears in the sidebar header AND on every receipt.
- Logo image — drop a custom logo into the receipt template later (roadmap).
- Tax ID, default tax rate, currency — fully configurable.
- Receipt header / footer text.

For multiple customers from one codebase, you don't need separate builds — just hand each customer the installer and let them set their store name on first launch.

## Distribution channels (in order of growth)

1. **USB stick** — perfect for first 1–10 customers. Include a one-page setup guide.
2. **Google Drive / Dropbox link** — when remote installs become a thing. Send the .dmg/.exe + setup PDF.
3. **GitHub Releases** — tag your repo, attach binaries, share the link. Free CDN.
4. **Self-hosted page** — when you have ≥20 customers. Add an auto-updater (see below).
5. **Code-signed downloads** — required if you want to scale. Apple Developer ID + Windows Authenticode certs are ~$200/year each.

## Auto-updates (recommended once you have >5 installs)

Install `electron-updater`, host releases on GitHub or S3, wire `autoUpdater.checkForUpdatesAndNotify()` into `app.whenReady()`. Customers get a "restart to install" prompt — never need to manually re-download.

Without it: every patch = drive to each shop with a USB stick.

```bash
npm install electron-updater
```

Then in `src/main/index.ts`:
```ts
import { autoUpdater } from 'electron-updater';
autoUpdater.checkForUpdatesAndNotify();
```

And add `publish` config in `package.json` → `build` pointing at GitHub.

## Code signing (required for scale)

Without signing:
- macOS: customers see "App can't be opened because it is from an unidentified developer". Right-click→Open works but is alarming.
- Windows: SmartScreen blocks the installer until the customer clicks "Run anyway".

With signing:
- macOS: clean double-click install. Apple Notarization adds the malware scan check.
- Windows: clean install. EV certificate skips SmartScreen entirely.

Costs: Apple Developer ID $99/year, Windows OV Authenticode ~$80/year, EV ~$300/year.

To enable in electron-builder, set env vars before `npm run package`:
```bash
# macOS
export CSC_LINK=/path/to/dev-id.p12
export CSC_KEY_PASSWORD=...
export APPLE_ID=...        # for notarization
export APPLE_APP_SPECIFIC_PASSWORD=...

# Windows
export CSC_LINK=/path/to/authenticode.pfx
export CSC_KEY_PASSWORD=...
```

## Troubleshooting an install that won't open

| Symptom | Likely cause | Fix |
|---|---|---|
| "different Node.js version" error in console | native module ABI mismatch | Run `npm run rebuild:electron` (dev only — packaged installs already match) |
| App opens then closes immediately | Missing native module | Check `out/main/index.js` log; usually missing `better-sqlite3` build artifact in resources |
| Login fails with "invalid credentials" | DB didn't seed | Delete `userData/pos.db` and relaunch — first-boot seed runs again |
| Arabic receipt shows boxes | Amiri font missing | Drop `Amiri-Regular.ttf` into resources before packaging, or app falls back to system font |
| Thermal printer silent | Not enabled in settings | *Settings → Printer → Enable thermal*; PDF preview opens as fallback |
| Backup folder empty | First backup hasn't fired yet | App takes one on launch if last one was >24h ago, then once daily |

## Per-shop "branded" installer (advanced)

If you want each shop's installer to ship pre-configured with their store name:
1. Create `src/main/seed-customer.ts` for the per-shop overrides.
2. Pass the customer's settings as build-time env vars (e.g. `CUSTOMER_STORE_AR=...`).
3. Read them in seed and write into `settings` table on first boot.
4. Set the installer name via electron-builder `productName` per build.

For most shops, the default install + 5-minute *Settings* configuration is faster than custom builds.

## Uninstall

- macOS: drag *Mizan POS* from Applications to Trash. Data in `~/Library/Application Support/Mizan POS/` is **not** removed — preserved for reinstall.
- Windows: Settings → Apps → Mizan POS → Uninstall. Same — data preserved.

To wipe everything (dev only): `rm -rf ~/Library/Application\ Support/Mizan\ POS/` (macOS) / `rmdir /s "%APPDATA%\Mizan POS"` (Windows).

## Versioning policy

- **Patch (1.0.x)**: bug fixes, no migration. Auto-update silently.
- **Minor (1.x.0)**: new features, backwards-compatible. Auto-update with notes.
- **Major (x.0.0)**: schema changes that need migration. Push a manual notice + always test the migration path on a copy of customer data first.
