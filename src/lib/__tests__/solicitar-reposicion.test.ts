import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    producto: {
      findUnique: vi.fn(),
    },
    solicitudReposicion: {
      create: vi.fn(),
    },
    caja: {
      findFirst: vi.fn(),
    },
    movimientoCaja: {
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
    producto: {
      findUnique: mocks.tx.producto.findUnique,
    },
    solicitudReposicion: {
      create: mocks.tx.solicitudReposicion.create,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { solicitarReposicion } from "../../actions/reposiciones";

const session = {
  userId: 1,
  username: "encargado_stock",
  role: "ENCARGADO_STOCK",
  permissions: ["productos.reponer"],
};

function productoActivo(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    nombre: "Kit transmisi?n",
    marca: "Honda",
    precioCompra: 100,
    precioVenta: 150,
    cantidad: 10,
    activo: true,
    proveedorId: 3,
    ...overrides,
  };
}

function setupMocks(producto: Record<string, unknown> | null = productoActivo()) {
  mocks.getSession.mockResolvedValue(session);
  mocks.requirePermission.mockResolvedValue(session);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.producto.findUnique.mockResolvedValue(producto);
  mocks.tx.solicitudReposicion.create.mockResolvedValue({
    id: 100,
    estado: "PENDIENTE",
  });
  mocks.tx.caja.findFirst.mockResolvedValue(null);
  mocks.tx.movimientoCaja.create.mockResolvedValue({ id: 70 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  setupMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("solicitarReposicion", () => {
  it("requires productos.reponer permission", async () => {
    const result = await solicitarReposicion(10, {
      cantidad: 2,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(result.success).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("productos.reponer", session);
  });

  it("creates a PENDIENTE solicitud with snapshots and zero financial writes", async () => {
    const result = await solicitarReposicion(10, {
      cantidad: 5,
      proveedorId: 3,
      origenPago: "TRANSFERENCIA_BANCARIA",
      motivo: "Falta de stock",
    });

    expect(result.success).toBe(true);
    expect(mocks.tx.solicitudReposicion.create).toHaveBeenCalledOnce();
    expect(mocks.tx.solicitudReposicion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productoId: 10,
          cantidad: 5,
          costoUnitario: 100,
          total: 500,
          proveedorId: 3,
          origenPago: "TRANSFERENCIA_BANCARIA",
          estado: "PENDIENTE",
          solicitanteId: 1,
          motivo: "Falta de stock",
        }),
      })
    );
    // Cero writes financieros
    expect(mocks.tx.caja.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
  });

  it("saves pagos distribution as JSON", async () => {
    const pagos = [
      { medio: "EFECTIVO_CAJA" as const, monto: 200 },
      { medio: "TRANSFERENCIA_BANCARIA" as const, monto: 300 },
    ];

    const result = await solicitarReposicion(10, {
      cantidad: 5,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
      pagos,
    });

    expect(result.success).toBe(true);
    expect(mocks.tx.solicitudReposicion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pagos,
        }),
      })
    );
  });

  it("rejects cantidad <= 0", async () => {
    const result = await solicitarReposicion(10, {
      cantidad: 0,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(result.error).toBeTruthy();
    expect(mocks.tx.solicitudReposicion.create).not.toHaveBeenCalled();
  });

  it("rejects inactive product", async () => {
    setupMocks(productoActivo({ activo: false }));

    const result = await solicitarReposicion(10, {
      cantidad: 2,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(result.error).toBeTruthy();
    expect(mocks.tx.solicitudReposicion.create).not.toHaveBeenCalled();
  });

  it("rejects when product not found", async () => {
    setupMocks(null);

    const result = await solicitarReposicion(999, {
      cantidad: 2,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(result.error).toBeTruthy();
    expect(mocks.tx.solicitudReposicion.create).not.toHaveBeenCalled();
  });

  it("revalidates /solicitudes after success", async () => {
    await solicitarReposicion(10, {
      cantidad: 2,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/solicitudes");
  });

  it("returns error for users without productos.reponer", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta acci?n.")
    );

    const result = await solicitarReposicion(10, {
      cantidad: 2,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(result.error).toBe("No tiene permisos para realizar esta acci?n.");
    expect(mocks.tx.solicitudReposicion.create).not.toHaveBeenCalled();
  });

  it("uses precioCompra as costoUnitario snapshot", async () => {
    setupMocks(productoActivo({ precioCompra: 550 }));

    await solicitarReposicion(10, {
      cantidad: 3,
      proveedorId: 3,
      origenPago: "EFECTIVO_CAJA",
    });

    expect(mocks.tx.solicitudReposicion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          costoUnitario: 550,
          total: 1650,
        }),
      })
    );
  });
});
