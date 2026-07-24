# Auth Enforcement Specification

## Purpose

Wire `requirePermission()` into every server action, ensure all actions call `getSession()` before executing, and establish a consistent authorization pattern across the codebase.

## Requirements

### Requirement: Every Server Action Must Call getSession()

Every server action that performs data operations SHALL call `getSession()` as its first statement. If `getSession()` returns null, the action SHALL throw an error or return an unauthorized response.

#### Scenario: Authenticated user invokes action

- GIVEN a valid session exists in the cookie
- WHEN a server action is invoked
- THEN `getSession()` returns a valid session object
- AND the action proceeds with its logic

#### Scenario: Unauthenticated request invokes action

- GIVEN no session cookie is present
- WHEN a server action is invoked
- THEN `getSession()` returns null
- AND the action returns `{ error: "No autorizado" }` without executing data operations

### Requirement: requirePermission() Integration

Every server action that modifies or reads data SHALL call `requirePermission(resource, action)` from `@/lib/auth-permissions` before executing its business logic. The action SHALL NOT proceed if the permission check fails.

#### Scenario: User with required permission

- GIVEN a user with permission `ventas.crear`
- WHEN the user invokes `crearVenta()`
- THEN `requirePermission("ventas", "crear")` passes
- AND the action proceeds

#### Scenario: User without required permission

- GIVEN a user with role `ENCARGADO_VENTAS` but no `productos.editar` permission
- WHEN the user invokes `editarProducto()`
- THEN `requirePermission("productos", "editar")` throws `NoTienePermiso`
- AND the action returns `{ error: "No tienes permiso para realizar esta acción" }`

#### Scenario: Admin user bypasses permission check

- GIVEN a user with role `ADMINISTRADOR`
- WHEN any action calls `requirePermission(resource, action)`
- THEN the check passes (admin has all permissions per `permissions.ts`)

### Requirement: usuarios.ts Must Be Guarded

All actions in `src/actions/usuarios.ts` (`getUsuarios`, `getRoles`, `crearUsuario`, `actualizarUsuario`, `toggleEstadoUsuario`) SHALL call `getSession()` as their first statement. Additionally, write operations (`crearUsuario`, `actualizarUsuario`, `toggleEstadoUsuario`) SHALL require the `usuarios.crear` / `usuarios.editar` permission.

#### Scenario: Admin manages users

- GIVEN an ADMINISTRADOR user with valid session
- WHEN `getUsuarios()` is called
- THEN the session is verified
- AND the action returns the user list

#### Scenario: Non-admin attempts user management

- GIVEN a user with role `ENCARGADO_VENTAS`
- WHEN `crearUsuario()` is called
- THEN the action returns `{ error: "No tienes permiso para realizar esta acción" }`

#### Scenario: Unauthenticated call to usuarios action

- GIVEN no session exists
- WHEN `getUsuarios()` is called
- THEN the action returns `{ error: "No autorizado" }`

### Requirement: Standardized Auth Pattern

All server actions SHALL follow this exact pattern:

```typescript
export async function actionName(payload) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  requirePermission("resource", "action");
  // ... business logic
}
```

#### Scenario: Inconsistent pattern detection

- GIVEN the codebase is searched for server actions in `src/actions/`
- WHEN any action function is inspected
- THEN it contains `getSession()` as one of its first statements
- AND it contains a `requirePermission()` call (except read-only queries that only check session)

## Edge Cases

- `getSession()` throws (corrupt cookie) — treat as null, return unauthorized
- `requirePermission()` throws — catch and return structured error, don't propagate
- Actions that are purely read-only (e.g., `getProductos`) — MUST still call `getSession()`, MAY skip `requirePermission()` if all roles can read

## What MUST NOT Change

- Existing role definitions in `src/lib/permissions.ts` — no new roles
- `requirePermission()` and `hasPermission()` function signatures — keep as-is
- `parseRoleData()` — unchanged
- Prisma schema — no changes

## Integration Points

| File | Current State | Required Change |
|------|--------------|-----------------|
| `src/actions/usuarios.ts` | NO auth checks | Add `getSession()` + `requirePermission()` to all actions |
| `src/actions/ventas.ts` | Role array check only | Replace with `requirePermission("ventas", action)` |
| `src/actions/productos.ts` | Role array check only | Replace with `requirePermission("productos", action)` |
| `src/actions/caja.ts` | Role array check only | Replace with `requirePermission("caja", action)` |
| `src/actions/roles.ts` | Has permission check | Standardize to use `requirePermission()` |
| `src/lib/auth-permissions.ts` | EXISTS, UNUSED | Becomes the single authorization mechanism |
