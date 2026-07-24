# Tasks: Auth System Security Review

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350 (production) + ~250 (tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | JWT secret centralization + session revocation | PR 1 | Foundation — must land first; includes tests |
| 2 | Auth enforcement + route protection + login hardening | PR 1 | Same PR — all independent of each other, depend only on Unit 1 |

Single PR is viable (~350 production + ~250 test lines). TDD: each task writes test first, then implements.

## Phase 1: JWT Secret Centralization (Foundation)

- [x] 1.1 RED: Create `src/__tests__/jwt.test.ts` — test `getJWTSecret()` returns env var, throws on missing/empty
- [x] 1.2 GREEN: Add `getJWTSecret()` to `src/lib/jwt.ts`, export it, replace `process.env.JWT_SECRET || "mi_secreto..."` with call
- [x] 1.3 RED: Test that `src/middleware.ts` imports `getJWTSecret` from `@/lib/jwt` (no local constant)
- [x] 1.4 GREEN: Update `src/middleware.ts:5` — remove local `JWT_SECRET`, import `getJWTSecret` from `@/lib/jwt`
- [x] 1.5 RED: Test login action token payload does NOT contain `permissions` field
- [x] 1.6 GREEN: Remove `permissions` from JWT payload in `src/actions/auth.ts:68-74`

## Phase 2: Session Revocation

- [x] 2.1 RED: Create `src/__tests__/auth.server.test.ts` — test `getUserActivo()` returns cached `activo` status, respects 60s TTL
- [x] 2.2 GREEN: Add `getUserActivo(userId)` with `Map<number, {activo, ts}>` cache to `src/lib/auth.server.ts`
- [x] 2.3 RED: Test middleware: active user proceeds, deactivated user gets cookie deleted + redirect, missing user gets redirect
- [x] 2.4 GREEN: Add DB user-status check after `jwtVerify` in `src/middleware.ts` — query `prisma.usuario.findUnique`, cache result, redirect inactive
- [x] 2.5 RED: Test token refresh: token within 30min of expiry gets new 24h expiry; token far from expiry unchanged
- [x] 2.6 GREEN: Add token refresh logic in `src/middleware.ts` after user-status check

## Phase 3: Auth Enforcement

- [ ] 3.1 RED: Test `src/actions/usuarios.ts` — each action throws/returns error without session, proceeds with valid session + permission
- [ ] 3.2 GREEN: Add `requirePermission()` + `getSession()` guards to all 5 actions in `src/actions/usuarios.ts`
- [ ] 3.3 RED: Test `src/actions/ventas.ts` — actions reject without permission, pass with correct permission
- [ ] 3.4 GREEN: Replace role array checks with `requirePermission()` in `src/actions/ventas.ts`
- [ ] 3.5 RED: Test `src/actions/productos.ts` — same pattern
- [ ] 3.6 GREEN: Replace role checks with `requirePermission()` in `src/actions/productos.ts`
- [ ] 3.7 RED: Test `src/actions/caja.ts` — same pattern
- [ ] 3.8 GREEN: Replace role checks with `requirePermission()` in `src/actions/caja.ts`
- [ ] 3.9 RED: Test `src/actions/roles.ts` — standardizes to `requirePermission()`
- [ ] 3.10 GREEN: Standardize `src/actions/roles.ts` to use `requirePermission()`

## Phase 4: Route Protection

- [ ] 4.1 RED: Test `src/middleware.ts` matcher — API routes NOT excluded, static assets still excluded
- [ ] 4.2 GREEN: Update matcher to `"/((?!_next/static|_next/image|favicon.ico).*)"`
- [ ] 4.3 RED: Test path matching — `/ventas` matches `/ventas/123` but NOT `/ventasreportes`
- [ ] 4.4 GREEN: Replace `pathname.startsWith(route.path)` with exact/prefix-segment check in `src/middleware.ts:43-45`
- [ ] 4.5 RED: Test `/api/logout` — authenticated call deletes cookie + 200; unauthenticated call still 200
- [ ] 4.6 GREEN: Add `getSession()` check to `src/app/api/logout/route.ts`

## Phase 5: Login Hardening

- [ ] 5.1 RED: Test `src/app/login/page.tsx` — password input has `type="password"` (not `type="text"`)
- [ ] 5.2 GREEN: Change `type="text"` to `type={showPassword ? "text" : "password"}`, remove `password-mask` class
- [ ] 5.3 RED: Test localStorage does not store/read `chopper_remembered_user`
- [ ] 5.4 GREEN: Remove localStorage read/write code in `src/app/login/page.tsx:39-53`
- [ ] 5.5 RED: Test `bcrypt.compare` (async) is used instead of `bcrypt.compareSync`
- [ ] 5.6 GREEN: Replace `bcrypt.compareSync` with `await bcrypt.compare` in `src/actions/auth.ts:61`
- [ ] 5.7 RED: Test rate limiting — 11th failed attempt within 1min returns rate-limit error
- [ ] 5.8 GREEN: Add sliding window rate limiter (Map<username, {attempts, windowStart}>) to `src/actions/auth.ts`
- [ ] 5.9 RED: Test CSRF token validation — missing/tampered token returns error
- [ ] 5.10 GREEN: Add CSRF token generation + validation to login flow (`src/actions/auth.ts` + `src/app/login/page.tsx`)

## Verification

After all tasks:
- `npx vitest run` — all tests pass
- `npm run lint` — no errors
- `npm run build` — builds successfully
- `grep -r "mi_secreto" src/` — zero matches
- Manual: login with deactivated user → redirected to `/login` within 60s
