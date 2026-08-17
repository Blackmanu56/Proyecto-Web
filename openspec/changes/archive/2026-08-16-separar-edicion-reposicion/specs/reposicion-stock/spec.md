# Reposición de Stock Specification

## Purpose

Flujo solicitar/aprobar/rechazar para reponer stock: `ENCARGADO_STOCK` solicita, `ADMINISTRADOR` aprueba o rechaza, y SOLO la aprobación ejecuta stock + `Compra` + movimientos vía el helper compartido `ejecutarReposicion`. Prohibida una acción directa `reponerStock`.

## Requirements

### Requirement: Modelo SolicitudReposicion

The system MUST persist solicitudes (patrón estado string de `Caja`/`Venta`):

| Campo | Regla |
|---|---|
| `productoId`, `cantidad` | `cantidad > 0` |
| `costoUnitario`, `total`, `proveedorId` | snapshot al solicitar |
| `origenPago`, `pagos` (Json) | snapshot de la distribución |
| `estado` | `PENDIENTE` (default) \| `APROBADA` \| `RECHAZADA` |
| `motivo?`, `respuesta?`, `solicitanteId`, `aprobadorId?` | trazabilidad |
| `compraId?` | `@unique`, link a `Compra` al aprobar |
| `createdAt`, `resueltoEn?` | timestamps |

The system MUST relacionar `Producto`, `Proveedor`, `Usuario` (solicitante/aprobador) y `Compra`, e indexar por `estado`, `productoId` y `createdAt`.

#### Scenario: Snapshots persistidos

- GIVEN una solicitud de cantidad 2 con `precioCompra = 500`
- THEN persiste `costoUnitario = 500`, `total`, `proveedorId`, `origenPago`, `pagos` y `estado = PENDIENTE`

#### Scenario: compraId único

- GIVEN `compraId = 42` ya usado en una solicitud aprobada
- WHEN se intenta reutilizar en otra solicitud
- THEN la constraint `@unique` lo impide

### Requirement: solicitarReposicion

The system MUST require `productos.reponer` and create a `PENDIENTE` solicitud from `productoId`, `cantidad > 0`, `proveedorId`, `origenPago`, `pagos`, `motivo?`, snapshotting `precioCompra` → `costoUnitario` and computing `total`.

The system MUST NOT mutate `Producto.cantidad` nor create `Compra`/pagos/movimientos at solicitation time.

#### Scenario: Solicitud feliz

- GIVEN ENCARGADO_STOCK con permiso y producto activo
- WHEN solicita cantidad 2, `EFECTIVO_CAJA`, distribución válida
- THEN se crea `PENDIENTE` con snapshots
- AND stock y tablas financieras permanecen intactas

#### Scenario: Cantidad inválida

- GIVEN `cantidad = 0`
- WHEN se solicita
- THEN la acción falla sin crear registro

#### Scenario: Sin permiso

- GIVEN ENCARGADO_VENTAS (sin `productos.reponer`)
- WHEN solicita
- THEN `requirePermission` rechaza

### Requirement: aprobarReposicion

The system MUST require `productos.aprobar_reposicion`, accept only `PENDIENTE`, re-validate caja/banco funds and payment distribution AT APPROVAL TIME (saldos pueden diferir del snapshot), execute via `ejecutarReposicion(tx, …)`, increment `Producto.cantidad`, and set `estado = APROBADA` + `aprobadorId` + `compraId` + `resueltoEn`, todo en una transacción.

On fund-validation failure the system MUST roll back the whole transaction, leave the solicitud `PENDIENTE` and surface a clear funds error (el admin puede rechazar con respuesta).

#### Scenario: Aprobación feliz

- GIVEN solicitud PENDIENTE y fondos suficientes al aprobar
- WHEN ADMINISTRADOR aprueba
- THEN se crean `Compra`/`DetalleCompra`/`PagoCompra`/`MovimientoCaja`/`MovimientoFinanciero`
- AND stock incrementado, `APROBADA` con `compraId` linkeado

#### Scenario: Fondos insuficientes al aprobar

- GIVEN snapshot válido pero caja/banco sin fondos al aprobar
- WHEN se aprueba
- THEN rollback total, solicitud sigue `PENDIENTE`, error de fondos claro

#### Scenario: Solicitud ya resuelta

