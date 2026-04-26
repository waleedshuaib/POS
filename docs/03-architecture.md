# 03 — Architecture

Three Electron processes with strict boundaries.

```
┌──────────────────────────────────────────────────────────┐
│  Renderer (sandboxed, no Node)                          │
│  React · TanStack Query · Zustand · i18n                 │
│  Calls window.pos.invoke({ action, input, token })       │
└─────────────┬────────────────────────────────────────────┘
              │ contextBridge
              ▼
┌──────────────────────────────────────────────────────────┐
│  Preload (bridge only)                                   │
│  Exposes `window.pos` with invoke() and listRoutes()     │
└─────────────┬────────────────────────────────────────────┘
              │ ipcRenderer.invoke('pos:invoke', envelope)
              ▼
┌──────────────────────────────────────────────────────────┐
│  Main (Node)                                             │
│  IPC router → Handler → Service → Repository → SQLite    │
│  + argon2, sessions, printing, file I/O                  │
└──────────────────────────────────────────────────────────┘
```

## Main-process layering

- **`src/main/repos/*`** — Pure DB access through Drizzle. One file per aggregate. No business rules.
- **`src/main/services/*`** — Business logic. Composes repos. Owns transactions (`rawDb().transaction(...)`).
- **`src/main/ipc/handlers/*`** — Each file registers routes via `registerRoutes({ 'domain.action': defineRoute({...}) })`. Zod-validates input. Declares required roles. Delegates to service.
- **`src/main/ipc/router.ts`** — Dispatches `pos:invoke` envelopes, checks session, enforces role, validates input, returns `{ok, data}` or `{ok:false, code, message}`.

## Renderer pattern

```ts
const products = useQuery({
  queryKey: ['products'],
  queryFn: () => api<Product[]>('products.list', {}),
});

const save = useMutation({
  mutationFn: (p) => api('products.update', p),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
});
```

`api(action, input)` lives at `src/renderer/lib/api.ts` — typed wrapper over `window.pos.invoke`.

## Security posture

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- CSP in `src/renderer/index.html` blocks remote scripts.
- Every IPC input passes Zod validation.
- Roles enforced at the router; services re-check for defense-in-depth.
- Session tokens live in renderer `localStorage`; the main process keeps the map of `token → userId` in memory (no disk persistence).
