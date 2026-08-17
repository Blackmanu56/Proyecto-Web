# Productos Specification

## Purpose

Catálogo de repuestos. `createProducto` crea el producto con stock inicial inmediato; `updateProducto` es SOLO edición de catálogo — nunca modifica stock ni genera Compra/movimientos. La reposición vive en `reposicion-stock`.

## Requirements

### Requirement: updateProducto edit-only

The system MUST restrict `updateProducto(productoId, formData)` to catalog fields: `nombre`, `marca`, `codigo`, `imagen`, `categoriaId`, `proveedorId`, `precioCompra`, `precioVenta`, `stockMinimo`.

The system MUST NOT write `Producto.cantidad` from edit input: any `cantidad`, `pagos` or `origenPago` present in `formData` MUST be ignored, and the action MUST NOT create `Compra`, `DetalleCompra`, `PagoCompra`, `MovimientoCaja` or `MovimientoFinanciero` in any code path.

The system MUST require `productos.editar`, return the updated product and revalidate `/productos`.

#### Scenario: Edición de catálogo limpia

- GIVEN un producto con `cantidad = 10`
- WHEN se editan `nombre` y `precioVenta` vía `updateProducto`
- THEN solo se actualizan campos de catálogo
- AND `cantidad` sigue en 10 y no existe ninguna `Compra` nueva

#### Scenario: Cantidad y pagos ignorados

- GIVEN `formData` con `cantidad = 5` y `pagos`
- WHEN `updateProducto` se ejecuta
- THEN `cantidad` no cambia y `pagos` se descartan
- AND no se crean Compra ni movimientos

#### Scenario: Producto inexistente

- GIVEN un `productoId` sin producto
- WHEN se llama `updateProducto`
- THEN retorna error "Producto no encontrado" sin writes

#### Scenario: Sin permiso

- GIVEN un usuario sin `productos.editar`
- WHEN se llama `updateProducto`
- THEN `requirePermission` rechaza la operación

### Requirement: createProducto con stock inicial

The system MUST keep `createProducto` creating the product and, when `cantidad > 0`, executing the initial-stock purchase (`Compra` + `DetalleCompra` + `PagoCompra` + `MovimientoCaja` + `MovimientoFinanciero`) in one transaction through the shared `ejecutarReposicion` helper — NOT routed through solicitud/aprobación.

The system MUST require `productos.crear`.

#### Scenario: Creación con stock inicial

- GIVEN `cantidad = 8`, distribución de pagos válida y fondos suficientes
- WHEN `createProducto` se ejecuta
- THEN se crea el producto con `cantidad = 8`, su `Compra` y movimientos
- AND todo ocurre en una única transacción

#### Scenario: Creación sin stock

- GIVEN `cantidad = 0`
- WHEN `createProducto` se ejecuta
- THEN se crea el producto sin `Compra` ni movimientos

## Test Requirements

- `productos-update.test.ts`: conservar los tests edit-only (179-197, 300-332); mover fuera los tests de reposición (199-284) y el de cantidad negativa (286-291), que dejan de aplicar al schema de edición.
- `productos-create.test.ts`: el contrato "2 PaymentDistribution" (185-196) pasa a esperar 1 en el dialog de edición + 1 en el modal de solicitud.
