# Design: Auth System Security Review

## Technical Approach

Harden the hand-rolled JWT auth layer across 12 files in 5 phases (secret centralization → session revocation → auth enforcement → route protection → login hardening). Each phase is independently deployable. No DB schema changes. No new packages beyond existing `bcryptjs`.

## Architecture Decisions

### Decision: JWT Secret Management

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single `getJWTSecret()` in `jwt.ts`, remove middleware duplicate | Middleware can't import server modules → must inline same logic | Create `getJWTSecret()` in `jwt.ts`; duplicate in `middleware.ts` with identical fail-fast logic (no fallback) |
| Environment-only, crash on missing | Better security; harder to deploy if env misconfigured | **Chosen**: `if (!process.env.JWT_SECRET) throw new Error(...)` — fail fast |

### Decision: Session Revocation Strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Redis blocklist | Fast lookup; adds infra dependency | Rejected — no Redis in stack |
| DB `activo` check in middleware | 1 extra query per request; no new tables | **Chosen**: query `prisma.usuario.findUnique({ where: { id }, select: { activo } })` in middleware, cached 60s via `Map<userId, {activo, ts}>` |
| Token version column | Clean but requires schema change | Rejected per constraints |

### Decision: Middleware Cache

In-memory `Map<number, {activo: boolean, ts: number}>` with 60s TTL. Process-local is sufficient — multi-pod requires DB fallback but this is a single-process Next.js app.

### Decision: Permission Enforcement Pattern

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Replace role checks with `requirePermission()` | Consistent but changes error messages | **Chosen**: use `requirePermission()` in all actions; it already returns session |
| Add wrapper per action module | Cleaner but more boilerplate | Rejected — not worth it for ~6 action files |

### Decision: `startsWith` → Exact Path Match

Replace `pathname.startsWith(route.path)` with exact segment check: `pathname === route.path || pathname.startsWith(route.path + "/")`.

## Data Flow

### Before (current)
```
Request → middleware: verify JWT signature only → pass
       → action: check session.role (some actions) or nothing (usuarios)
```

### After
```
Request → middleware: verify JWT signature
        → lookup user.activo in cache (60s TTL)
        → if inactive: delete cookie, redirect /login
        → exact path match for role check
       → action: requirePermission("domain.action") → throws on fail
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/jwt.ts:3` | Modify | Replace `process.env.JWT_SECRET \|\| "mi_secreto..."` with `getJWTSecret()` that throws if missing. Export function. Keep `key` as lazy-initialized. |
| `src/lib/auth.server.ts` | Modify | Add `getUserActivo(userId)` with Map cache. Import from `prisma`. |
| `src/middleware.ts:5` | Modify | Duplicate `getJWTSecret()` logic (middleware can't import server modules). After `jwtVerify`, call `prisma.usuario.findUnique` with cache check. Add exact-path matcher. |
| `src/middleware.ts:78-87` | Modify | Change matcher to include API routes except `_next/*`, `favicon.ico`: `"/((?!_next/static|_next/image|favicon.ico).*)"` |
| `src/actions/auth.ts:61` | Modify | Replace `bcrypt.compareSync` with `bcrypt.compare` (async). |
| `src/actions/auth.ts:13` | Modify | Change password min from 4 to 8. |
| `src/actions/usuarios.ts` | Modify | Add `requirePermission("usuarios.ver")` to `getUsuarios` and `getRoles`. Add `requirePermission("usuarios.crear")` to `crearUsuario`. Add `requirePermission("usuarios.editar")` to `actualizarUsuario`. Add `requirePermission("usuarios.estado")` to `toggleEstadoUsuario`. |
| `src/actions/ventas.ts` | Modify | Replace inline `["ADMINISTRADOR", ...].includes(session.role)` with `requirePermission("ventas.crear")` (etc.) per action. |
| `src/actions/productos.ts` | Modify | Replace role checks with `requirePermission("productos.crear")` etc. |
| `src/actions/caja.ts` | Modify | Replace role checks with `requirePermission("caja.abrir")` etc. |
| `src/actions/roles.ts` | Modify | Replace role-based checks with `requirePermission("usuarios.roles")`. |
| `src/app/login/page.tsx:459` | Modify | Change `type="text"` to `type="password"`. Remove `password-mask` class; show/hide is controlled by `showPassword` state which toggles `type`. |
| `src/app/login/page.tsx:39-53` | Modify | Remove `localStorage` username storage (PII exposure). |
| `src/app/api/logout/route.ts` | Modify | Add `getSession()` check before deleting cookie. Return 401 if not authenticated. |

## New Code Patterns

### requirePermission() usage in actions
```ts
import { requirePermission } from "@/lib/auth-permissions";

export async function crearUsuario(formData: FormData) {
  const session = await requirePermission("usuarios.crear");
  // ... rest of logic
}
```

### Middleware user-status check (inline, not importable)
```ts
// After jwtVerify succeeds:
const userId = (payload as any).userId as number;
const cached = userStatusCache.get(userId);
const now = Date.now();
if (!cached || now - cached.ts > 60_000) {
  const user = await prisma.usuario.findUnique({ where: { id: userId }, select: { activo: true } });
  if (!user || !user.activo) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("session");
    return res;
  }
  userStatusCache.set(userId, { activo: user.activo, ts: now });
}
```

### Cookie creation (unchanged pattern)
```ts
cookieStore.set("session", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24,
});
```

### Cookie deletion (explicit)
```ts
cookieStore.delete("session"); // server-side
// middleware-side:
response.cookies.delete("session");
```

### Login form: password field fix
```tsx
<input
  type={showPassword ? "text" : "password"}
  // Remove: className="...password-mask..."
/>
```

## Error Handling Strategy

- `requirePermission()` throws `Error("No autenticado.")` or `Error("No tiene permisos...")`. Actions catch via try/catch at action boundary, returning `{ error: message }` to client.
- Middleware: invalid/inactive → redirect `/login` with cookie deletion.
- Login: specific messages for deactivated user vs wrong credentials (already implemented).
- Logout: 401 JSON response if not authenticated.

## Backward Compatibility

- Existing valid JWTs continue to work — same secret, same payload structure.
- New `getJWTSecret()` simply reads `process.env.JWT_SECRET` without fallback; ensure env var is set in deployment BEFORE deploying code change.
- No token format changes — `permissions` array stays in payload (dead weight but harmless).
- Middleware matcher widens — old routes still match; new `/api/logout` now gets middleware protection.
- Deploy secret-change and code-change simultaneously. If env var is missing at deploy time, app crashes (desired behavior).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `getJWTSecret()` throws on missing env | Mock `process.env`, assert throw |
| Unit | `requirePermission()` denies/allowes | Mock `getSession()`, assert throw/return |
| Unit | User-status cache TTL | Mock prisma, verify cache hit after 60s |
| Integration | Login → cookie set → middleware check | Playwright or Vitest + supertest |
| Integration | Deactivated user → middleware redirect | Seed DB with inactive user, verify redirect |

## Migration / Rollout

Phase 1 (secret) + Phase 2 (revocation) must deploy together since middleware changes. Phase 3 (permissions) is additive. Phase 4 (matcher) and Phase 5 (login) are independent. Set `JWT_SECRET` env var before deploying Phase 1+2.

## Open Questions

- [ ] None — all decisions resolved by constraints (no schema changes, no new packages).
