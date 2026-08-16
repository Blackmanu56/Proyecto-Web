# Tasks: Separar edición de producto de la reposición

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~2000-2700 (mover, no reescribir) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (A+B) → PR2 (C) → PR3 (D+E) |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Slice A+B: helper + schema + permisos + middleware | PR 1 | Base feat/productos (tracker); suite verde; rollback por revert |
| 2 | Slice C: flip edit-only + 4 acciones + tests | PR 2 | Base = branch PR1; pesado (~900-1250) — sub-partir en apply si excede |
| 3 | Slice D+E: UI + re-anclaje + gate | PR 3 | Base = branch PR2; contrato UI; lint/build finales |

Formato: `- [ ] id [slice] acción — archivos. Dep: X. Test: cmd.`

## Phase 1 — Slice A: Helper `ejecutarReposicion`

- [ ] 1.1 [A] RED: crear `src/lib/__tests__/ejecutar-reposicion.test.ts` — escenarios movidos (caja abierta/cerrada, banco, mixto, legacy, fondos) contra el helper. Test: `npm run test -- ejecutar-reposicion`
- [ ] 1.2 [A] GREEN: crear `src/lib/reposicion.ts` — `ejecutarReposicion(tx, {productoId, nombreProducto, cantidad, costoUnitario, proveedorId, origenPago, pagos, usuarioId, descripcionPrefijo})`: mover bloque 472-653 de `updateProducto` + helpers/constantes + error de fondos; `Producto.cantidad` en el caller (D3). Dep: 1.1. Test: `npm run test`
- [ ] 1.3 [A] `src/actions/productos.ts`: `updateProducto` delega en el helper — semántica idéntica, suite existente verde. Dep: 1.2. Test: `npm run test`
- [ ] 1.4 [A] `src/actions/productos.ts`: `createProducto` (307-408) delega en el helper — dedupe; Compra inmediata (D6). Dep: 1.2. Test: `npm run test`

## Phase 2 — Slice B: Schema + permisos + middleware

- [ ] 2.1 [B] `prisma/schema.prisma`: modelo `SolicitudReposicion` (estado string, snapshots, `pagos Json?`, `compraId @unique`, índices `[estado, createdAt]`/`[productoId]`, relaciones Producto/Proveedor/Usuario/Compra) + `npx prisma migrate dev --name add_solicitud_reposicion` + `npx prisma generate`. Test: `npm run build`
- [ ] 2.2 [B] `src/lib/permissions.ts`: claves `productos.reponer` + `productos.aprobar_reposicion` (D7); ENCARGADO_STOCK solo `reponer`; seed propaga por upsert (sin cambios). Test: `auth-permissions.test.ts` matriz (RED→GREEN). Test: `npm run test -- auth-permissions`
- [ ] 2.3 [B] `src/middleware.ts`: ruta `/solicitudes` roles `["ADMINISTRADOR"]` + matcher. Test: `middleware.test.ts` — denegado ENCARGADO_STOCK. Test: `npm run test -- middleware`

## Phase 3 — Slice C: Flip edit-only + acciones

- [ ] 3.1 [C] `src/actions/productos.ts`: `productoEditSchema` sin cantidad/pagos/origenPago (D4); `updateProducto` edit-only — nunca escribe `cantidad` ni crea Compra/movimientos; `productos-update.test.ts` conserva edit-only (179-197, 300-332), elimina 199-291. Dep: 2.1. Test: `npm run test -- productos-update`
- [ ] 3.2 [C] Crear `src/actions/reposiciones.ts`: `solicitarReposicion` — `productos.reponer`, producto activo, cantidad>0, snapshots, INSERT PENDIENTE puro (cero writes financieros). Dep: 2.2, 3.1. Test: `solicitar-reposicion.test.ts` (nuevo)
- [ ] 3.3 [C] `src/actions/reposiciones.ts`: `aprobarReposicion` — tx: solo PENDIENTE → re-validación zod + fondos (D5) → helper → `cantidad += N` → APROBADA + aprobadorId + compraId + resueltoEn; rollback + error claro. Dep: 1.2, 2.2. Test: `aprobar-reposicion.test.ts` (nuevo)
- [ ] 3.4 [C] `src/actions/reposiciones.ts`: `rechazarReposicion` (RECHAZADA + respuesta, cero writes) + `getSolicitudesReposicion` (filtros, includes, createdAt desc). Dep: 2.2. Test: `rechazar-reposicion.test.ts` + `getSolicitudes-reposicion.test.ts` (nuevos)
- [ ] 3.5 [C] Remover asserts de updateProducto: `productos-payment-distribution.test.ts` (281-447) y `reposicion-banco-integration.test.ts` (405-446) — cubiertos por 1.1/3.3; suite verde. Dep: 3.3. Test: `npm run test`

## Phase 4 — Slice D: UI

- [ ] 4.1 [D] `src/lib/product-purchase-payments.ts`: modo `"reposicion"` (total = cantidad × precioCompra). Test: `payment-distribution-ui.test.ts`
- [ ] 4.2 [D] `src/components/tables/ProductosTable.tsx`: dialog slim — quitar 1532-1573 + pagos de `handleFormSubmit` (592-645); "Stock Actual" readonly; drawer action "Solicitar reposición" (canManageProducts). Dep: 4.1
- [ ] 4.3 [D] Crear `src/components/ui/SolicitarReposicionModal.tsx`: patrón RestarStockModal + `PaymentDistribution`; cantidad>0, costoUnitario readonly, proveedor default, motivo, toast → `solicitarReposicion`. Dep: 4.2, 3.2
- [ ] 4.4 [D] Crear `src/app/solicitudes/page.tsx` + `SolicitudesTable.tsx`: gated ADMINISTRADOR; tabs estado; aprobar/rechazar; snapshot read-only (D8); toast. Dep: 3.3, 3.4
- [ ] 4.5 [D] `src/components/layout/Navbar.tsx`: item "Solicitudes" (ADMINISTRADOR). Dep: 4.4

## Phase 5 — Slice E: Re-anclaje + gate

- [ ] 5.1 [E] `productos-create.test.ts` (185-196): contrato PaymentDistribution — 1 en dialog (create) + 1 en modal (solicitud). Dep: 4.2, 4.3. Test: `npm run test -- productos-create`
- [ ] 5.2 [E] Gate: `npm run test` + `npm run lint` + `npm run build` verdes. Dep: todos
