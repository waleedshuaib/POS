# Backup & Restore

## Backup
From *Settings* → **Backup**, click **Export backup**. The app asks where to save a zip file containing:
- The full database.
- The product images folder.

Save this file periodically to an external medium (USB stick, personal cloud…).

## Restore
Click **Restore backup** and pick a previous zip. It replaces the current data; restart the app afterward.

⚠️ **Warning**: Restore overwrites current data. Take a backup first!

## On-disk location
- **macOS**: `~/Library/Application Support/pos/pos.db`
- **Windows**: `%APPDATA%\pos\pos.db`

You can copy these files manually too.
