# 08 — Auth & Roles

## Hashing

`src/main/auth/password.ts` uses **argon2id** with:
- memoryCost: 2^16 (64 MB)
- timeCost: 3
- parallelism: 1

These are safe defaults for server-style verification on modern laptops (~100 ms per verify).

## Sessions

In-memory map at `src/main/auth/session.ts`:
- `createSession(user)` returns a 48-char hex token + 8-hour TTL.
- `getSession(token)` returns the session if alive.
- `touchSession(token)` on every request resets the TTL.
- On app restart, all tokens die — users re-login.

No session is persisted to disk. This is intentional; for a local single-machine POS, a persistent session buys no real UX but widens attack surface.

## Role matrix

| Action | admin | manager | cashier |
|---|:-:|:-:|:-:|
| Sales (checkout, hold, resume) | ✅ | ✅ | ✅ |
| Products create/update | ✅ | ✅ | ❌ |
| Products remove | ✅ | ❌ | ❌ |
| Inventory adjust | ✅ | ✅ | ❌ |
| Customers create | ✅ | ✅ | ✅ |
| Customers update | ✅ | ✅ | ❌ |
| Suppliers CRUD | ✅ | ✅ | ❌ |
| Purchases | ✅ | ✅ | ❌ |
| Returns | ✅ | ✅ | ✅ |
| Void sale | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ (low-stock only) |
| Users CRUD | ✅ | ❌ | ❌ |
| Settings | ✅ | ✅ | ❌ |
| Backup export | ✅ | ✅ | ❌ |
| Backup restore | ✅ | ❌ | ❌ |

Enforced by `roles: [...]` on each route in `src/main/ipc/handlers/*.ts`.

## Seeded users

On first boot (`src/main/seed.ts::ensureSeeded`):
- `admin` / `admin` — role admin.
- `cashier` / `cashier` — role cashier.

**Change the admin password from the Users page immediately.**
