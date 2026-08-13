# Distribución de Pago en Stock Inicial y Reposiciones (Pagos Mixtos) #0002

## Visión General

Este documento registra la especificación técnica, las iteraciones de UX, el diagnóstico del incidente de runtime y las verificaciones ejecutadas para la distribución de pago (pagos mixtos) al crear productos con stock inicial y al reponer productos existentes.

---

## 1. Modelo de Datos (`PagoCompra`)

Se agregó el modelo `PagoCompra` a Prisma, mapeado a la tabla `pagos_compra`:

- **`prisma/schema.prisma`** — `model PagoCompra` (línea 31) con `@@map("pagos_compra")`.
- Relación `compraId` → `Compra` con `@relation(fields: [compraId], references: [id], onDelete: Cascade)`.
- `Compra` expone `pagos PagoCompra[]` (línea 241).
- `PagoCompra.medio` es `String` y admite `EFECTIVO_CAJA`, `TRANSFERENCIA_BANCARIA`, `MERCADO_PAGO`, `CUENTA_CORRIENTE_PROVEEDOR` y `FONDOS_EXTERNOS`.
- El enum legado `OrigenPagoCompra` de `Compra.origenPago` no incluye `MERCADO_PAGO`; la distribución detallada y autoritativa queda en `PagoCompra`.

### Migraciones

