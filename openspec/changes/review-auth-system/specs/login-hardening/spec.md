# Login Hardening Specification

## Purpose

Fix the password field rendering, add CSRF protection to the login form, implement rate limiting on login attempts, switch to async bcrypt, and remove PII from localStorage.

## Requirements

### Requirement: Password Field Type

The password input in `src/app/login/page.tsx` SHALL use `type="password"` natively. The CSS `password-mask` class SHALL be removed.

#### Scenario: Password field renders masked

- GIVEN the login page loads in a browser
- WHEN the password input is inspected
- THEN `type="password"` is set on the input element
- AND the browser's native password masking applies

#### Scenario: Password field accessible

- GIVEN the login page loads
- WHEN a screen reader encounters the password field
- THEN it announces the field as a password input (not a text input)

### Requirement: CSRF Protection

The login form SHALL include a CSRF token. The CSRF token SHALL be generated server-side and embedded in the form. The server action SHALL validate the token before processing the login.

#### Scenario: Valid CSRF token submitted

- GIVEN the login form includes a valid CSRF token
- WHEN the form is submitted
- THEN the server action validates the token
- AND the login proceeds normally

#### Scenario: Missing CSRF token

- GIVEN a request to the login action without a CSRF token
- WHEN the server action processes the request
- THEN the action returns `{ error: "Token CSRF inválido" }`
- AND no authentication logic executes

#### Scenario: Tampered CSRF token

- GIVEN a request with a modified CSRF token
- WHEN the server action validates the token
- THEN the validation fails
- AND the action returns `{ error: "Token CSRF inválido" }`

### Requirement: Rate Limiting on Login

The login endpoint SHALL enforce rate limiting: maximum 10 failed login attempts per username within a 1-minute sliding window. After exceeding the limit, the action SHALL return a rate-limit error.

#### Scenario: Under rate limit

- GIVEN a username with 3 failed attempts in the last minute
- WHEN a login attempt is made
- THEN the attempt is processed normally

#### Scenario: Over rate limit

- GIVEN a username with 10 failed attempts in the last minute
- WHEN another login attempt is made
- THEN the action returns `{ error: "Demasiados intentos. Intentá de nuevo en un minuto." }`
- AND no DB query or bcrypt comparison executes

#### Scenario: Rate limit resets after window

- GIVEN a username that hit the rate limit 2 minutes ago
- WHEN a login attempt is made
- THEN the attempt is processed normally

### Requirement: Async bcrypt

The login action SHALL use `bcrypt.compare()` (async) instead of `bcrypt.compareSync()`. This prevents blocking the Node.js event loop during password verification.

#### Scenario: Login with correct password (async)

- GIVEN a user submits valid credentials
- WHEN `bcrypt.compare()` is called
- THEN the comparison completes asynchronously
- AND the login succeeds

#### Scenario: Login under load

- GIVEN 50 concurrent login requests
- WHEN `bcrypt.compare()` is called for each
- THEN no single request blocks the event loop
- AND all requests complete without timeout

### Requirement: No localStorage PII

The "remember username" feature SHALL NOT store the username in `localStorage`. The feature is either removed or replaced with a non-PII alternative (e.g., a boolean flag that the username field is pre-filled from a server-side cookie).

#### Scenario: No username in localStorage

- GIVEN the login page loads
- WHEN `localStorage.getItem("chopper_remembered_user")` is called
- THEN it returns `null` (key does not exist)

#### Scenario: Login page has no PII leakage

- GIVEN any XSS vulnerability or browser extension
- WHEN localStorage is inspected
- THEN no username, email, or other PII is stored

## Edge Cases

- CSRF token expiry — tokens should be single-use or have short TTL (15 min)
- Rate limiting by IP vs. by username — spec uses username (prevents credential stuffing across IPs)
- `bcrypt.compare` rejection — treat as login failure, don't expose error details
- localStorage already has old data — the code that reads it is removed, old data is harmless but can be cleared on login

## What MUST NOT Change

- Login form layout, styling, or UX flow — no UI redesign
- Zod validation schema (username min 3, password min 4) — unchanged
- Password hashing algorithm (bcrypt) — unchanged, only sync→async
- Cookie settings for session — unchanged
- Prisma schema — no changes

## Integration Points

| Consumer | Current | Change |
|----------|---------|--------|
| `src/app/login/page.tsx:459` | `type="text"` on password | `type="password"` |
| `src/app/login/page.tsx:39-53` | localStorage read/write | Remove all localStorage PII code |
| `src/actions/auth.ts:61` | `bcrypt.compareSync()` | `bcrypt.compare()` (async) |
| `src/actions/auth.ts` | No rate limiting | Add sliding window rate limit |
| `src/app/login/page.tsx` | No CSRF token | Embed CSRF token in form |
| `src/actions/auth.ts` | No CSRF validation | Validate CSRF token before login logic |
