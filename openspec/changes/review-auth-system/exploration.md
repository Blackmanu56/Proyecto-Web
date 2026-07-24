## Exploration: review-auth-system — Authentication & Login Module Audit

### Current State

The SGI Repuestos project uses a custom JWT-based authentication system built on Next.js App Router with server actions. There is **no** NextAuth or similar library — everything is hand-rolled. The system covers login, session management via JWT cookies, route-level middleware protection, and role-based navigation. However, there are multiple significant security gaps and architectural concerns.

---

### Complete Auth Flow Map

```
Login Page (client)
  → Form submit → loginAction (server action)
    → Zod validation (username min 3, password min 4)
    → Prisma: findUnique by username
    → Check user.activo === false → reject
    → Check empleado.activo === false → reject
    → bcrypt.compareSync(password, user.passwordHash)
    → parseRoleData(user.rol.permisos) → extract permissions[]
    → createJWT({ userId, username, role, permissions, fotoUrl })
      → HS256, 24h expiry
    → cookieStore.set("session", token, { httpOnly, secure, sameSite: "lax", path: "/", maxAge: 24h })
    → return { success: true }

Middleware (every request except /api/*, /_next/*, favicon)
  → Read "session" cookie
  → If /login or /: redirect to /dashboard if valid token
  → If protected route: jwtVerify(token), check role in allowedRoles[]
  → Invalid token: delete cookie, redirect /login
  → Valid token + role mismatch: redirect /dashboard?error=unauthorized

Layout (every page render)
  → getSession() → verifyJWT from cookie
  → If session: fetch fresh user from DB (fotoUrl, etc.)
  → Pass user to AppShell → Navbar

Navbar (client)
  → Filter navItems by user.role
  → Logout: POST /api/logout → delete "session" cookie → push /login

Server Actions (all pages)
  → getSession() to verify auth on each action
  → Role-based checks: inline `["ADMINISTRADOR", ...].includes(session.role)`
  → NO consistent permission-level checks (see issues)
```

---

