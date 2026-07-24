import { describe, expect, it } from "vitest";
import { validateVentaPayload } from "../ventas-validation";

const validPayload = {
  clienteId: 1,
  items: [{ productoId: 10, cantidad: 2 }],
  metodoPago: "EFECTIVO",
  descuentoTipo: "MONTO",
  montoDescuento: 0,
  tipoComprobante: "FACTURA_B",
  cuotas: null,
};

describe("validateVentaPayload", () => {
  it("accepts a valid cash sale payload", () => {
    expect(validateVentaPayload(validPayload).success).toBe(true);
  });

  it("rejects empty products", () => {
    expect(validateVentaPayload({ ...validPayload, items: [] })).toEqual({
      success: false,
      error: "El carrito de compras est? vac?o.",
    });
  });

  it("rejects negative, zero or decimal quantities", () => {
    expect(validateVentaPayload({ ...validPayload, items: [{ productoId: 10, cantidad: 0 }] }).success).toBe(false);
    expect(validateVentaPayload({ ...validPayload, items: [{ productoId: 10, cantidad: -1 }] }).success).toBe(false);
    expect(validateVentaPayload({ ...validPayload, items: [{ productoId: 10, cantidad: 1.5 }] }).success).toBe(false);
  });

  it("rejects invalid ids", () => {
    expect(validateVentaPayload({ ...validPayload, clienteId: 0 }).success).toBe(false);
    expect(validateVentaPayload({ ...validPayload, items: [{ productoId: -1, cantidad: 1 }] }).success).toBe(false);
  });

  it("rejects duplicate products", () => {
    expect(validateVentaPayload({
      ...validPayload,
      items: [
        { productoId: 10, cantidad: 1 },
        { productoId: 10, cantidad: 1 },
      ],
    })).toEqual({ success: false, error: "El payload contiene productos duplicados." });
  });

  it("rejects NaN and Infinity discounts", () => {
    expect(validateVentaPayload({ ...validPayload, montoDescuento: Number.NaN }).success).toBe(false);
    expect(validateVentaPayload({ ...validPayload, montoDescuento: Number.POSITIVE_INFINITY }).success).toBe(false);
  });

  it("rejects percentage discounts above 100", () => {
    expect(validateVentaPayload({ ...validPayload, descuentoTipo: "PORCENTAJE", montoDescuento: 101 })).toEqual({
      success: false,
      error: "El descuento porcentual no puede superar el 100%.",
    });
  });

  it("rejects invalid payment method and receipt type", () => {
    expect(validateVentaPayload({ ...validPayload, metodoPago: "CRIPTO" }).success).toBe(false);
    expect(validateVentaPayload({ ...validPayload, tipoComprobante: "RECIBO_X" }).success).toBe(false);
  });

  it("requires valid installments for credit card sales", () => {
    expect(validateVentaPayload({ ...validPayload, metodoPago: "TARJETA_CREDITO", cuotas: 6 }).success).toBe(true);
    expect(validateVentaPayload({ ...validPayload, metodoPago: "TARJETA_CREDITO", cuotas: 5 }).success).toBe(false);
  });
});
