# Session Revocation Specification

## Purpose

Reject tokens belonging to deactivated users, add token refresh capability, and establish a mechanism for server-side session invalidation without a new DB table.

## Requirements

### Requirement: Active User Check on Every Request

The middleware SHALL verify that the user identified by the JWT `userId` has `activo: true` on both the `Usuario` and associated `Empleado` records. This check happens on every request via the middleware.

#### Scenario: Active user accesses protected route

- GIVEN a user with `activo: true` on both Usuario and Empleado
- WHEN the middleware processes a request with a valid JWT
- THEN the request proceeds normally

#### Scenario: Deactivated user attempts access

- GIVEN a user with `activo: false` on Usuario
- WHEN the middleware processes a request with a valid JWT
- THEN the middleware deletes the `session` cookie
- AND the response redirects to `/login`

#### Scenario: Deactivated employee attempts access

- GIVEN a user with `activo: true` on Usuario but `activo: false` on Empleado
- WHEN the middleware processes a request with a valid JWT
- THEN the middleware deletes the `session` cookie
- AND the response redirects to `/login`

#### Scenario: User not found in DB

- GIVEN a JWT with a valid signature containing `userId: 999`
- WHEN the middleware queries the DB and finds no matching user
- THEN the middleware deletes the `session` cookie
- AND the response redirects to `/login`

### Requirement: User Status Caching

The middleware SHALL cache the user active status lookup for the duration of a single request to avoid redundant DB queries within the same request lifecycle. The cache TTL SHALL NOT exceed 60 seconds.

#### Scenario: Multiple actions in same request use cached status

- GIVEN a user's active status was checked during middleware processing
- WHEN `getSession()` is called within the same request from a server action
- THEN the cached status is used without an additional DB query

### Requirement: Token Refresh Mechanism

The system SHALL support silent token renewal. When a valid token is within 30 minutes of expiry, the middleware SHALL issue a new token with the same payload and a fresh 24h expiry.

#### Scenario: Token near expiry gets refreshed

- GIVEN a valid JWT with 20 minutes remaining before expiry
- WHEN the middleware processes a request
- THEN a new JWT with 24h expiry is set in the `session` cookie
- AND the request proceeds normally

#### Scenario: Token not near expiry

- GIVEN a valid JWT with 12 hours remaining before expiry
- WHEN the middleware processes a request
- THEN no new token is issued
- AND the request proceeds normally

#### Scenario: Expired token

- GIVEN an expired JWT
- WHEN the middleware processes a request
- THEN the middleware deletes the `session` cookie
- AND the response redirects to `/login`

### Requirement: Logout Revocation

The logout endpoint SHALL clear the session cookie. Because the system uses stateless JWTs, a logged-out user's old token remains valid until expiry UNLESS the middleware active-user check rejects it first.

#### Scenario: Logout clears session

- GIVEN an authenticated user
- WHEN the user POSTs to `/api/logout`
- THEN the `session` cookie is deleted
- AND the response returns HTTP 200

## Edge Cases

- DB unavailable during middleware check — fail closed (redirect to `/login`)
- Stale cache after user deactivation — max 60s window of continued access
- Race condition: user deactivated mid-request after middleware check — handled by server-action-level checks (see auth-enforcement spec)

## What MUST NOT Change

- No new database tables or columns (no token blocklist table)
- JWT expiry remains 24h (refresh extends from within that window)
- Cookie name (`session`), httpOnly, secure, sameSite settings — unchanged
- Prisma schema — no changes

## Integration Points

| Consumer | Current | Change |
|----------|---------|--------|
| `src/middleware.ts` | JWT signature check only | Add DB user-status check + refresh |
| `src/lib/auth.server.ts` | Simple cookie read | Use cached user status |
| `src/app/api/logout/route.ts` | No auth check | Verify caller is authenticated |