- GIVEN solicitud `APROBADA`
- WHEN se intenta aprobar de nuevo
- THEN la acción falla con error de estado

### Requirement: rechazarReposicion

The system MUST require `productos.aprobar_reposicion`, accept only `PENDIENTE`, set `estado = RECHAZADA` + `respuesta` + `resueltoEn`, with zero financial writes.

#### Scenario: Rechazo con respuesta

- GIVEN solicitud PENDIENTE
- WHEN ADMINISTRADOR rechaza con respuesta
- THEN queda `RECHAZADA` con `respuesta`/`resueltoEn`
- AND sin `Compra`/movimientos ni cambio de stock

#### Scenario: No pendiente

- GIVEN solicitud `APROBADA`
- WHEN se rechaza
- THEN la acción falla

### Requirement: getSolicitudesReposicion y página /solicitudes

The system MUST expose `getSolicitudesReposicion` requiring `productos.aprobar_reposicion`, listing solicitudes filtrables por `estado`, `PENDIENTE` primero y `createdAt` desc, incluyendo producto, proveedor, solicitante, aprobador y compra.

The `/solicitudes` page MUST be in-app, gated a ADMINISTRADOR, con lista + filtros + acciones aprobar/rechazar (revisión del snapshot con `PaymentDistribution`) y feedback `toast`.

#### Scenario: Admin filtra pendientes

- GIVEN ADMINISTRADOR con solicitudes mixtas
- WHEN filtra `PENDIENTE`
- THEN ve solo pendientes con snapshot revisable y acciones aprobar/rechazar

#### Scenario: Acceso denegado

- GIVEN ENCARGADO_STOCK sin `productos.aprobar_reposicion`
- WHEN visita `/solicitudes`
- THEN acceso denegado sin exponer datos

### Requirement: Permisos nuevos

The system MUST add `productos.reponer` ("Solicitar reposición") y `productos.aprobar_reposicion` ("Aprobar reposiciones") a `PERMISSIONS` y `DEFAULT_ROLE_PERMISSIONS`:

| Rol | `reponer` | `aprobar_reposicion` |
|---|---|---|
| ADMINISTRADOR | ✓ | ✓ |
| ENCARGADO_STOCK | ✓ | ✗ |
| ENCARGADO_VENTAS | ✗ | ✗ |

The seed (upsert por rol) MUST propagar las claves al re-correrlo.

#### Scenario: Matriz por defecto

- GIVEN seed re-corrido con roles por defecto
- THEN cada rol tiene exactamente las claves de la matriz

### Requirement: Helper ejecutarReposicion

The system MUST extract `ejecutarReposicion(tx, { productoId, nombreProducto, cantidad, costoUnitario, proveedorId, origenPago, pagos, usuarioId, descripcionPrefijo })` performing `Compra` + `DetalleCompra` + `PagoCompra` + `MovimientoCaja` + `MovimientoFinanciero` and validaciones de fondos/distribución, returning `{ compraId, … }`; el update de `Producto.cantidad` MUST quedar en el caller.

The system MUST use the helper from BOTH `aprobarReposicion` and el bloque de stock inicial de `createProducto` (mover, no reescribir). A direct `reponerStock` action MUST NOT exist.

#### Scenario: Paridad con flujo legacy

- GIVEN un caso de pago mixto cubierto por los tests existentes de `updateProducto`
- WHEN se ejecuta vía helper
- THEN produce los mismos `Compra`/pagos/movimientos que el flujo legacy

## Test Requirements

- Mover sin reescribir asserts: reposición de `productos-update.test.ts` (199-284), `productos-payment-distribution.test.ts` (281-447) y bonus de `reposicion-banco-integration.test.ts` (405-446) → helper/aprobación.
- Nuevos: `ejecutar-reposicion`, `solicitar-reposicion`, `aprobar-reposicion`, `rechazar-reposicion`, `getSolicitudes-reposicion` + contrato UI (drawer "Solicitar reposición", modal nuevo, ocurrencias de `PaymentDistribution`).

## Non-Goals

- Notificaciones push/websocket (solo in-app con toast).
- Widget de pendientes en dashboard (deferido).
- `reponerStock` como acción directa de stock.
- Stock inicial de `createProducto` por aprobación (sigue inmediato).
