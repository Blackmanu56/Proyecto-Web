import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    compra: {
      create: vi.fn(),
    },
    caja: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    cuentaFinanciera: {
      findFirst: vi.fn(),
    },
    movimientoCaja: {
      create: vi.fn(),
    },
    movimientoFinanciero: {
      create: vi.fn(),
    },
    pagoCompra: {
      createMany: vi.fn(),
    },
    movimientoProducto: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  };

  return {
    tx,
    getSession: vi.fn(),
    requirePermission: vi.fn(),
    transaction: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/auth.server", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    preferenciaNotificacion: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/stock-notifications", () => ({
  evaluarYNotificarStock: vi.fn().mockResolvedValue(undefined),
  verificarStockActual: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { reponerStockDirecto } from "../../actions/reposiciones";

const session = {
  userId: 2,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.reponer"],
};

function setupMocks() {
  mocks.getSession.mockResolvedValue(session);
  mocks.requirePermission.mockResolvedValue(session);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.producto.findUnique.mockResolvedValue({
    id: 10,
    nombre: "Kit transmisión",
    precioCompra: 100,
    cantidad: 10,
    activo: true,
    proveedorId: 3,
  });
  mocks.tx.producto.update.mockResolvedValue({ id: 10, cantidad: 15 });
  mocks.tx.compra.create.mockResolvedValue({ id: 50 });
  mocks.tx.pagoCompra.createMany.mockResolvedValue({ count: 1 });
  mocks.tx.caja.findFirst.mockResolvedValue({
    id: 30,
    estado: "ABIERTA",
    montoInicial: 500,
    totalVentas: 500,
    movimientos: [{ tipo: "INGRESO", monto: 50_000 }],
  });
  mocks.tx.caja.update.mockResolvedValue({ id: 30 });
  mocks.tx.cuentaFinanciera.findFirst.mockResolvedValue(null);
  mocks.tx.movimientoCaja.create.mockResolvedValue({ id: 70 });
  mocks.tx.movimientoFinanciero.create.mockResolvedValue({ id: 80 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  setupMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reponerStockDirecto", () => {
  it("uses atomic increment instead of read-modify-write", async () => {
    const result = await reponerStockDirecto(10, {
      cantidad: 5,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(result.success).toBe(true);
    // Verify atomic increment is used, not read-modify-write
    expect(mocks.tx.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ cantidad: { increment: 5 } }),
      })
    );
  });

  it("revalidates /productos", async () => {
    await reponerStockDirecto(10, {
      cantidad: 5,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
  });

  it("revalidates /caja when financial writes occur", async () => {
    await reponerStockDirecto(10, {
      cantidad: 5,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/caja");
  });
});