### Files Read & Contained

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/jwt.ts` | JWT create/verify with jose | 38 |
| `src/lib/auth.server.ts` | Session read from cookie, logout cookie delete | 22 |
| `src/lib/auth-permissions.ts` | requirePermission/hasPermission helpers (UNUSED) | 16 |
| `src/lib/permissions.ts` | Permission definitions, role defaults, parse/serialize | 165 |
| `src/middleware.ts` | Route-level auth + role protection | 88 |
| `src/actions/auth.ts` | loginAction server action | 92 |
| `src/app/login/page.tsx` | Login form component | 785 |
| `src/app/api/logout/route.ts` | Logout API route | 10 |
| `src/actions/usuarios.ts` | User CRUD (no auth guard) | 263 |
| `src/actions/roles.ts` | Role CRUD with auth + permission checks | 250 |
| `src/actions/ventas.ts` | Sale actions with auth | 231 |
| `src/components/layout/Navbar.tsx` | Nav bar with logout | 280 |
| `src/components/layout/AppShell.tsx` | Shell wrapper | 43 |
| `src/app/layout.tsx` | Root layout with session fetch | 56 |
| `src/app/page.tsx` | Root redirect logic | 12 |
| `src/app/dashboard/page.tsx` | Dashboard page | 36 |
| `prisma/schema.prisma` | DB schema (Usuario, Rol) | 265 |

---

### Security Issues

#### CRITICAL

1. **Hardcoded JWT secret fallback** (`src/lib/jwt.ts:3`, `src/middleware.ts:5`)
   ```ts
   const JWT_SECRET = process.env.JWT_SECRET || "mi_secreto_super_seguro_para_tesis_2026";
   ```
   If `JWT_SECRET` env var is missing, the app silently falls back to a hardcoded string committed to the repo. Any attacker can forge tokens. This is present in BOTH `jwt.ts` and `middleware.ts` — duplicate secret management is also a maintenance risk.

2. **Inactive users can stay logged in indefinitely** (`src/middleware.ts`, `src/lib/jwt.ts`)
   When a user is deactivated (`activo: false`) or their role permissions change, the existing JWT remains valid for up to 24 hours. There is **no server-side session revocation**, no token blacklist, and no DB check on each request. The middleware only checks token signature — not user status.

3. **No action-level permission enforcement** (`src/actions/ventas.ts`, `src/actions/productos.ts`, `src/actions/caja.ts`, `src/actions/clientes.ts`, `src/actions/auxiliares.ts`)
   The `requirePermission()` helper from `auth-permissions.ts` exists but is **never imported or used** in ANY server action. Actions only check `session.role` against a hardcoded array — never checking granular permissions like `ventas.crear`, `productos.editar`, etc. A user with the wrong fine-grained permissions can invoke any action on a route they have access to.

4. **Server actions have NO auth check at all** (`src/actions/usuarios.ts`)
   `getUsuarios()`, `getRoles()`, `crearUsuario()`, `actualizarUsuario()`, `toggleEstadoUsuario()` — NONE of these call `getSession()`. They are callable by any client-side code, even unauthenticated. Since the middleware excludes `/api/*` routes, and these are server actions (not API routes), they are technically callable if the middleware matcher doesn't cover them. The `usuarios.ts` actions are entirely unprotected.

#### HIGH

5. **Password field type is `type="text"` instead of `type="password"`** (`src/app/login/page.tsx:459`)
   The password input uses `type="text"` and relies on CSS class `password-mask` for masking. This means:
   - Browser autofill won't work correctly
   - Screen readers may not announce it as a password field
   - The actual value is visible in DOM inspections

6. **No CSRF protection** on login form or server actions
   The login form uses `useActionState` with a standard `<form action={formAction}>`. There's no CSRF token validation. The `sameSite: "lax"` cookie setting provides some protection for cross-origin POST requests, but server actions from same-origin pages can be triggered without CSRF tokens.

7. **Middleware matcher excludes ALL `/api/*` routes** (`src/middleware.ts:78-87`)
   ```ts
   matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
   ```
   This means the logout API route (`/api/logout`) and any future API routes have ZERO middleware protection. If an attacker crafts a POST to any API route, it bypasses all auth checks.

8. **Logout API has no auth check** (`src/app/api/logout/route.ts`)
   The POST handler deletes the "session" cookie without verifying the caller is authenticated. While logout is typically not harmful, this pattern means any script can clear a user's session.

9. **"Remember username" stores data in localStorage** (`src/app/login/page.tsx:39-53`)
   ```ts
   localStorage.getItem("chopper_remembered_user")
   localStorage.setItem("chopper_remembered_user", usernameRef.current.value)
   ```
   Username is stored in plain text in localStorage with key `chopper_remembered_user`. Any XSS vulnerability or browser extension can read this. The username is PII and should not be stored client-side without consideration.

#### MEDIUM

10. **Duplicate JWT secret definition** (`src/lib/jwt.ts:3` and `src/middleware.ts:5`)
    The JWT secret is defined identically in two files. If one is changed and the other isn't, tokens will break silently.

11. **Role check in middleware uses `startsWith`** (`src/middleware.ts:43-45`)
    ```ts
    const matchingRoute = protectedRoutes.find((route) =>
      pathname.startsWith(route.path)
    );
    ```
    A path like `/dashboard-admin` would match `/dashboard`, granting access. This is a minor issue but could become a problem if routes are added with similar prefixes.

12. **No rate limiting on login attempts** (`src/actions/auth.ts`)
    There is no brute-force protection. An attacker can attempt unlimited login combinations. The only protection is the 4-character minimum password requirement.

13. **`bcrypt.compareSync` blocks the event loop** (`src/actions/auth.ts:61`)
    Using the synchronous version of bcrypt during login. Under load, this blocks the Node.js event loop. Should use `bcrypt.compare` (async).

14. **JWT payload includes permissions array but permissions are never checked** (`src/lib/jwt.ts:10`, `src/actions/auth.ts:68-74`)
    The token carries a `permissions: string[]` field parsed from role data, but the only permission check is `session.role` string comparison. The permissions array is dead weight in the token.

15. **No token refresh mechanism**
    After 24 hours, the user is silently logged out. There's no refresh token, no silent renewal. The user loses their work if they're idle.

16. **Inconsistent role check across actions**
    - `ventas.ts`: `["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(session.role)`
    - `roles.ts`: `session.role === "ADMINISTRADOR" || roleData.permisos.includes("usuarios.roles")`
    - `usuarios.ts`: NO CHECK at all
    Different actions use different authorization patterns — some check role, some check permissions, some check nothing.

#### LOW

17. **Password minimum length is 4 characters** (`src/actions/auth.ts:13`, `src/app/login/page.tsx:75`)
    Very weak minimum. Should be at least 8.

18. **"Olvidaste tu contraseña?" shows a static message** (`src/app/login/page.tsx:625`)
    "Contactá con un administrador presencialmente" — no email-based recovery, no self-service reset.

19. **No session expiry indication to the user**
    When the JWT expires, the user is simply redirected to login with no warning message. Work in progress may be lost.

20. **`empleado.activo` check is optional/redundant** (`src/actions/auth.ts:56-58`)
    The check `if (user.empleado && !user.empleado.activo)` is a secondary deactivation path. This creates confusion — which flag is the source of truth for user activation?

---

### Missing Features / Protections

| Feature | Status |
|---------|--------|
| Rate limiting on login | MISSING |
| Account lockout after N failed attempts | MISSING |
| Password complexity requirements (uppercase, numbers, symbols) | MISSING |
| Session invalidation on password change | MISSING |
| Server-side session revocation (blacklist/blocklist) | MISSING |
| CSRF token protection | MISSING |
| Action-level permission enforcement | EXISTS but UNUSED |
| Audit log for auth events (login, logout, failed attempts) | MISSING |
| HTTPS enforcement | Only `secure: true` in production env |
| HttpOnly on logout cookie delete | N/A (cookie.delete handles it) |
| Refresh token / silent renewal | MISSING |
| User deactivation session kill | MISSING |
| Password expiry policy | MISSING |
| Two-factor authentication | MISSING |

---

### Recommendations

**Immediate (CRITICAL fixes):**
1. Remove hardcoded JWT secret fallback — require env var, fail startup if missing
2. Add a unique secret per environment, never commit it
3. Add user status check to middleware (query DB on each request OR use a session blocklist)
4. Enforce auth checks in ALL server actions — use `requirePermission()` consistently
5. Add the middleware matcher to cover API routes that need protection

**Short-term (HIGH fixes):**
6. Change password field to `type="password"`
7. Add CSRF protection to login form and sensitive actions
8. Add rate limiting to login endpoint
9. Use `bcrypt.compare` (async) instead of sync version
10. Centralize JWT secret in a single module

**Medium-term:**
11. Implement password complexity requirements (min 8 chars, mixed case, numbers)
12. Add login attempt tracking and temporary lockout
13. Implement token refresh mechanism
14. Add audit logging for auth events
15. Standardize authorization pattern across all actions

**Long-term:**
16. Consider moving to a session-based approach or adding a session store for revocation
17. Add two-factor authentication option
18. Implement password expiry and recovery flow

---

### Affected Areas

- `src/lib/jwt.ts` — JWT secret, token creation, verification
- `src/lib/auth.server.ts` — Session retrieval, logout
- `src/lib/auth-permissions.ts` — UNUSED permission helpers (should be integrated)
- `src/lib/permissions.ts` — Permission definitions (not enforced)
- `src/middleware.ts` — Route protection, role checks
- `src/actions/auth.ts` — Login action
- `src/actions/usuarios.ts` — User CRUD (NO auth)
- `src/actions/ventas.ts` — Sale actions (role check only)
- `src/actions/productos.ts` — Product actions (role check only)
- `src/actions/caja.ts` — Cash register actions (role check only)
- `src/actions/roles.ts` — Role CRUD (has permission check)
- `src/app/login/page.tsx` — Login form (password field type, remember username)
- `src/app/api/logout/route.ts` — Logout (no auth check)
- `src/app/layout.tsx` — Root layout (session fetch)

### Ready for Proposal

Yes. The exploration is complete. There are 4 CRITICAL, 5 HIGH, 7 MEDIUM, and 4 LOW issues identified. The system has a working auth foundation but lacks defense-in-depth: the permission system exists architecturally but is not enforced, the JWT secret is compromised by hardcoded fallback, and inactive users retain access. The proposal should prioritize the CRITICAL fixes first, then address the permission enforcement gap.