| Migración | Propósito |
| --------- | --------- |
| `20260805051030_agregar_origen_pago_compra` | Origen de pago en compras (ver doc #0001) |
| `20260812013750_add_pago_compra` | Tabla `pagos_compra` |
| `20260812013751_migrate_existing_payments` | Migración de pagos existentes al nuevo modelo |

Estado verificado con `npx prisma migrate status`: la migración de tabla está aplicada y `20260812013751_migrate_existing_payments` sigue pendiente. No se aplicó.

El SQL de migración histórica no es idempotente porque inserta todas las compras elegibles sin `NOT EXISTS` ni restricción única. Su impacto debe revisarse nuevamente contra los datos reales antes de aplicarlo.

---

## 2. Backend (`src/actions/productos.ts`)

La reposición con pago distribuido se ejecuta en `createProducto` (stock inicial) y `updateProducto` (reposición), ambas dentro de una única `$transaction` con rollback total ante cualquier fallo:

1. Valida suma, medios duplicados y efectivo disponible antes de la primera escritura.
2. Crea/actualiza el producto y registra `Compra` + `DetalleCompra`.
3. Inserta una sola vez la distribución con `tx.pagoCompra.createMany({ data })`.
4. Si existe una Caja abierta, crea exactamente un `MovimientoCaja` enlazado a la Compra: usa como monto la suma asignada a `EFECTIVO_CAJA`, o `0` cuando la distribución es 100% no efectiva. `Caja.totalVentas` disminuye únicamente por el monto efectivo.

### Validaciones de negocio (no modificables desde el frontend)

- La suma de los pagos debe ser **exactamente igual** al total de la reposición (`totalCosto`).
- Los medios de pago no pueden repetirse dentro de la misma compra.
- Un pago en `EFECTIVO_CAJA` requiere una caja abierta y saldo suficiente (`cajaActual = montoInicial + totalVentas`).
- En el contrato legado sin `pagos`, un origen `EFECTIVO_CAJA` valida el `totalCosto` completo contra Caja antes de escribir; no puede sobregirar.
- Con `pagos` distribuidos, la validación de Caja considera exclusivamente la suma asignada a `EFECTIVO_CAJA`.
- Con Caja abierta, una distribución 100% no efectiva crea una única ancla neutral de monto `0`; no modifica `Caja.totalVentas`.
- Sin Caja abierta, una compra 100% no efectiva persiste como `Compra` + `PagoCompra` sin crear `MovimientoCaja`.
- Sin Caja abierta, cualquier distribución que incluya `EFECTIVO_CAJA` se rechaza antes de escribir.
- Mercado Pago continúa admitido por el backend y el almacenamiento para compatibilidad histórica, pero no se ofrece para nuevas reposiciones.
- Los errores de autorización esperables se reconocen por una lista cerrada y conservan su mensaje. Cualquier fallo técnico inesperado —incluidos errores Prisma durante la autorización— se registra con `console.error` y devuelve: “No se pudo registrar la reposición. Intentá nuevamente.”

---

## 3. Frontend — Componente `PaymentDistribution.tsx`

Componente de distribución de pago dentro del modal de reposición. Iteraciones de UX aplicadas (estado actual del working tree):

- **Fila nueva vacía**: arranca con `value=""` y `placeholder="0,00"` (sin valor fantasma `0`).
- **Blur sin error fantasma**: si el campo queda vacío (`raw === ""`), el blur no marca error ni estado inválido.
- **Errores por fila** (`getRowError`):
  - `"El importe de {label} debe ser mayor a 0."`
  - `"El efectivo solicitado supera el saldo disponible."`
  - `"No hay una caja abierta..."`
- **Errores globales**: solo duplicados de medio y `"Se superó el total por X"`.
- **`canCompleteWithCaja`**: completa con efectivo actualizando la fila `EFECTIVO_CAJA` existente, o agregándola si hay caja abierta y queda un medio disponible.
- **Tooltip de Info**: usa el atributo nativo `title` sobre el ícono del header (el design system no tiene componente `Tooltip`).
- **Resumen compacto** (`gap-y-0.5`): Asignado / Restante.
- **Acción "Completar con efectivo"** con estilo brand.
- **Métodos seleccionables nuevos**: Efectivo de Caja, Transferencia, Cta. Cte. Proveedor y Fondos Externos. Mercado Pago permanece únicamente como compatibilidad histórica.
- **Transferencia**: utiliza la etiqueta corta `Transferencia`.
- **Fondos Externos**: `Input` de texto secundario, neutral y de ancho completo bajo su fila, con placeholder `Aporte del propietario, caja externa, etc.`. Vacío no es error ni bloquea.
- Se quitó la línea "Regla" del cuerpo del componente y los mensajes de éxito / caja cerrada del cuerpo.

---

## 4. Frontend — Costo y gating del botón Guardar (`ProductosTable.tsx`)

`src/lib/product-purchase-payments.ts` concentra dos helpers puros y probados:

- `getProductPurchaseCost(formData, mode)` calcula creación como `cantidad * precioCompra` y edición como `cantidadAReponer * precioCompra`.
- Los valores salen de los campos reales del formulario mediante `FormData`; no se duplican estados para cantidad o precio.
- `isProductPaymentDistributionIncomplete(totalCost, payments)` exige montos positivos, suma completa y medios únicos cuando el costo es mayor a cero.

`ProductosTable` mantiene únicamente `productPurchaseCost` como estado derivado para volver a renderizar. Ese mismo total alimenta `PaymentDistribution` tanto en creación como en edición. El guard se aplica en el botón y nuevamente dentro de `handleFormSubmit`, por lo que Enter o un submit programático no lo evitan.

```ts
const distribucionIncompleta = isProductPaymentDistributionIncomplete(
  productPurchaseCost,
  payments
);
// ...
disabled={isPending || distribucionIncompleta}
```

Reglas:

- Stock inicial o reposición `= 0` → no exige distribución.
- Costo `> 0` sin distribución completa/válida → botón deshabilitado y submit rechazado defensivamente.
- `setPayments([])`, `setCantidadAReponer("")` y `setProductPurchaseCost(0)` se resetean al abrir el modal (líneas 490–513); los pagos también se limpian tras guardar (líneas 629–633).

---

## 5. Incidente: `Cannot read properties of undefined (reading 'createMany')`

### Síntoma

Al guardar una reposición con pago mixto (ej.: total $21.000 = $10.000 transferencia + $11.000 efectivo), la acción fallaba con ese TypeError. El botón Guardar se habilitaba correctamente.

### Diagnóstico (causa raíz)

- **El delegate existe**: `tx.pagoCompra.createMany` se usa en `productos.ts` para creación (línea 272) y edición (línea 462); el modelo `PagoCompra` está en el esquema y el cliente generado en disco está al día.
- **El objeto `undefined` era `tx.pagoCompra` en runtime**, porque el proceso del servidor de desarrollo se había iniciado antes de regenerar Prisma Client.
- Next/Turbopack **no recarga módulos de `node_modules`**: un proceso iniciado antes de `prisma generate` conserva el cliente anterior en memoria, sin el delegate `pagoCompra`.
- La verificación en un proceso fresco confirmó que `prisma.pagoCompra.createMany` y `tx.pagoCompra.createMany` están disponibles.

### Resolución

- No se reemplazó `createMany` ni se inventó una migración: el delegate existe en el esquema y en un proceso fresco.
- Se ejecutó `npx prisma generate` durante la validación final.
- El proceso dev iniciado antes de la generación continúa con el cliente viejo en memoria; el fix operativo sigue siendo reiniciarlo (`Ctrl+C` → `npm run dev`). Si persistiera, borrar `.next` y arrancar nuevamente.
- Se agregó manejo seguro para futuros errores técnicos sin ocultar los errores de negocio.

---

## 6. Estado del Working Tree

### Commits realizados (rama actual)

| Commit | Descripción |
| ------ | ----------- |
| `b6e7b53` | `feat(compras)`: pagos mixtos con distribución y validación de caja |
| `b86be20` | `fix(compras)`: mejora UX pagos mixtos y soporte Caja cerrada |
| `469a988` | `fix(compras)`: iteración 3 UX distribución de pago |
| `6a6d511` | `fix(compras)`: corrección visual final distribución de pago |
| `e2e7f7e` | `fix(productos)`: regla transaccional siempre visible en modal edición |
| `82a9c59` | `fix(productos)`: regla de reposición compacta en distribución de pago |

### Archivos de implementación

- `M src/actions/productos.ts` — validación previa a escrituras, suma exclusiva de efectivo y manejo seguro de errores.
- `M src/components/ui/PaymentDistribution.tsx` — iteración UX (sección 3).
- `M src/components/tables/ProductosTable.tsx` — gating del botón Guardar (sección 4).
- `src/lib/product-purchase-payments.ts` — cálculo desde campos reales y validación pura del gating.
- `M src/lib/__tests__/productos-create.test.ts` — contrato actualizado al distribuidor de pagos.
- `M src/lib/__tests__/productos-update.test.ts` — expectativas de Caja, stock y reposiciones.
- `M src/actions/caja.ts` — incluye únicamente los campos necesarios de `Compra.pagos` en la consulta existente.
- `M src/components/ui/MovimientoDetalleModal.tsx` — agrega la distribución debajo del detalle original de reposición.
- `M src/lib/movimiento-format.ts` — conserva el formato histórico y construye la presentación exclusiva de la fila.
- `M src/components/forms/CajaTerminal.tsx` — usa la presentación de dos líneas únicamente en la fila visible; CSV e impresión conservan la llamada por defecto.
- `src/components/ui/ReposicionDescripcion.tsx` — renderiza producto/resumen y metadata secundaria de la reposición.
- `M src/lib/__tests__/movimiento-format.test.ts` — cubre formato histórico, total y etiquetas de medios.
- `src/lib/__tests__/productos-payment-distribution.test.ts` — escenarios backend, ancla única, Caja cerrada y atomicidad.
- `src/lib/__tests__/payment-distribution-ui.test.ts` — metadata seleccionable y helpers puros de costo, gating y resumen.
- `src/lib/__tests__/caja-replenishment-payment-detail.test.ts` — render del detalle original con distribución aditiva.
- `src/lib/__tests__/caja-replenishment-row.test.tsx` — render de las dos líneas visibles y compatibilidad histórica.
- `docs/pagos-mixtos-distribucion.md` — documentación del contrato y las verificaciones.

---

## 7. Verificación

### Comandos

- `npx prisma validate` — OK.
- `npx prisma generate` — OK; cliente 7.8.0 regenerado.
- `npx prisma migrate status` — informó, sin mutar, la migración de datos pendiente; el comando finaliza con código 1 por ese estado.
- Pruebas enfocadas — OK en la ejecución actual (metadata seleccionable, texto visible, render del detalle, Caja, permisos y atomicidad).
- `npm run lint -- --max-warnings=0` — OK.
- `npx tsc --noEmit --incremental false` — OK.
- `npx vitest run` — suite completa OK en la ejecución actual; el conteo exacto queda registrado por la salida del runner.
- `npx next build` — OK.
- `git diff --check` — OK.

### Escenarios backend verificados con mocks, sin mutar la DB

1. Solo efectivo en stock inicial: crea Compra/PagoCompra, stock y un único egreso.
2. Transferencia inicial $247.200 con Caja abierta: persiste PagoCompra y crea una única ancla neutral de $0, sin modificar el saldo físico.
3. Solo Mercado Pago histórico con Caja abierta: sigue aceptado por backend y crea una única ancla neutral de $0.
4. Solo cuenta corriente de proveedor con Caja abierta: crea una única ancla neutral de $0.
5. Fondos externos sin observación con Caja abierta: persiste con `observacion: null`, crea una ancla neutral y no bloquea.
6. Fondos externos con observación: conserva origen/referencia.
7. Mixto transferencia $42.400 + efectivo $204.800: solo $204.800 afecta Caja.
8. Efectivo exactamente $204.840 + Mercado Pago $42.360: válido.
9. Solo efectivo $247.200 con Caja $204.840: bloqueado antes de escrituras.
10. Mixto con efectivo $220.000 + transferencia $27.200: bloqueado antes de escrituras.
11. Pago 100% no efectivo sin Caja abierta: persiste Compra/PagoCompra y no crea MovimientoCaja.
12. Pago mixto que incluye efectivo sin Caja abierta: se rechaza antes de cualquier escritura.

También se verificó que el contrato legado sin `pagos` bloquea stock inicial en efectivo por $247.200 contra Caja de $204.840 antes de escribir; una transacción falsa sólo publica writes staged cuando el callback resuelve, por lo que el test de fallo técnico observa `committedWrites = []` en vez de inferir rollback por ausencia de revalidación.

La creación con stock inicial cero ignora cualquier distribución stale, no consulta Caja y no crea Compra, PagoCompra ni movimientos.

Además se verificó rechazo de medios duplicados antes de escribir, una única llamada a `PagoCompra.createMany`, sumas Compra/Detalle/PagoCompra, stock y ausencia de revalidación ante fallo técnico.

---

## 8. Aprendizajes

- Comparar `StartTime` del proceso node vs `LastWriteTime` del cliente generado es la forma más rápida de confirmar un cliente Prisma obsoleto en memoria.
- Tras un cambio de esquema (`prisma migrate dev` / `prisma generate`), el dev server de Next.js **debe reiniciarse**: Turbopack no invalida módulos de `node_modules` en caliente.
- El error "Cannot read properties of undefined (reading 'X')" sobre un delegate de Prisma casi siempre significa que el proceso carga un cliente generado anterior al modelo usado por el código.
