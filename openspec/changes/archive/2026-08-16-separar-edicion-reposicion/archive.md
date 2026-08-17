# Archive: Separar edición de producto de la reposición

**Change**: separar-edicion-reposicion
**Archived**: 2026-08-16
**Branch**: feat/productos
**Status**: PASS (516/516 tests, 0 type errors, 0 lint errors)

## Executive Summary

Separated product catalog editing from stock replenishment. `updateProducto` is now edit-only (no financial writes). Stock replenishment flows through a new `SolicitudReposicion` model: ENCARGADO_STOCK requests → ADMINISTRADOR approves/rejects → only approval executes stock + financial transactions via a shared `ejecutarReposicion` helper extracted from the original monolithic action. 17/17 tasks complete, 20/20 spec scenarios compliant.

## Decisions Made

| # | Decision | Rationale |
|---|---|---|
| D1 | `SolicitudReposicion` model with string estado | Pattern from `Caja`/`Venta`; full audit trail; no zombie records on rejection |
| D2 | Helper `ejecutarReposicion` extracted (move, not rewrite) | Existing tests validate financial logic; shared by `createProducto` and `aprobarReposicion` |
| D3 | `Producto.cantidad` update stays in caller | Callers differ (create vs approval); helper stays pure |
| D4 | `productoEditSchema` without cantidad/pagos/origenPago | Reject garbage at schema level |
| D5 | Snapshot + re-validation at approval time | Fund balances change between request and approval |
| D6 | `createProducto` keeps immediate Compra (not through solicitud) | Catalog setup ≠ replenishment; Decisión #1 |
| D7 | New permission keys `productos.reponer` + `aprobar_reposicion` | Explicit; seed propagates on re-run |
| D8 | Read-only snapshot in `/solicitudes` page | Admin reviews exact request; no interactive PaymentDistribution |

## Files Changed

### New Files
| Path | Description |
|------|-------------|
| `src/lib/reposicion.ts` | `ejecutarReposicion` helper + constants + error |
| `src/actions/reposiciones.ts` | 4 actions: solicitar, aprobar, rechazar, getSolicitudes |
| `src/components/ui/SolicitarReposicionModal.tsx` | Request modal (pattern: RestarStockModal + PaymentDistribution) |
| `src/app/solicitudes/page.tsx` | Admin page (gated ADMINISTRADOR) |
| `src/components/tables/SolicitudesTable.tsx` | Table with tabs, actions, read-only snapshot |
| `src/lib/__tests__/ejecutar-reposicion.test.ts` | Helper tests (moved scenarios) |
| `src/lib/__tests__/solicitar-reposicion.test.ts` | Request action tests |
| `src/lib/__tests__/aprobar-reposicion.test.ts` | Approval action tests |
| `src/lib/__tests__/rechazar-reposicion.test.ts` | Rejection action tests |
| `src/lib/__tests__/getSolicitudes-reposicion.test.ts` | Query + UI contract tests |
| `prisma/migrations/20260816234616_add_solicitud_reposicion/` | Schema migration |

### Modified Files
| Path | Description |
|------|-------------|
| `src/actions/productos.ts` | `updateProducto` edit-only; `createProducto` delegates to helper |
| `prisma/schema.prisma` | `SolicitudReposicion` model + relations |
| `src/lib/permissions.ts` | 2 new keys; ENCARGADO_STOCK gets `reponer` |
| `src/middleware.ts` | `/solicitudes` route gated to ADMINISTRADOR |
| `src/components/tables/ProductosTable.tsx` | Edit dialog slim; drawer action "Solicitar reposición" |
| `src/components/layout/Navbar.tsx` | "Solicitudes" item for ADMINISTRADOR |
| `src/lib/product-purchase-payments.ts` | `"reposicion"` mode |

### Test Files Modified
| Path | Change |
|------|--------|
| `productos-update.test.ts` | Kept edit-only; removed reposicion tests (199-291) |
| `productos-payment-distribution.test.ts` | Removed updateProducto asserts (281-447) → covered by helper/approval |
| `reposicion-banco-integration.test.ts` | Removed bonus updateProducto asserts (405-446) |
| `auth-permissions.test.ts` | Added matrix for new permission keys |
| `middleware.test.ts` | Added `/solicitudes` denegado for ENCARGADO_STOCK |

## Commits (chronological)

| Hash | Message |
|------|---------|
| a70780e | refactor(productos): extrae reposicion de stock a helper reutilizable |
| bc79ffa | feat(solicitudes): agrega modelo SolicitudReposicion, permisos y ruta |
| 251d3b7 | feat(productos): updateProducto es edit-only — sin reposición (3.1+3.5) |
| 4b73b2b | feat(reposiciones): acciones solicitar/aprobar/rechazar + getSolicitudes (3.2-3.4) |
| 798a1a4 | feat(payments): add reposicion mode to getProductPurchaseCost (4.1) |
| 9b852e9 | feat(ui): slim edit dialog + drawer 'Solicitar reposición' (4.2) |
| 9b161a5 | feat(ui): SolicitarReposicionModal + re-anchor PaymentDistribution (4.3+5.1) |
| a71e00a | feat(solicitudes): agregar página /solicitudes y enlace en navbar |

## Test Coverage

| Metric | Value |
|--------|-------|
| Total tests | 516 passed |
| Test files | 44 passed |
| Failures | 0 |
| Skipped | 0 |
| New test files | 7 |
| Spec scenarios | 20/20 compliant |

## Migration State

- **Schema**: `SolicitudReposicion` model applied via `20260816234616_add_solicitud_reposicion`
- **Migration**: 45 lines, correct FKs and indexes (`@@index([estado, createdAt])`, `@@index([productoId])`)
- **Data migration**: None required (new table only)
- **Prisma generate**: Run after migration

## Open Items

| # | Item | Severity |
|---|------|----------|
| 1 | 5 lint warnings (unused imports in SolicitudesTable, SolicitarReposicionModal, 2 test files) | Low — cosmetic |
| 2 | No apply-progress artifact (TDD cycle evidence table missing from apply phase) | Low — functional verification passed |
| 3 | Integration tests for full solicitar→aprobar flow (currently unit-tested with mocks only) | Low — future enhancement |
| 4 | Dashboard widget for pending requests (deferred per proposal) | None — explicitly deferred |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `productos` | Created | 2 requirements, 6 scenarios — `updateProducto` edit-only, `createProducto` with initial stock |
| `reposicion-stock` | Created | 6 requirements, 12 scenarios — model, solicitar, aprobar, rechazar, getSolicitudes, permissions, helper |

## Source of Truth Updated

The following main specs now reflect the new behavior:
- `openspec/specs/productos/spec.md`
- `openspec/specs/reposicion-stock/spec.md`

## Archive Contents

- `exploration.md` ✅
- `proposal.md` ✅
- `design.md` ✅
- `specs/productos/spec.md` ✅
- `specs/reposicion-stock/spec.md` ✅
- `tasks.md` ✅ (17/17 tasks complete)
- `verify-report.md` ✅

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
