# Exploration: Separar edición de producto de la reposición (flujo solicitar/aprobar)

> Repo verificado: `C:\Users\manu_\.gemini\antigravity\scratch\sgi-repuestos`
> Branch `feat/productos`, HEAD `2236633`, `src/actions/productos.ts` = 942 líneas.
> (Exploration previa en `C:\Users\manu_\Videos\sgi-repuestos` INVALIDADA.)

## Current State

`updateProducto` (`src/actions/productos.ts`, líneas 427-667) mezcla dos operaciones:

- **Edición de catálogo** (debe quedarse): parseo de `nombre, marca, codigo, imagen, categoriaId, proveedorId, precioCompra, precioVenta, stockMinimo` (431-444), subida/borrado de imagen (446-455), validación `productoSchema` (457-460), `findUnique` + "Producto no encontrado" (464-470), `tx.producto.update` de campos de catálogo (537-551 — PERO también escribe `cantidad: nuevoStock` en 548), `revalidatePath("/productos")` (658).
- **Reposición** (debe salir): cálculo de diferencia/totalCosto (472-477), `validatePaymentDistribution` (479-481), lookup de `cajaAbierta` + `assertCajaSupportsCash` (483-509), validación de saldo Banco (511-534), creación de `Compra` + `DetalleCompra` (556-571), `pagoCompra.createMany` (576-583), `movimientoCaja` EGRESO + decremento `totalVentas` (586-611), `movimientoFinanciero` EGRESO (614-626), path legacy (628-652), `revalidatePath("/caja")` (659-661).

`createProducto` (198-422) repite el mismo bloque de compra/pagos/movimientos para stock inicial (307-408) — misma lógica con `producto.create` en lugar de `update`.

**UI actual** (`src/components/tables/ProductosTable.tsx`, 1700 líneas):
- Un único Dialog "Agregar/Editar Repuesto" (1360-1621). En modo edición muestra "Stock Actual" (deshabilitado), "Cantidad a Reponer" (1537-1550, state `cantidadAReponer`), "Nuevo Stock" readonly = `cantidad` actual + a reponer (1551-1562) y `PaymentDistribution` (1563-1572).
- `handleFormSubmit` (592-645): calcula `getProductPurchaseCost` (lee `cantidadAReponer` en modo "edit"), valida distribución incompleta, inyecta `pagos` como JSON y llama `updateProducto(editingProduct.id, formData)` (623).
- `onInput` del form (1378-1385) recalcula `productPurchaseCost` para el `total` de `PaymentDistribution`.
- Drawer del producto (1179-1358): acciones "Editar producto", "Restar stock", "Historial de estados", "Dar de baja/Activar" (1302-1345). `canManageProducts = ADMINISTRADOR | ENCARGADO_STOCK` (721).

**PaymentDistribution** (`src/components/ui/PaymentDistribution.tsx`, 505 líneas): componente genérico (props `total, onChange, cajaBalance, cajaAbierta, disabled`); no renderiza nada si `total <= 0`; mantiene estado interno de filas. **Reusable tal cual** en un modal de solicitud.

**Helpers**: `getProductPurchaseCost(formData, mode)` lee `cantidad` (create) o `cantidadAReponer` (edit); `isProductPaymentDistributionIncomplete`; `shouldCreateCajaEgreso`; `calcularEfectivoFisico`; `calcularSaldoCuentaFinanciera`.

**Permisos** (`src/lib/permissions.ts`): sin `productos.reponer`. ADMINISTRADOR y ENCARGADO_STOCK tienen `crear+editar+restar_stock+estado`. `DEFAULT_ROLE_PERMISSIONS` alimenta el seed (`prisma/seed.ts` 738-846, upsert por rol → re-correr seed propaga permisos nuevos).

**Alertas**: `sonner` instalado y cableado (`ChopperToaster` en `src/app/layout.tsx:52`, usado en `employee-panel.tsx`). NO existe modelo Notificacion. Sin push/websocket.

