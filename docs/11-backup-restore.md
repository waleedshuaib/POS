# 11 — Backup & Restore

## What's in a backup

A zip file containing:
- `pos.db` — the full SQLite database (all tables, indexes, WAL checkpoint'd).
- `images/*` — all uploaded product images.

That's it. No settings are stored anywhere else. A fresh install with this zip restored is byte-identical to the original.

## Locations

The app stores its live DB and images in Electron's `userData`:
- macOS: `~/Library/Application Support/pos/`
- Windows: `%APPDATA%\pos\`

## Export flow

`src/main/ipc/handlers/backup.ts::backup.export`:
1. Prompt for a save path via `dialog.showSaveDialog`.
2. Create a zip stream with `archiver`.
3. Add `pos.db` as `pos.db`, and each file in `images/` as `images/<name>`.
4. Finalize.

It is safe to take a backup while the app is running — SQLite's WAL mode keeps the DB in a consistent state.

## Restore flow

`backup.restore`:
1. Prompt for a zip file.
2. Extract to a temp dir with `extract-zip`.
3. `closeDatabase()`.
4. Copy `pos.db` over the live one.
5. Copy extracted images over the live images dir.
6. `initDatabase()` runs pending migrations (so an older backup is upgraded on restore).
7. Suggest the user restart the app.

## Safety

- Only admins can restore (`roles: ['admin']`).
- The user is prompted via native file dialogs — no hidden destructive paths.
- The restored DB goes through the migration pipeline, so schema drift is caught.

## Regular backups

Recommendation: export daily to a USB stick or personal cloud. The UI surfaces a "Last backup" indicator on the Help → Diagnostics panel — make it a habit.
