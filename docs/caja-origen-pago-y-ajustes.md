# Origen de Pago en Compras y Ajustes Auditables de Caja #0001

## Visión General

Este documento registra la especificación técnica y las reglas de negocio implementadas para el manejo del origen de pago en compras/reposiciones y la corrección auditada del historial de Caja #0001.

---

## 1. Origen de Pago en Compras (`OrigenPagoCompra`)

Se agregó el enumerado `OrigenPagoCompra` a Prisma y a la base de datos con los siguientes valores:

1. **`EFECTIVO_CAJA`** (Valor por defecto)
   - Requiere una caja abierta al registrar pagos reales en efectivo.
   - Crea el registro de `Compra` y sus `DetalleCompra`.
   - Incrementa el stock del producto.
   - Crea un `MovimientoCaja` de tipo `EGRESO`.
   - Decrementa el saldo acumulado (`totalVentas`) de la caja.

2. **`TRANSFERENCIA_BANCARIA`**
   - Registra la `Compra` contable y sus detalles.
   - Incrementa el stock del producto.
   - **No** crea movimiento de caja física.
   - **No** altera el saldo (`totalVentas`) de la caja.

3. **`CUENTA_CORRIENTE_PROVEEDOR`**
   - Registra la `Compra` contable y sus detalles.
   - Incrementa el stock del producto.
   - **No** crea egreso inmediato de caja.

4. **`FONDOS_EXTERNOS`**
   - Registra la `Compra` contable y sus detalles.
   - Incrementa el stock del producto.
   - **No** crea movimiento en la caja física.

---

## 2. Validación de Caja Abierta en Productos

- **Creación con Stock Inicial 0**: Se permite sin requerir una caja abierta. No genera compra contable ni egreso de caja.
- **Creación o Reposición con Pago en Efectivo (`EFECTIVO_CAJA`)**: Valida al inicio de la transacción si existe una caja abierta. Si no existe, cancela la operación antes de realizar cualquier escritura con el mensaje explicativo: `"No hay una caja abierta para registrar el pago en efectivo."`.

---

## 3. Corrección Histórica de Caja #0001

La auditoría sobre Caja #0001 identificó las reposiciones #8 y #9 como pagadas mediante transferencia bancaria, ajustando el saldo físico de la caja de la siguiente forma:

- **Compra #8**: Marcada con origen `TRANSFERENCIA_BANCARIA` ($400.000).
- **Compra #9**: Marcada con origen `TRANSFERENCIA_BANCARIA` ($1.120.000).
- **Ajustes auditables creados**:
  - Movimiento ID #79: INGRESO por $400.000 (`[AJUSTE-CAJA-0001-REPOSICION-0008]`).
  - Movimiento ID #80: INGRESO por $1.120.000 (`[AJUSTE-CAJA-0001-REPOSICION-0009]`).
- **Saldos finales consolidados de Caja #0001**:
  - `totalVentas`: -$53.400
  - Saldo mostrado: $46.600
  - Balance de movimientos: $46.600

---

## 4. Filtro y Clasificación Visual de "Ajustes"

- En la terminal de caja (`CajaTerminal.tsx`), los movimientos con tokens de ajuste se clasifican con la etiqueta e icono visual **Ajustes**.
- La función de clasificación `getConcepto()` y `getTipoVisual()` prioriza la coincidencia de "ajuste" antes que "reposición" para que los movimientos de ajuste no se confundan con compras ordinarias.