**Tests existentes** (vitest): `productos-create.test.ts` (197), `productos-update.test.ts` (333), `productos-payment-distribution.test.ts` (517), `reposicion-banco-integration.test.ts` (447).

## Affected Areas

- `src/actions/productos.ts` — `updateProducto` pierde el bloque de reposición; `createProducto` puede deduplicar contra el helper; `productoSchema` pierde `cantidad/pagos/origenPago` (o quedan opcionales) para edición.
- `src/actions/reposiciones.ts` (nuevo) o `src/lib/reposicion.ts` — acciones `solicitarReposicion`, `aprobarReposicion`, `rechazarReposicion`, `getSolicitudesReposicion` + helper `ejecutarReposicion(tx, …)`.
- `prisma/schema.prisma` — **nuevo modelo `SolicitudReposicion`** (decisión de diseño; ver Recomendación) + posible `compraId` opcional.
- `src/components/tables/ProductosTable.tsx` — Dialog de edición pierde sección de reposición (1532-1590); nueva acción de drawer "Solicitar reposición" (zona 1302-1345); `handleFormSubmit` sin pagos.
- `src/components/ui/SolicitarReposicionModal.tsx` (nuevo) — patrón `RestarStockModal`, reutiliza `PaymentDistribution`.
- `src/app/solicitudes/page.tsx` (nuevo) + item en `src/components/layout/Navbar.tsx` (`navItems` 47-56, roles son strings) + `AppShell.tsx` para badge opcional.
- `src/app/dashboard/page.tsx` + `DashboardClient` — widget opcional de pendientes.
- `src/lib/permissions.ts` + `prisma/seed.ts` — nuevas claves `productos.reponer`, `productos.aprobar_reposicion`.
- `src/lib/product-purchase-payments.ts` — `ProductPurchaseMode` podría sumar modo `"reposicion"`.
- Tests: 4 archivos afectados + 2-4 nuevos.

## Approaches

### 1. Modelo `SolicitudReposicion` + helper extraído + UI separada (RECOMENDADO)

Nuevo modelo con estado string (patrón `Caja.estado`/`Venta.estado`):

```prisma
model SolicitudReposicion {
  id            Int      @id @default(autoincrement())
  productoId    Int
  cantidad      Int                 // delta solicitado (> 0)
  costoUnitario Float               // snapshot precioCompra al solicitar
  total         Float               // cantidad * costoUnitario
  proveedorId   Int                 // snapshot del proveedor al solicitar
  estado        String   @default("PENDIENTE") // PENDIENTE | APROBADA | RECHAZADA
  origenPago    OrigenPagoCompra    // snapshot
  pagos         Json?               // snapshot de la distribución (PagoValidado[])
  motivo        String?
  respuesta     String?             // observación del admin al resolver
  solicitanteId Int
  aprobadorId   Int?
  compraId      Int?    @unique     // Compra creada al aprobar
  createdAt     DateTime @default(now())
  resueltoEn    DateTime?
  producto      Producto @relation(...)
  proveedor     Proveedor @relation(...)
  solicitante   Usuario  @relation("solicitante", ...)
  aprobador     Usuario? @relation("aprobador", ...)
  compra        Compra?  @relation(...)
}
```

Flujo: `solicitarReposicion` → SOLO inserta (nunca toca stock/Compra/caja/banco). `aprobarReposicion` → transacción: carga solicitud (estado PENDIENTE o falla), re-validación de fondos vía `ejecutarReposicion` (la distribución y los saldos pueden haber cambiado entre solicitud y aprobación), update de `Producto.cantidad += cantidad`, crea Compra/DetalleCompra/PagoCompra/movimientos, setea `estado=APROBADA` + `aprobadorId` + `compraId`. `rechazarReposicion` → solo setea estado/respuesta.

