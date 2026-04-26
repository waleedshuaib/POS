# 04 — Data Model

All tables defined in `src/main/db/schema.ts`. Initial DDL in `drizzle/0000_initial.sql`.

## Tables

- **users** — `username`, `password_hash`, `full_name`, `role` (`admin|manager|cashier`), `active`, `last_login_at`.
- **categories** — bilingual name + optional `parent_id`.
- **products** — `sku` (unique), `barcode` (unique, nullable), `name_ar`, `name_en`, `category_id`, `cost`, `price`, `tax_rate`, `unit`, `track_stock`, `low_stock_threshold`, `image_path`, `active`.
- **inventory** — `product_id` (unique), `qty_on_hand`.
- **inventory_movements** — every stock change, with `reason` and `ref_type`/`ref_id` back to the sale/return/purchase.
- **customers**, **suppliers** — contact + `balance` (positive = owes you).
- **purchases** / **purchase_items** — supplier invoices that raise stock.
- **sales** — `invoice_no` (unique, `INV-YYYY-NNNNN`), totals, `status` (`completed|held|voided|returned`), `held_name`.
- **sale_items** — snapshot of name, qty, unit price, line discount, tax rate/amount, line total.
- **sale_payments** — one row per payment split; `method` in `cash|card|bank_transfer|credit|check`.
- **returns** / **return_items** — partial or full returns against a sale.
- **cash_drawers** — open/close sessions per cashier, expected vs counted variance.
- **settings** — key/value store for store config, printer, language default, tax defaults.
- **audit_log** — every mutating action by manager/admin + all voids/returns.

## Invariants

- Inventory movements always accompany a stock change — never bump `inventory.qty_on_hand` without a movement row.
- Sale totals are computed server-side from `sale_items`; the renderer cannot forge them.
- Held sales have `status='held'` and no `sale_payments`; resuming deletes them (their items become the cart again).

## Relationships (cascade behavior)

- `sales` → `sale_items` and `sale_payments`: ON DELETE CASCADE.
- `purchases` → `purchase_items`: ON DELETE CASCADE.
- `returns` → `return_items`: ON DELETE CASCADE.
- `products` → `inventory`, `inventory_movements`: ON DELETE CASCADE (removing a product cleans up stock records).
