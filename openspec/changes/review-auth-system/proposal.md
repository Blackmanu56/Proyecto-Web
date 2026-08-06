# Proposal: Auth System Security Review

## Intent

The hand-rolled JWT auth system in SGI Repuestos has 4 CRITICAL vulnerabilities (hardcoded secret fallback, unprotected actions, no session revocation, unused permission enforcement) that allow token forgery, unauthenticated access, and privilege escalation. This change hardens the auth layer without changing DB schema, roles, passwords, or Login UI design.

## Scope

### In Scope

- **CRITICAL (4 fixes):** Remove hardcoded JWT secret, enforce auth in all server actions, activate `requirePermission()` everywhere, add session revocation for inactive users
- **HIGH (5 fixes):** Password field type, CSRF protection, middleware matcher for API routes, logout auth check, remove localStorage PII
- **MEDIUM (7 fixes):** Centralize JWT secret, fix `startsWith` matching, add rate limiting, async bcrypt, clean dead permissions from JWT, add token refresh, standardize auth patterns

### Out of Scope

- Prisma schema changes (no new tables/columns)
- New roles or permission definitions
- Password changes or reset flow
- Login UI redesign
- Two-factor authentication
- Audit logging
- Any module outside `src/lib/`, `src/actions/`, `src/middleware.ts`, `src/app/login/`, `src/app/api/logout/`

## Capabilities

### New Capabilities

- `jwt-security`: Centralized JWT secret management, removal of hardcoded fallback, deduplication across modules, token payload cleanup
- `session-revocation`: DB-backed session invalidation for deactivated users, token refresh mechanism, middleware user-status check
- `auth-enforcement`: `requirePermission()` integration into all server actions, consistent authorization pattern, `usuarios.ts` auth guards
- `route-protection`: Middleware matcher covers API routes, `startsWith` replaced with exact/prefix matching, logout endpoint auth check
- `login-hardening`: `type="password"` field, CSRF tokens, rate limiting on login, async bcrypt, localStorage PII removal

### Modified Capabilities

None (no existing specs).

## Approach

Phase 1 — JWT secret centralization and hardcoded fallback removal. Phase 2 — Session revocation (middleware queries DB `activo` flag on each request, or lightweight blocklist via Redis/DB). Phase 3 — Auth enforcement (`requirePermission()` wired into every action, `usuarios.ts` guarded). Phase 4 — Route protection (middleware matcher widened, API auth checks). Phase 5 — Login hardening (password field, CSRF, rate limiting, bcrypt async).

Each phase is independently deployable and testable.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/jwt.ts` | Modified | Remove fallback, export single secret source |
| `src/lib/auth.server.ts` | Modified | Add user-status check, session revocation |
| `src/lib/auth-permissions.ts` | Modified | Wire `requirePermission()` into actions |
| `src/middleware.ts` | Modified | User-status DB check, matcher fix, startsWith fix |
| `src/actions/auth.ts` | Modified | Async bcrypt, rate limiting, CSRF |
| `src/actions/usuarios.ts` | Modified | Add `getSession()` + permission checks |
| `src/actions/ventas.ts` | Modified | Replace role check with `requirePermission()` |
| `src/actions/productos.ts` | Modified | Replace role check with `requirePermission()` |
| `src/actions/caja.ts` | Modified | Replace role check with `requirePermission()` |
| `src/actions/roles.ts` | Modified | Standardize to `requirePermission()` |
| `src/app/login/page.tsx` | Modified | Password field type, CSRF token, localStorage removal |
| `src/app/api/logout/route.ts` | Modified | Add auth check |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Middleware DB check on every request adds latency | High | Cache user status with short TTL (60s) per request |
| Breaking existing tokens during secret centralization | Medium | Deploy secret change + fallback simultaneously, rotate |
| Rate limiting blocks legitimate concurrent logins | Low | Use sliding window, generous threshold (10 attempts/min) |
| CSRF token adds complexity to login form | Low | Use Next.js built-in action signing or crypto.randomBytes |

## Rollback Plan

Each phase is independent. Revert the phase's file changes via `git checkout`. If secret rotation breaks tokens, restore the previous hardcoded fallback temporarily. Rate limiting is additive — removing it restores previous behavior.

## Dependencies

- `bcrypt` package (already installed, switch from `compareSync` to `compare`)
- No new packages required for core fixes

## Success Criteria

- [ ] No hardcoded secrets in codebase (`grep "mi_secreto" returns empty`)
- [ ] `requirePermission()` called in every server action that modifies data
- [ ] `usuarios.ts` actions all call `getSession()` before executing
- [ ] Deactivated user's JWT is rejected within 60 seconds
- [ ] Password field renders as `type="password"` in browser
- [ ] Middleware matcher covers `/api/logout` and other protected API routes
- [ ] `npm run build` passes without errors
- [ ] `npm run lint` passes without errors