- Pros: cumple la restricción (nada se ejecuta sin aprobación); auditoría completa (quién pidió, quién aprobó, cuándo, compra asociada); el helper único mantiene la lógica financiera idéntica a hoy (mismo comportamiento verificado por los tests actuales); snapshots de `precioCompra/proveedorId/origenPago/pagos` hacen la revisión del admin fiel a lo solicitado; estado string con constante en lib (patrón `ORIGENES_PAGO_COMPRA`).
- Cons: migración de schema + `prisma generate`; más piezas (modelo, página, modal, permisos); decisiones de negocio pendientes (stock inicial en create, auto-aprobación admin).
- Effort: High (pero la lógica financiera es copia-movida, no reescrita).

### 2. Reutilizar `Compra` con flag de estado (sin modelo nuevo)

Añadir `estado`/`aprobadoEn` a `Compra`; la solicitud es una Compra PENDIENTE que al aprobarse se completa.

- Pros: sin tabla nueva; la compra final ya tiene la mayoría de los datos.
- Cons: `Compra` es contable (total, origenPago enum, usuarioId); listados de compras/caja mezclarían solicitudes pendientes; los `PagoCompra` solo deben crearse al aprobar pero la distribución no queda guardada en ningún lado (necesitarías igual un campo JSON); no hay trazabilidad de `aprobadorId`/`respuesta` sin más columnas; al rechazar quedaría una "Compra" zombie. Termina siendo el modelo 1 con peor semántica.
- Effort: Medium (pero empeora el modelo de datos).

### 3. Estado de solicitud "volátil" sin persistencia (session/localStorage)

- Pros: mínimo esfuerzo.
- Cons: se pierde la solicitud si el admin no la ve; sin auditoría; rompe el requerimiento de flujo completo. Descartado.

## Recommendation

**Enfoque 1.** Puntos clave de diseño:

1. **Helper único `ejecutarReposicion(tx, params)`**: extraer de `updateProducto` (472-653) y deduplicar con el bloque de stock inicial de `createProducto` (307-408). Params: `{ tx, productoId, nombreProducto, cantidad, costoUnitario, proveedorId, origenPago, pagos, usuarioId, descripcionPrefijo }`; retorna `{ compraId, cajaMovimientoCreado, bancoMovimientoCreado }`. La actualización de `Producto.cantidad` queda en el CALLER (update hoy / create hoy / aprobación mañana) — el helper solo hace Compra+pagos+movimientos+validaciones. Comportamiento financiero verificado por los tests existentes se conserva al moverlos al helper.
2. **`updateProducto` edit-only**: elimina `cantidad` del update (548), deja de parsear `pagos`/`origenPago`/`cantidad` (o los ignora), conserva validación de imagen + campos de catálogo. NUNCA más crea Compra/movimientos.
3. **`createProducto`**: conserva el comportamiento actual (stock inicial con Compra inmediata) — es inicialización de catálogo, no reposición. **Decisión de negocio**: si el usuario quiere que el stock inicial TAMBIÉN pase por aprobación, el helper ya lo habilita (crear producto con cantidad 0 + solicitar). Dejar explícito en propuesta.
4. **Permisos nuevos**: `productos.reponer` (solicitar: ENCARGADO_STOCK + ADMINISTRADOR) y `productos.aprobar_reposicion` (aprobar: ADMINISTRADOR). Agregar a `PERMISSIONS` + `DEFAULT_ROLE_PERMISSIONS`; el seed hace upsert por rol (738-846) y propaga al re-correr. Alternativa mínima: reusar `productos.editar` para aprobar (menos explícito).
5. **UI**: acción de drawer "Solicitar reposición" → nuevo `SolicitarReposicionModal` (patrón `RestarStockModal` + `PaymentDistribution` reutilizado tal cual; total = `cantidadAReponer * precioCompra`). El Dialog de edición pierde toda la sección de reposición (1532-1590) y la inyección de pagos en `handleFormSubmit`.
6. **Alerta al ADMIN (in-app, sin push)**: página `/solicitudes` (server component gated a ADMINISTRADOR) con lista PENDIENTE/APROBADAS/RECHAZADAS y acciones aprobar/rechazar; item de Navbar (roles = strings, estilo actual) con badge de pendientes opcional; widget en dashboard opcional; `toast` sonner en aprobación/rechazo/solicitud.

