# 05 — IPC & Security

## Single channel

The entire renderer → main surface flows through ONE channel:

```
ipcRenderer.invoke('pos:invoke', { action, input, token })
```

The router at `src/main/ipc/router.ts` resolves `action` (e.g. `sales.checkout`) to a `RouteDef`. A `RouteDef` has:

```ts
{
  input: z.ZodType,             // validated at the boundary
  roles?: Role[] | 'public',    // default: all authenticated
  handler: (input, ctx) => ...  // ctx.session is set if authenticated
}
```

All routes are registered side-effectfully from `src/main/ipc/handlers/*.ts`. A second channel `pos:routes` returns the list of registered actions (useful for dev).

## Response envelope

- `{ ok: true, data }` — success.
- `{ ok: false, code, message }` — failure. Codes: `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL`, or custom.

Renderer's `api()` throws on `ok:false` so call sites only deal with success.

## Auth

- `auth.login` returns `{ token, ... }`. Renderer stores `token` in `localStorage`.
- Every request carries `token`; router calls `getSession(token)` and attaches the session to `ctx`.
- `auth.logout` destroys the session; tokens left in renderer are dead on the main side.

## Security hardening

- BrowserWindow: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- `webContents.setWindowOpenHandler` redirects all new-window requests to the OS browser.
- CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file:;`
- Zod validation at the router catches any malformed input before hitting services.
- Roles enforced at the router; sensitive services (`checkout`, `returns`, `voidSale`) still read `ctx.session!.userId` defensively.

## Adding a new route

1. Add a Zod input schema.
2. Pick which roles may call it.
3. Implement the handler (call a service, never touch DB directly).
4. Register inside the handler file.
5. Call it from the renderer via `api('domain.action', input)`.
