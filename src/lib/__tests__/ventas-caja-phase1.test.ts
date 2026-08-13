import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    cliente: { findUnique: vi.fn() },
    caja: { findFirst: vi.fn(), update: vi.fn() },
    cuentaFinanciera: { findFirst: vi.fn() },
    producto: { findUnique: vi.fn(), update: vi.fn() },
    venta: { create: vi.fn() },
    movimientoCaja: { create: vi.fn() },
    movimientoFinanciero: { create: vi.fn() },
  };

  return {
    tx,
    transaction: vi.fn(),
    getSession: vi.fn(),
    requirePermission: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/auth.server", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/auth-permissions", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createVenta } from "../../actions/ventas";

const OPEN_CAJA = { id: 7, estado: "ABIERTA", montoInicial: 100_000, totalVentas: 0 };
const SESSION = { userId: 3, permissions: ["ventas.crear"] };

type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA_DEBITO" | "TARJETA_CREDITO";

async function sell(metodoPago: MetodoPago) {
  return createVenta(
    2,
    [{ productoId: 10, cantidad: 1 }],
    metodoPago,
    null,
    0,
    "FACTURA_C",
    metodoPago === "TARJETA_CREDITO" ? 3 : null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.requirePermission.mockResolvedValue(SESSION);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.cliente.findUnique.mockResolvedValue({ id: 2, activo: true });
  mocks.tx.caja.findFirst.mockResolvedValue(OPEN_CAJA);
  mocks.tx.producto.findUnique.mockResolvedValue({
    id: 10,
    nombre: "Producto",
    activo: true,
    cantidad: 4,
    precioVenta: 50_000,
  });
  mocks.tx.producto.update.mockResolvedValue({ id: 10, cantidad: 3 });
  mocks.tx.venta.create.mockResolvedValue({ id: 22, total: 50_000, metodoPago: "EFECTIVO" });
  mocks.tx.movimientoCaja.create.mockResolvedValue({ id: 31 });
  mocks.tx.movimientoFinanciero.create.mockResolvedValue({ id: 100 });
  mocks.tx.cuentaFinanciera.findFirst.mockResolvedValue({ id: 1 });
  mocks.tx.caja.update.mockResolvedValue(OPEN_CAJA);
});

afterEach(() => vi.restoreAllMocks());

describe("Phase 1 sale cash semantics", () => {
  it("posts one physical ingreso for a cash sale with an open Caja", async () => {
    const result = await sell("EFECTIVO");

    expect(result).toMatchObject({ success: true, ventaId: 22, total: 50_000 });
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cajaId: 7, ventaId: 22, tipo: "INGRESO", monto: 50_000 }),
    });
    expect(mocks.tx.caja.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { totalVentas: { increment: 50_000 } },
    });
  });

  it("keeps a fully discounted cash sale economic but creates no zero Caja movement", async () => {
    mocks.tx.venta.create.mockResolvedValueOnce({ id: 23, total: 0, metodoPago: "EFECTIVO" });

    const result = await createVenta(
      2,
      [{ productoId: 10, cantidad: 1 }],
      "EFECTIVO",
      "PORCENTAJE",
      100,
      "FACTURA_C",
      null
    );

    expect(result).toMatchObject({ success: true, ventaId: 23, total: 0 });
    expect(mocks.tx.producto.update).toHaveBeenCalledOnce();
    expect(mocks.tx.venta.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ total: 0, montoDescuento: 50_000 }),
    });
    expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it.each(["TRANSFERENCIA", "TARJETA_DEBITO", "TARJETA_CREDITO"] as const)(
    "records %s with MovimientoFinanciero and no MovimientoCaja",
    async (metodoPago) => {
      const result = await sell(metodoPago);

      expect(result).toMatchObject({ success: true, ventaId: 22, total: 50_000 });
      expect(mocks.tx.venta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ metodoPago }),
      });
      expect(mocks.tx.producto.update).toHaveBeenCalledOnce();
      expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
      expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
      expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: "INGRESO", monto: 50_000, ventaId: 22 }),
      });
      expect(mocks.tx.caja.update).not.toHaveBeenCalled();
    }
  );

  it("blocks a cash sale without an open Caja using the exact business message", async () => {
    mocks.tx.caja.findFirst.mockResolvedValue(null);

    const result = await sell("EFECTIVO");

    expect(result).toEqual({ error: "No hay una caja abierta para registrar un cobro en efectivo." });
    expect(mocks.tx.venta.create).not.toHaveBeenCalled();
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
  });

  it.each(["TRANSFERENCIA", "TARJETA_DEBITO", "TARJETA_CREDITO"] as const)(
    "allows %s without an open Caja and creates MovimientoFinanciero",
    async (metodoPago) => {
      mocks.tx.caja.findFirst.mockResolvedValue(null);

      const result = await sell(metodoPago);

      expect(result).toMatchObject({ success: true, ventaId: 22, total: 50_000 });
      expect(mocks.tx.venta.create).toHaveBeenCalledOnce();
      expect(mocks.tx.producto.update).toHaveBeenCalledOnce();
      expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
      expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
      expect(mocks.tx.caja.update).not.toHaveBeenCalled();
    }
  );
});