## Decision points para sdd-propose

1. **Stock inicial en `createProducto`**: ¿mantener Compra inmediata o derivar a solicitud? (Recomendado: mantener.)
2. **Auto-aprobación de ADMINISTRADOR**: ¿el admin que solicita se auto-aprueba? (Recomendado: no — flujo uniforme de 2 pasos; el requerimiento no lo pide.)
3. **Granularidad de permisos**: claves nuevas vs reusar `productos.editar` para aprobar. (Recomendado: claves nuevas.)
4. **Archivo del helper**: `src/lib/reposicion.ts` (lógica tx) + acciones finas en `src/actions/reposiciones.ts` — mantener `productos.ts` flaco.

## Risks

1. **Regresión financiera**: mover el bloque a un helper compartido (update + create) puede alterar sutilmente el flujo legacy vs distribución. Los tests actuales MITIGAN: moverse, no reescribirse.
2. **Snapshot vs estado real al aprobar**: fondos de caja/banco pueden cambiar entre solicitud y aprobación → la aprobación re-valida y puede fallar. UX: mensaje claro del error de fondos y permitir rechazar con respuesta.
3. **Deriva de permisos**: si no se agregan `productos.reponer/aprobar_reposicion` (PERMISSIONS + DEFAULT_ROLE_PERMISSIONS + seed re-corrido), ENCARGADO_STOCK queda sin forma de reponer tras quitar la reposición de edición.
4. **Churn de tests**: 3 archivos existentes asientan Compra vía `updateProducto`; mover el punto de entrada probado (update → helper/aprobar) puede dejar cobertura incompleta si se copian mal los asserts.
5. **Scope de `createProducto`**: si la decisión 1 se toma mal, o se bloquea la creación de catálogo o se bypasea el control de aprobación.

## Test Plan

Cambian:
- `productos-update.test.ts`: quedan los tests edit-only (179-197, 300-332); se eliminan/mueven los 4 de reposición (199-284); el test de cantidad negativa (286-291) desaparece del schema de edición.
- `productos-payment-distribution.test.ts`: quedan los de `createProducto`; los tests 2-10 vía `updateProducto` (281-447) se mueven al helper/aprobación.
- `reposicion-banco-integration.test.ts`: los bonus de `updateProducto` (405-446) se mueven; el resto queda.
- `productos-create.test.ts`: el test de contrato "2 PaymentDistribution" (185-196) pasa a esperar 1 en el dialog de edición + 1 en el modal de solicitud.

Nuevos:
- `ejecutar-reposicion.test.ts` (helper): escenarios movidos (caja/banco/mixto/legacy) contra el helper.
- `solicitar-reposicion.test.ts`: crea PENDIENTE con snapshots, NO toca stock/Compra/movimientos, valida cantidad > 0 y permiso.
- `aprobar-reposicion.test.ts`: ejecuta helper en transacción, incrementa stock, setea APROBADA + compraId, re-valida fondos al aprobar, rechaza solicitudes no-PENDIENTE.
- `rechazar-reposicion.test.ts`: setea RECHAZADA + respuesta, cero writes financieros.
- `getSolicitudesReposicion.test.ts` + contrato UI (acción drawer + modal nuevo + ocurrencias de PaymentDistribution).

## Guard lines (delivery)

Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High

## Ready for Proposal

Sí. El explorador debe llevar al usuario las 3 decisiones de negocio (stock inicial en create, auto-aprobación admin, granularidad de permisos) y confirmar el alcance de la página `/solicitudes`.
