export const PAYMENT_METHODS = ["EFECTIVO", "TRANSFERENCIA", "TARJETA_DEBITO", "TARJETA_CREDITO"] as const;
export const DISCOUNT_TYPES = ["PORCENTAJE", "MONTO"] as const;
export const COMPROBANTE_TYPES = ["FACTURA_A", "FACTURA_B", "FACTURA_C"] as const;
export const CREDIT_INSTALLMENTS = [3, 6, 12, 18] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type DiscountType = typeof DISCOUNT_TYPES[number];
export type ComprobanteType = typeof COMPROBANTE_TYPES[number];

export type ValidVentaPayload = {
  clienteId: number;
  items: { productoId: number; cantidad: number }[];
  metodoPago: PaymentMethod;
  descuentoTipo: DiscountType | null;
  montoDescuento: number;
  tipoComprobante: ComprobanteType;
  cuotas: number | null;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function includesValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function includesNumber<T extends readonly number[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "number" && values.includes(value);
}

export function validateVentaPayload(input: unknown): { success: true; data: ValidVentaPayload } | { success: false; error: string } {
  if (!input || typeof input !== "object") {
    return { success: false, error: "Datos de venta inv?lidos." };
  }

  const data = input as Record<string, unknown>;

  if (!isPositiveInteger(data.clienteId)) {
    return { success: false, error: "Cliente inv?lido." };
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { success: false, error: "El carrito de compras est? vac?o." };
  }

  const items: ValidVentaPayload["items"] = [];
  const seen = new Set<number>();
  for (const rawItem of data.items) {
    if (!rawItem || typeof rawItem !== "object") {
      return { success: false, error: "Producto inv?lido en el carrito." };
    }

    const item = rawItem as Record<string, unknown>;
    if (!isPositiveInteger(item.productoId)) {
      return { success: false, error: "Producto inv?lido en el carrito." };
    }

    if (!isPositiveInteger(item.cantidad)) {
      return { success: false, error: "La cantidad debe ser un entero mayor que cero." };
    }

    if (seen.has(item.productoId)) {
      return { success: false, error: "El payload contiene productos duplicados." };
    }

    seen.add(item.productoId);
    items.push({ productoId: item.productoId, cantidad: item.cantidad });
  }

  if (!includesValue(PAYMENT_METHODS, data.metodoPago)) {
    return { success: false, error: "Forma de pago inv?lida." };
  }

  const descuentoTipo = data.descuentoTipo === null ? null : data.descuentoTipo;
  if (descuentoTipo !== null && !includesValue(DISCOUNT_TYPES, descuentoTipo)) {
    return { success: false, error: "Tipo de descuento inv?lido." };
  }

  if (!isFiniteNonNegativeNumber(data.montoDescuento)) {
    return { success: false, error: "El descuento debe ser un n?mero v?lido y no negativo." };
  }

  if (data.montoDescuento > 0 && descuentoTipo === null) {
    return { success: false, error: "Debe indicar el tipo de descuento." };
  }

  if (descuentoTipo === "PORCENTAJE" && data.montoDescuento > 100) {
    return { success: false, error: "El descuento porcentual no puede superar el 100%." };
  }

  if (!includesValue(COMPROBANTE_TYPES, data.tipoComprobante)) {
    return { success: false, error: "Tipo de comprobante inv?lido." };
  }

  let cuotas: number | null = null;
  if (data.metodoPago === "TARJETA_CREDITO") {
    if (!includesNumber(CREDIT_INSTALLMENTS, data.cuotas)) {
      return { success: false, error: "Cantidad de cuotas inv?lida." };
    }
    cuotas = data.cuotas;
  }

  return {
    success: true,
    data: {
      clienteId: data.clienteId,
      items,
      metodoPago: data.metodoPago,
      descuentoTipo,
      montoDescuento: data.montoDescuento,
      tipoComprobante: data.tipoComprobante,
      cuotas,
    },
  };
}
