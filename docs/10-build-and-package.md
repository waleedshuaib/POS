# 10 — Build & Package

## Development

```bash
npm install
npm run dev
```

`electron-vite` starts:
- Vite dev server for the renderer (HMR enabled).
- Watcher that rebuilds main + preload and relaunches Electron.

## Production build

```bash
npm run build   # bundles main, preload, renderer into out/
npm run package # runs build then electron-builder -> dist/
```

Targeted:
- `npm run package:mac` — `.dmg` for x64 + arm64.
- `npm run package:win` — NSIS installer `.exe`.

Configuration is in `package.json` under `build`. The `files` array includes `out/`, `drizzle/` (migrations), and `package.json`.

## Native modules

`better-sqlite3` and `argon2` have native code. On a clean install they compile automatically if build tools are present:
- macOS: Xcode Command Line Tools (`xcode-select --install`).
- Windows: `npm install --global windows-build-tools` (run once) or install Visual Studio Build Tools.
- Linux (dev-only): `build-essential`, `python3`.

If you hit a cached prebuild issue, clear `node_modules` and reinstall.

## Code signing

Not set up. electron-builder will produce unsigned installers. To sign later:
- macOS: set `CSC_LINK` and `CSC_KEY_PASSWORD` env vars or configure `mac.identity`.
- Windows: set `CSC_LINK` to a pfx file.

## Known gotchas

- Don't run `npm run package` while `npm run dev` has the app open — the binary is locked on Windows.
- `out/` is regenerated on every build. `dist/` holds final installers; delete it freely.
- On macOS arm64 hosts, building x64 requires Rosetta for the native modules to rebuild.
