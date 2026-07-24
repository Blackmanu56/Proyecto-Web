# Route Protection Specification

## Purpose

Fix the middleware matcher to cover API routes that require protection, replace `startsWith` matching with exact/prefix-aware logic, and add auth checks to the logout endpoint.

## Requirements

### Requirement: Middleware Matcher Covers Protected API Routes

The middleware matcher SHALL include API routes that require authentication. Specifically, `/api/logout` and any future `/api/*` routes that operate on protected data SHALL be covered by middleware auth checks.

#### Scenario: Matcher includes api/logout

- GIVEN the middleware matcher configuration
- WHEN the matcher regex is inspected
- THEN `/api/logout` is NOT excluded (the `(?!api|...)` negative lookahead is removed or narrowed)

#### Scenario: Static assets remain excluded

- GIVEN the matcher configuration
- WHEN static paths like `/_next/static`, `/_next/image`, `favicon.ico` are tested
- THEN they remain excluded from middleware processing

### Requirement: No Blanket API Exclusion

The middleware SHALL NOT exclude all `/api/*` routes. Only routes that are truly public (e.g., health checks, webhooks) MAY be excluded. The matcher SHALL use a whitelist approach for exclusions rather than a blacklist that excludes all APIs.

#### Scenario: New API route is automatically protected

- GIVEN a new API route is created at `/api/reports`
- WHEN the matcher is evaluated for a request to `/api/reports`
- THEN the middleware runs auth checks on that request

#### Scenario: Public API route is explicitly excluded

- GIVEN a route `/api/health` is configured as public
- WHEN the matcher is evaluated for `/api/health`
- THEN the middleware does NOT run auth checks

### Requirement: Exact Route Matching

The middleware SHALL use exact path matching or path-segment-aware prefix matching for role-based route protection. A path like `/dashboard-admin` SHALL NOT match a rule defined for `/dashboard`.

#### Scenario: Prefix collision avoidance

- GIVEN protected routes include `{ path: "/dashboard", roles: [...] }`
- WHEN a user navigates to `/dashboard-admin`
- THEN the `/dashboard` route rule does NOT apply
- AND the request is either rejected (if no other rule matches) or processed per the catch-all rule

#### Scenario: Exact path match

- GIVEN protected routes include `{ path: "/usuarios", roles: ["ADMINISTRADOR"] }`
- WHEN a user navigates to `/usuarios`
- THEN the `/usuarios` role rule applies

#### Scenario: Sub-path matching still works

- GIVEN protected routes include `{ path: "/ventas", roles: [...] }`
- WHEN a user navigates to `/ventas/nueva`
- THEN the `/ventas` role rule applies (sub-path matching is intentional)

### Requirement: Logout Endpoint Auth Check

The `/api/logout` POST handler SHALL verify that the caller has a valid session before deleting the cookie. This prevents session fixation attacks where an attacker forces logout.

#### Scenario: Authenticated user logs out

- GIVEN a user with a valid `session` cookie
- WHEN POST `/api/logout` is called
- THEN the cookie is deleted
- AND HTTP 200 is returned

#### Scenario: Unauthenticated request to logout

- GIVEN no session cookie is present
- WHEN POST `/api/logout` is called
- THEN the handler still deletes the cookie (idempotent)
- AND HTTP 200 is returned (logout is safe to call without auth — prevents information leakage)

### Requirement: startsWith Replacement

The `pathname.startsWith(route.path)` pattern SHALL be replaced with a check that matches either the exact path or the path followed by `/`.

#### Scenario: Matching sub-path

- GIVEN route `/ventas` is protected
- WHEN pathname is `/ventas/123`
- THEN the route matches

#### Scenario: Non-matching similar prefix

- GIVEN route `/ventas` is protected
- WHEN pathname is `/ventasreportes`
- THEN the route does NOT match

## Edge Cases

- Trailing slashes — `/dashboard/` should match `/dashboard`
- Query parameters — `/usuarios?page=2` should match `/usuarios`
- Case sensitivity — paths are lowercase in this app, no case normalization needed

## What MUST NOT Change

- Public routes (`/login`, `/`) — remain accessible without auth
- Middleware response format for redirects — keep existing redirect to `/login` or `/dashboard?error=unauthorized`
- Cookie deletion behavior in logout — keep existing behavior

## Integration Points

| Consumer | Current | Change |
|----------|---------|--------|
| `src/middleware.ts:78-87` | `matcher: ["/((?!api\|_next..."]` | Remove `api` from negative lookahead |
| `src/middleware.ts:43-45` | `pathname.startsWith(route.path)` | Exact or path-segment prefix match |
| `src/app/api/logout/route.ts` | No auth check | Add `getSession()` call |
