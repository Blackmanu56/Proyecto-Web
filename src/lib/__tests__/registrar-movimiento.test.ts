import { describe, expect, it, vi } from "vitest";
import { registrarMovimiento } from "../movimiento-producto";

describe("registrarMovimiento", () => {
  it("calls tx.movimientoProducto.create with correct params", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const tx = { movimientoProducto: { create } };

    await registrarMovimiento(tx, {
      productoId: 10,
      tipo: "COMPRA",
      cantidadAnterior: 0,
      cantidadNueva: 5,
      compraId: 42,
      motivo: "Stock inicial",
      usuarioId: 1,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        productoId: 10,
        usuarioId: 1,
        tipo: "COMPRA",
        cantidadAnterior: 0,
        cantidadNueva: 5,
        compraId: 42,
        ventaId: null,
        motivo: "Stock inicial",
        observacion: null,
        cambios: undefined,
      },
    });
  });

  it("sets compraId and ventaId to null when omitted", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const tx = { movimientoProducto: { create } };

    await registrarMovimiento(tx, {
      productoId: 10,
      tipo: "RESTA_MANUAL",
      cantidadAnterior: 10,
      cantidadNueva: 7,
      motivo: "Venta",
      usuarioId: 1,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          compraId: null,
          ventaId: null,
        }),
      })
    );
  });

  it("passes cambios JSON through when provided", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const tx = { movimientoProducto: { create } };
    const cambios = [{ campo: "nombre", anterior: "Old", nuevo: "New" }];

    await registrarMovimiento(tx, {
      productoId: 10,
      tipo: "EDICION",
      cantidadAnterior: 5,
      cantidadNueva: 5,
      motivo: "Edición de producto",
      cambios,
      usuarioId: 1,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cambios,
        }),
      })
    );
  });
});
