# 02 — Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | Electron 30 | Most mature story for thermal printers, barcode scanners, and cross-OS installers. |
| Build / dev server | electron-vite + Vite | Hot reload in main + preload + renderer; TS/React out of the box. |
| Installers | electron-builder | One command produces `.dmg` and `.exe`. |
| UI | React 18 + TypeScript + Tailwind CSS | Known, fast, easy RTL via logical properties. |
| Icons | lucide-react | Tree-shakable, consistent. |
| State (UI) | Zustand | 2 KB, zero boilerplate. |
| Data cache | TanStack Query v5 | Query/mutation lifecycle + invalidation for IPC calls. |
| Routing | react-router v6 | Standard. |
| DB | SQLite via better-sqlite3 | Synchronous, fast, embedded, prepared statements. |
| ORM | Drizzle ORM | TS-first schema, no runtime engine binary (unlike Prisma). |
| Migrations | Hand-rolled file runner (`src/main/db/migrate.ts`) | Zero dependency on drizzle-kit at runtime; the app just reads `drizzle/*.sql`. |
| Auth | argon2 | Memory-hard, GPU-resistant. |
| i18n | react-i18next + i18next-icu | Arabic plurals via ICU; RTL swap via `dir`. |
| Charts | Recharts | Declarative, React-native. |
| Markdown | react-markdown + remark-gfm | Help article renderer. |
| Fuzzy search | Fuse.js | Client-side Help search. |
| Thermal print | node-thermal-printer | ESC/POS over USB/network; reliable versions; handles Arabic via code pages or image mode. |
| PDF fallback | pdf-lib + @pdf-lib/fontkit | Embed Amiri for Arabic receipts. |
| Backup | archiver + extract-zip | Zip DB + images folder. |
| Unit tests | Vitest + @testing-library/react | Fast, ESM-native. |
| E2E | Playwright (Electron) | Drives packaged app. |
| Lint / format | ESLint + Prettier | Standard. |

## Why Electron, not Tauri or a local web server?
Thermal printer ecosystem + mature packaging + barcode/scanner stability + easy .dmg / .exe installers. Binary size (~100 MB) is irrelevant for dedicated POS terminals.

## Why Drizzle, not Prisma?
Prisma ships a native engine binary that is painful to bundle with Electron. Drizzle is pure TS and compiles away.
