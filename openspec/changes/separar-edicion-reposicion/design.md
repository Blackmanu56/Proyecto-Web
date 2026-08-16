# Design: Separar edición de producto de la reposición

## Technical Approach

`updateProducto` (productos.ts:427-667) mezcla edición y reposición. La lógica financiera (472-653) se extrae a `ejecutarReposicion(tx, …)` en `src/lib/reposicion.ts` — MOVER, no reescribir — deduplicando con `createProducto` (307-408). `updateProducto` queda edit-only; `createProducto` conserva Compra inmediata (Decisión #1); la reposición pasa por `SolicitudReposicion` (PENDIENTE→APROBADA/RECHAZADA), ejecutándose al aprobar.

## Architecture Decisions

| # | Choice | Alternatives | Rationale |
|---|---|---|---|
| D1 | Modelo `SolicitudReposicion`, estado string | Compra draft / volátil | Patrón `Caja.estado`; auditoría; rechazo sin zombies |
| D2 | Helper único en lib | Copiar bloque | Mover ≠ reescribir; tests actuales validan |
| D3 | `Producto.cantidad` en el caller | Dentro del helper | Los callers difieren |
| D4 | `productoEditSchema` sin cantidad/pagos/origenPago | Campos opcionales | Rechazo temprano de basura |
| D5 | Snapshot + re-validación de fondos al aprobar | Ejecutar contra snapshot | Saldos cambian entre fases |
| D6 | `createProducto` con Compra inmediata | Stock por aprobación | Decisión #1; helper habilita ambas |
| D7 | Keys `productos.reponer` + `aprobar_reposicion` | Reusar `productos.editar` | Explícito; seed propaga |
| D8 | Snapshot pagos read-only en `/solicitudes` | PaymentDistribution interactivo | Sin modo review; listado fiel |

## Data Flow

```
Solicitar (productos.reponer): INSERT PENDIENTE + snapshots — cero writes financieros
Aprobar (productos.aprobar_reposicion) — tx:
  carga (PENDIENTE o error) → re-valida distribución+caja+banco
  → ejecutarReposicion (Compra, DetalleCompra, PagoCompra,
    MovimientoCaja+totalVentas--, MovimientoFinanciero)
  → Producto.cantidad += N → APROBADA + aprobadorId + compraId
Rechazar — tx: RECHAZADA + respuesta + resueltoEn (cero writes)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | Modify | Modelo SolicitudReposicion + relaciones |
| `prisma/migrations/<ts>_add_solicitud_reposicion/` | Create | `migrate dev` + generate |
| `src/lib/reposicion.ts` | Create | Helper + helpers movidos + constantes + error |
| `src/actions/reposiciones.ts` | Create | 4 acciones del flujo |
| `src/actions/productos.ts` | Modify | updateProducto edit-only; createProducto usa helper; `productoEditSchema` |
| `src/lib/permissions.ts` | Modify | 2 keys; `reponer` en ENCARGADO_STOCK |
| `prisma/seed.ts` | No change | Deriva de DEFAULT_ROLE_PERMISSIONS |
| `src/middleware.ts` | Modify | `/solicitudes` rol ADMINISTRADOR |
| `src/components/ui/SolicitarReposicionModal.tsx` | Create | Patrón RestarStockModal + PaymentDistribution |
| `src/components/tables/ProductosTable.tsx` | Modify | Edit slim (1532-1573); drawer action |
| `src/app/solicitudes/page.tsx` + `SolicitudesTable.tsx` | Create | Server gated + acciones |
| `src/components/layout/Navbar.tsx` | Modify | Item "Solicitudes" (ADMINISTRADOR) |

## Interfaces / Contracts

```prisma
model SolicitudReposicion {
  id            Int      @id @default(autoincrement())
  productoId    Int
  cantidad      Int
  costoUnitario Float
  total         Float
  proveedorId   Int
  estado        String   @default("PENDIENTE") // PENDIENTE|APROBADA|RECHAZADA
  origenPago    OrigenPagoCompra @default(EFECTIVO_CAJA)
  pagos         Json?
  motivo        String?
  respuesta     String?
  solicitanteId Int
  aprobadorId   Int?
  compraId      Int?    @unique
  createdAt     DateTime @default(now())
  resueltoEn    DateTime?
  producto      Producto   @relation(fields: [productoId], references: [id])
  proveedor     Proveedor  @relation(fields: [proveedorId], references: [id])
  solicitante   Usuario    @relation("solicitudesSolicitante", fields: [solicitanteId], references: [id])
  aprobador     Usuario?   @relation("solicitudesAprobador", fields: [aprobadorId], references: [id])
  compra        Compra?    @relation(fields: [compraId], references: [id])
  @@index([estado, createdAt])
  @@index([productoId])
  @@map("solicitudes_reposicion")
}
```

`ejecutarReposicion(tx, { productoId, nombreProducto, cantidad, costoUnitario, proveedorId, origenPago, pagos, usuarioId, descripcionPrefijo }) → { compraId, cajaMovimientoCreado, bancoMovimientoCreado }`. Valida distribución, caja abierta + `assertCajaSupportsCash`, saldo Banco. Crea Compra+DetalleCompra, `pagoCompra.createMany`, MovimientoCaja EGRESO + `totalVentas--`, MovimientoFinanciero EGRESO.

Acciones (`src/actions/reposiciones.ts`): `solicitarReposicion(productoId, { cantidad, proveedorId, origenPago, pagos, motivo })` — `productos.reponer`; producto activo; cantidad>0; snapshot; INSERT puro; `/solicitudes`. `aprobarReposicion(id, respuesta?)` — `productos.aprobar_reposicion`; tx: PENDIENTE o error; snapshot re-validado con zod; helper; increment; APROBADA; revalida rutas. `rechazarReposicion(id, respuesta)` — solo estado; `/solicitudes`. `getSolicitudesReposicion({ estado?, productoId?, desde?, hasta? })` — include relaciones; createdAt desc.

UI: modal — cantidad (>0), costoUnitario readonly, total = cantidad×precioCompra, proveedor (default), PaymentDistribution (vía `getCajaActiva`), motivo; toast. Drawer "Solicitar reposición" gateado por `canManageProducts` (721). Dialog edit: "Stock Actual" readonly; elimina 1532-1573 y `pagos` de `handleFormSubmit` (592-645). `/solicitudes`: tabs estado + aprobar/rechazar + snapshot read-only.

## Testing Strategy

| File | Qué |
|---|---|
| `ejecutar-reposicion.test.ts` (new) | Escenarios movidos: caja abierta/cerrada, banco, mixto, legacy, fondos |
| `solicitar-reposicion.test.ts` (new) | PENDIENTE + snapshots, cero writes, cantidad<=0, permiso |
| `aprobar-reposicion.test.ts` (new) | tx completa, re-validación, no-PENDIENTE |
| `rechazar-reposicion.test.ts` (new) | RECHAZADA + respuesta, cero writes |
| `getSolicitudesReposicion.test.ts` (new) | Filtros, includes, orden, permiso |
| `productos-update.test.ts` | Solo edit-only; se eliminan 199-298 |
| `productos-payment-distribution.test.ts` (281-447) + `reposicion-banco-integration.test.ts` (405-446) | Mover asserts al helper/aprobación |
| `productos-create.test.ts` (185-196) | Contrato: 1+1 PaymentDistribution (table+modal) |
| `auth-permissions.test.ts` | Matriz: ENCARGADO_STOCK CAN `reponer`, CANNOT `aprobar_reposicion` |

## Migration / Rollout

Sin migración de datos (tabla nueva). Slices: **A** helper con semántica idéntica (tests verdes — comportamiento intacto); **B** migración + permisos + middleware; **C** acciones con tests; **D** UI (dialog slim, modal, drawer, página, navbar); **E** re-anclaje de tests. Rollback: revert por slice; migración reversible. Budget 400 líneas alto → PRs encadenados (A+B / C / D+E).

## Open Questions

- [ ] ¿Filtros por proveedor/fecha en `/solicitudes`? Default: solo estado.
