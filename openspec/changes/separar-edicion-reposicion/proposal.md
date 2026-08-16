# Proposal: Separar edición de producto de la reposición (flujo solicitar/aprobar)

## Intent

`updateProducto` mezcla edición de catálogo con reposición de stock (crea Compra/PagoCompra/MovimientoCaja/MovimientoFinanciero). Separar: edición queda edit-only; reposición pasa a flujo solicitar/aprobar — ENCARGADO_STOCK solicita → ADMINISTRADOR aprueba/rechaza → **solo al aprobar** se ejecutan stock + Compra + movimientos. Restricción: NO crear `reponerStock` directo.

## Scope

### In
- `updateProducto` edit-only (sin `cantidad`, `pagos`, Compra/movimientos).
- Helper `ejecutarReposicion(tx, …)` extraído + dedupe con bloque de stock inicial de `createProducto`.
- Modelo `SolicitudReposicion` + acciones `solicitarReposicion` / `aprobarReposicion` / `rechazarReposicion` / `getSolicitudesReposicion`.
- Permisos nuevos `productos.reponer`, `productos.aprobar_reposicion` (PERMISSIONS + DEFAULT_ROLE_PERMISSIONS + seed).
- UI: modal `SolicitarReposicionModal`, drawer action "Solicitar reposición", Dialog de edición slim, página `/solicitudes` (admin) + item Navbar.
- Tests: mover cobertura existente al helper/aprobación + 5 nuevos.

### Out
- Push/notificaciones (solo in-app con toast).
- Widget de pendientes en dashboard (deferido).
- `reponerStock` como acción directa de stock (prohibido).

## Capabilities

### New
- `productos`: edición de catálogo edit-only + `createProducto` con stock inicial inmediato.
- `reposicion-stock`: flujo solicitar/aprobar/rechazar, helper de ejecución, página `/solicitudes`, permisos nuevos.

### Modified
- None (`openspec/specs/` vacío — no hay specs previas).

## Approach

- **`updateProducto`**: eliminar write de `cantidad` y parseo de `cantidad/pagos/origenPago`; conservar imagen + catálogo; nunca más crea Compra/movimientos.
- **`src/lib/reposicion.ts`**: `ejecutarReposicion(tx, { productoId, nombreProducto, cantidad, costoUnitario, proveedorId, origenPago, pagos, usuarioId, descripcionPrefijo })` → Compra + DetalleCompra + PagoCompra + MovimientoCaja + MovimientoFinanciero + validaciones (caja/banco/distribución); update de `Producto.cantidad` queda en el **caller**; retorna `{ compraId, … }`. Mover (no reescribir) bloque 472-653; dedupe con 307-408.
- **`SolicitudReposicion`**: `productoId, cantidad (>0), costoUnitario, total, proveedorId, estado (PENDIENTE|APROBADA|RECHAZADA), origenPago, pagos (Json snapshot), motivo, respuesta, solicitanteId, aprobadorId?, compraId? @unique, createdAt, resueltoEn` + relaciones.
- **Acciones** (`src/actions/reposiciones.ts`): `solicitar` = INSERT puro (nunca stock/Compra/caja/banco); `aprobar` = tx con re-validación de fondos (saldos cambian entre solicitud y aprobación) → helper → `Producto.cantidad += cantidad` → APROBADA + aprobadorId + compraId; `rechazar` = solo estado + respuesta.
- **`/solicitudes`**: server component gated ADMINISTRADOR, lista PENDIENTE/APROBADA/RECHAZADA + filtros + aprobar/rechazar (reusa `PaymentDistribution` para revisar snapshot).

## Alternatives

- A) `updateProducto` as-is + flag guard → rechazado: mantiene concerns mezclados y doble camino.
- B) Reusar `Compra` con estado (draft) → rechazado: `Compra` es contable; filas zombie al rechazar; sin `aprobadorId/respuesta`; igual requiere JSON de distribución.
- C) Solicitud volátil (session/localStorage) → rechazado: sin auditoría, se pierde.

## Decisions (requieren confirmación del usuario)

| # | Decisión | Default recomendado | Rationale |
|---|---|---|---|
| 1 | Stock inicial en `createProducto` | Mantener Compra inmediata (NO por aprobación) | Setup de catálogo ≠ reposición; no bloquear creación en review admin |
| 2 | Auto-aprobación del ADMINISTRADOR | NO — flujo uniforme de 2 pasos | Auditoría limpia y simple |
| 3 | Permisos | Claves nuevas, NO reusar `productos.editar` para aprobar | Explícito; seed re-corrido propaga |
| 4 | Página `/solicitudes` | Nueva, admin, in-app (sin push) | Alcance: lista + filtros + aprobar/rechazar |

## Affected Areas

| Area | Impact |
|------|--------|
| `src/actions/productos.ts` | Modified — edit-only; createProducto usa helper |
| `src/actions/reposiciones.ts` | New — acciones del flujo |
| `src/lib/reposicion.ts` | New — `ejecutarReposicion` |
| `prisma/schema.prisma` | Modified — SolicitudReposicion + migración |
| `src/lib/permissions.ts`, `prisma/seed.ts` | Modified — claves nuevas |
| `src/components/tables/ProductosTable.tsx` | Modified — dialog sin reposición; drawer action |
| `src/components/ui/SolicitarReposicionModal.tsx` | New — reusa `PaymentDistribution` |
| `src/app/solicitudes/page.tsx` | New — admin |
| `src/components/layout/Navbar.tsx` (+AppShell) | Modified — item /solicitudes |
| `src/lib/product-purchase-payments.ts` | Modified — modo `"reposicion"` |
| Tests (`src/lib/__tests__/`) | Modified 4 + New 5 |

## Impact

- **Tests**: 4 existentes re-encauchados al helper/aprobación; 5 nuevos (ejecutar-reposicion, solicitar, aprobar, rechazar, getSolicitudes + contrato UI). Strict TDD (vitest).
- **Migración**: 1 tabla nueva + `prisma generate`.
- **UI**: dialog de edición slim, modal nuevo, página nueva, navbar.

## Risks

| Riesgo | Prob | Mitigación |
|---|---|---|
| Regresión financiera al extraer helper | Med | Mover, no reescribir; tests actuales cubren |
| Snapshot vs fondos reales al aprobar | Med | Re-validar en aprobación; error claro + rechazo con respuesta |
| Deriva de permisos (ENCARGADO sin reponer) | Med | Claves en PERMISSIONS + DEFAULT + seed |
| Churn de tests por cambio de entry point | Med | Mover asserts, no re-escribirlos |
| Alcance de createProducto mal decidido | Low | Decisión 1 explícita; helper habilita ambas vías |

## Rollback

Revert del commit (cambio cohesivo por slices). Migración reversible: rollback de `migrate dev` elimina `SolicitudReposicion`; UI/permisos retroceden con el código. Sin feature flags.

## Success Criteria

- [ ] `updateProducto` no escribe `cantidad` ni crea Compra/movimientos
- [ ] `solicitarReposicion`: crea PENDIENTE con snapshots; cero writes financieros
- [ ] `aprobarReposicion`: tx completa, stock incrementado, `compraId` linkeado
- [ ] `rechazarReposicion`: cero writes financieros
- [ ] Permisos exigidos vía `requirePermission` en las 3 acciones
- [ ] vitest + lint + build verdes
