# 13 — Contributing

## Folder tour

```
src/
├── main/          # Electron main process (Node)
│   ├── index.ts     # app lifecycle, window creation, IPC registration
│   ├── db/          # schema, client, migration runner
│   ├── repos/       # pure DB access (one per aggregate)
│   ├── services/    # business logic (transactions, invariants)
│   ├── auth/        # argon2, sessions
│   ├── printing/    # ESC/POS, PDF
│   ├── ipc/
│   │   ├── router.ts        # route dispatch + validation + roles
│   │   └── handlers/*.ts    # thin glue: Zod schema + role check + service call
│   └── seed.ts      # default admin + settings on first boot
├── preload/
│   └── index.ts     # contextBridge, exposes window.pos
├── renderer/
│   ├── main.tsx · App.tsx
│   ├── components/  # shared UI (AppShell, Modal, PageHeader)
│   ├── features/
│   │   └── <feature>/
│   │       ├── <Feature>Page.tsx
│   │       ├── (optional) <featureName>Store.ts   # Zustand
│   │       └── (optional) sub-components
│   ├── lib/         # api.ts, format.ts
│   ├── i18n/        # react-i18next + locales
│   └── styles/index.css
└── shared/          # types + zod schemas used by both sides
tests/
├── unit/            # pure functions
├── integration/     # services + real SQLite
└── e2e/             # Playwright
drizzle/             # migration SQL (hand-written; committed)
docs/                # you are here
```

## Adding a feature end-to-end

Example: "record a discount promotion".

1. **Schema**: add a `promotions` table to `src/main/db/schema.ts` + a migration file `drizzle/000N_promotions.sql`.
2. **Repo**: `src/main/repos/promotionRepo.ts` with `list / findById / insert / update / remove`.
3. **Service** (if non-trivial): `src/main/services/promotions.ts` — apply promo to a cart, for example.
4. **IPC handler**: `src/main/ipc/handlers/promotions.ts` — register routes `promotions.list`, `promotions.create`, etc. Don't forget to `require` it in `router.ts::loadHandlers`.
5. **Renderer**: `src/renderer/features/promotions/PromotionsPage.tsx` — `useQuery` + `useMutation` against the new routes. Add a route in `App.tsx` and a nav item in `AppShell.tsx`.
6. **i18n**: add keys in both `locales/ar/common.json` and `locales/en/common.json`.
7. **Help**: add a Help article pair (`articles/ar/promotions.md` + `articles/en/promotions.md`), register in `articles.ts`, add a `helpSlug` prop to `<PageHeader>`.
8. **Tests**: unit test the service logic, integration test the full IPC flow with a real DB.

## Conventions

- No business logic in handlers. Handlers validate input, delegate, return data.
- Never touch `drizzle`'s DB outside of a repo.
- All mutating services accept `userId` and log to `audit_log` for consequential actions.
- Use `rawDb().transaction(() => { ... })` to atomically compose repo calls.
- Keep Zod schemas close to the route they validate.

## Lint + format

`npm run lint` · `npm run format` · `npm run typecheck`. All three should pass before a PR.
