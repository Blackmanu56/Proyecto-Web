# JWT Security Specification

## Purpose

Centralize JWT secret management, eliminate hardcoded fallbacks, deduplicate secret definitions across modules, and remove dead weight from the token payload.

## Requirements

### Requirement: JWT Secret Source of Truth

The system SHALL expose a single function `getJWTSecret()` from `src/lib/jwt.ts` that returns `process.env.JWT_SECRET`. No other module MAY define or import a JWT secret independently.

#### Scenario: Env var present

- GIVEN `process.env.JWT_SECRET` is set to a non-empty string
- WHEN any module calls `getJWTSecret()`
- THEN the function returns the env var value

#### Scenario: Env var missing

- GIVEN `process.env.JWT_SECRET` is undefined or empty
- WHEN any module calls `getJWTSecret()`
- THEN the function throws an `Error` with message `"JWT_SECRET environment variable is required"`

#### Scenario: No hardcoded fallback exists

- GIVEN the codebase is searched for string literals matching `"mi_secreto"` or any hardcoded secret fallback pattern
- WHEN the search completes
- THEN zero matches are found

### Requirement: Single Secret Definition

The JWT secret SHALL be defined in exactly ONE file (`src/lib/jwt.ts`). `src/middleware.ts` SHALL import `getJWTSecret()` from `src/lib/jwt.ts` instead of defining its own constant.

#### Scenario: Middleware uses shared secret

- GIVEN `src/middleware.ts` imports the JWT secret
- WHEN the import is inspected
- THEN it imports `getJWTSecret` from `@/lib/jwt`
- AND no local `JWT_SECRET` constant exists in `src/middleware.ts`

### Requirement: Token Payload Cleanup

The JWT token payload SHALL NOT include the `permissions` array. Permissions are checked server-side against the DB, not embedded in the client-visible JWT.

#### Scenario: Token does not contain permissions

- GIVEN a user successfully logs in
- WHEN the JWT is created in `loginAction`
- THEN the token payload contains `userId`, `username`, `role`, `fotoUrl`, and `exp`
- AND the token payload does NOT contain a `permissions` field

### Requirement: Startup Failure on Missing Secret

The application SHALL fail fast at startup if `JWT_SECRET` is not configured, rather than silently using a fallback.

#### Scenario: Server starts without env var

- GIVEN the server process starts
- AND `JWT_SECRET` is not set in the environment
- WHEN any code path first calls `getJWTSecret()`
- THEN an error is thrown before any request is served

## Edge Cases

- Env var set to empty string `""` — treated as missing, MUST throw
- Env var set to a single character — accepted (no minimum length enforced by this spec, but should be ≥32 chars per OWASP)

## What MUST NOT Change

- JWT library (`jose`) — keep using HS256 signing
- Token expiry duration (24h) — unchanged in this spec
- Cookie name (`session`), httpOnly, secure, sameSite, path — unchanged
- `parseRoleData()` function — unchanged

## Integration Points

| Consumer | Current | Change |
|----------|---------|--------|
| `src/lib/jwt.ts:3` | `process.env.JWT_SECRET \|\| "mi_secreto..."` | `getJWTSecret()` without fallback |
| `src/middleware.ts:5` | Duplicate `JWT_SECRET` constant | Import from `@/lib/jwt` |
| `src/actions/auth.ts:68-74` | Includes `permissions` in payload | Remove `permissions` from payload |
