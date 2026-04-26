# 15 — Multi-terminal Supermarket

## Today: single-terminal, fully self-contained

Each install of Mizan POS owns its own SQLite database. **Out-of-the-box, two terminals don't see each other's data.** This is by design — it makes the app fully offline and predictable, and a network outage cannot stop sales.

For a single-cashier shop, this is everything you need.

## When you have 3 cashiers in one supermarket

Three reasonable architectures depending on your appetite for complexity. Pick the simplest one that fits.

### Option A — One terminal, multiple users (✅ supported today)

Three cashiers share a **single PC** and log in/out by user. Each takes a turn, sales are attributed to whoever is logged in (`sale.userId`), and reports already break down by cashier (*Reports → Sales by Cashier*).

**Use this if** the cashiers don't need to ring concurrently — e.g., a small grocery where one register is enough.

Pros: zero config; works today; perfect inventory accuracy.
Cons: cashiers can't ring at the same time.

### Option B — Shared database on a network drive (works, with caveats)

Put the `pos.db` file on a SMB / NFS share that all 3 PCs can mount. Set `POS_DB_PATH` env var on each terminal to the network path. SQLite supports concurrent readers; concurrent writers are serialized via WAL locking.

```bash
# Each terminal:
POS_DB_PATH=/Volumes/shop-server/pos/pos.db npm run dev
```

**Use this if** you have a small LAN with one server PC always-on, and ≤3–4 active terminals.

Pros: real-time shared inventory + sales; cashiers see each other's invoices live.
Cons:
- WAL mode over network filesystems is fragile — file locks can be flaky on Windows SMB and NFS, occasionally causing "database is locked" errors.
- A network glitch = sales stop. Not truly offline anymore.
- DB corruption risk is higher (always backup to a separate location).

### Option C — Central server + per-terminal sync (recommended for >3 cashiers)

Each terminal keeps its own local SQLite (offline-resilient). A central server (a small Node service or Postgres DB) holds the authoritative copy. A background sync worker on each terminal:
- pushes new `sales`, `sale_items`, `sale_payments`, `inventory_movements` (append-only — easy merge)
- pulls product / price / supplier updates back

**Use this for** any real multi-station supermarket. It's offline-resilient (sales work even if the server is down — they sync when it comes back), and scales to dozens of terminals.

Pros: bulletproof offline, scalable, central reporting.
Cons: requires building the sync layer (~1–2 weeks of work), plus a small server.

This is the path on the roadmap (see [`14-future-enhancements.md`](./14-future-enhancements.md)).

## Inventory race conditions (any multi-terminal model)

Same product sold simultaneously on two terminals: under Option B (shared DB), SQLite serializes the writes, so qty drops correctly to (start − qty1 − qty2). Under Option C (sync), each terminal sees their own local state until sync — which can briefly look like "we sold 10 but inventory only had 8". The pattern below handles this.

## Stock-out behavior (designed-for-shop reality)

**Sales never block on out-of-stock.** When inventory is at 0 (or negative), checkout still succeeds — the inventory just goes negative, recording a deficit you can reconcile later.

This is intentional for retail in Palestine / West Bank: real shops sell fast and refill from a backroom or distributor truck that arrives later in the day. Blocking a real customer at the till because the digital count says "0" loses sales and trust.

When stock is replenished:
- *Inventory → Adjust* with a positive delta brings the count back into the black.
- Or record a *Purchase* from a supplier — that adds inventory and updates the supplier's balance.

The "Low stock" report and dashboard alert fire well before zero (configurable `low_stock_threshold` per product), so you have early warning to refill.

## Recommendation per shop size

| Shop size | Model | Cost / complexity |
|---|---|---|
| 1 cashier, occasional helper | A: single terminal, multi-user | Free |
| 2–3 cashiers, same building | B: shared DB on a small server PC | Low (one always-on PC) |
| 3+ cashiers OR multi-branch | C: per-terminal + sync | Medium (build / buy sync layer) |

Get started with Option A today; revisit when you genuinely outgrow it.
