import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    solicitudReposicion: {
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
    notificacion: {
      create: vi.fn(),
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

import { aprobarReposicion } from "../../actions/reposiciones";

const adminSession = {
  userId: 2,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.aprobar_reposicion"],
};

function solicitudPendiente(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    productoId: 10,
    cantidad: 5,
    costoUnitario: 100,
    total: 500,
    proveedorId: 3,
    estado: "PENDIENTE",
    origenPago: "EFECTIVO_CAJA",
    pagos: [{ medio: "EFECTIVO_CAJA", monto: 500 }],
    solicitanteId: 1,
    producto: {
      id: 10,
      nombre: "Kit transmisi?n",
      precioCompra: 100,
      cantidad: 10,
      activo: true,
    },
    ...overrides,
  };
}

function setupMocks(solicitud: Record<string, unknown> | null = solicitudPendiente()) {
  mocks.getSession.mockResolvedValue(adminSession);
  mocks.requirePermission.mockResolvedValue(adminSession);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.solicitudReposicion.findUnique.mockResolvedValue(solicitud);
  mocks.tx.solicitudReposicion.update.mockResolvedValue({ id: 100 });
  mocks.tx.producto.findUnique.mockResolvedValue({
    id: 10,
    nombre: "Kit transmisi?n",
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
  mocks.tx.notificacion.create.mockResolvedValue({ id: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  setupMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("aprobarReposicion", () => {
  it("requires productos.aprobar_reposicion permission", async () => {
    const result = await aprobarReposicion(100);

    expect(result.success).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "productos.aprobar_reposicion",
      adminSession
    );
  });

  it("approves PENDIENTE solicitud and executes financial writes", async () => {
    const result = await aprobarReposicion(100);

    expect(result.success).toBe(true);
    // Solicitud updated to APROBADA
    expect(mocks.tx.solicitudReposicion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: expect.objectContaining({
          estado: "APROBADA",
          aprobadorId: 2,
        }),
      })
    );
    // Compra created
    expect(mocks.tx.compra.create).toHaveBeenCalledOnce();
    // Product stock incremented
    expect(mocks.tx.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ cantidad: { increment: 5 } }),
      })
    );
    // MovimientoCaja created (EFECTIVO_CAJA)
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledOnce();
  });

  it("links compraId to the solicitud on success", async () => {
    await aprobarReposicion(100);

    expect(mocks.tx.solicitudReposicion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          compraId: 50,
        }),
      })
    );
  });

  it("rejects non-PENDIENTE solicitud", async () => {
    setupMocks(solicitudPendiente({ estado: "APROBADA" }));

    const result = await aprobarReposicion(100);

    expect(result.error).toBeTruthy();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
  });

  it("rejects when solicitud not found", async () => {
    setupMocks(null);

    const result = await aprobarReposicion(999);

    expect(result.error).toBeTruthy();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
  });

  it("revalidates products and solicitudes paths", async () => {
    await aprobarReposicion(100);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/solicitudes");
  });

  it("rejects for users without permission", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta acción.")
    );

    const result = await aprobarReposicion(100);

    expect(result.error).toBe("No tiene permisos para realizar esta acción.");
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
  });

  it("uses atomic increment for stock update", async () => {
    await aprobarReposicion(100);

    expect(mocks.tx.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ cantidad: { increment: 5 } }),
      })
    );
  });

  it("does NOT change Producto.proveedorId during approval", async () => {
    await aprobarReposicion(100);

    const updateCall = mocks.tx.producto.update.mock.calls[0][0];
    // Only cantidad should be in the data, never proveedorId
    expect(updateCall.data).not.toHaveProperty("proveedorId");
    expect(updateCall.data).toEqual({ cantidad: { increment: 5 } });
  });

  it("uses TRANSFERENCIA_BANCARIA when admin selects it", async () => {
    mocks.tx.cuentaFinanciera.findFirst.mockResolvedValue({
      id: 20,
      tipo: "BANCO",
      esPrincipal: true,
      activa: true,
      saldoInicial: 100_000,
      movimientos: [],
    });

    const result = await aprobarReposicion(100, "TRANSFERENCIA_BANCARIA");

    expect(result.success).toBe(true);
    // Should create MovimientoFinanciero, NOT MovimientoCaja
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
    // Compra should have TRANSFERENCIA_BANCARIA origin
    expect(mocks.tx.compra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origenPago: "TRANSFERENCIA_BANCARIA",
        }),
      })
    );
  });

  it("rejects approval when product is inactive", async () => {
    setupMocks(
      solicitudPendiente({
        producto: {
          id: 10,
          nombre: "Kit transmisión",
          precioCompra: 100,
          cantidad: 10,
          activo: false,
        },
      })
    );

    const result = await aprobarReposicion(100);

    expect(result.error).toBe("Producto inactivo.");
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
  });
});
