import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    producto: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    historialEstado: {
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
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { restarStock } from "../../actions/productos";

const session = {
  userId: 1,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.restar_stock"],
};

function setupMocks(options: {
  updateCount?: number;
  productoAfter?: Record<string, unknown> | null;
} = {}) {
  const { updateCount = 1, productoAfter = null } = options;
  mocks.getSession.mockResolvedValue(session);
  mocks.requirePermission.mockResolvedValue(session);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.producto.updateMany.mockResolvedValue({ count: updateCount });
  mocks.tx.producto.findUnique.mockResolvedValue(
    productoAfter ?? {
      id: 10,
      nombre: "Kit transmisión",
      cantidad: 7,
      activo: true,
    }
  );
  mocks.tx.historialEstado.create.mockResolvedValue({ id: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  setupMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("restarStock", () => {
  it("requires productos.restar_stock permission", async () => {
    const result = await restarStock(10, 3, "Venta");

    expect(result.success).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("productos.restar_stock", session);
  });

  it("rejects NaN cantidad", async () => {
    await expect(restarStock(10, NaN, "Venta")).rejects.toThrow(
      "La cantidad debe ser un número entero válido."
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects float cantidad", async () => {
    await expect(restarStock(10, 3.5, "Venta")).rejects.toThrow(
      "La cantidad debe ser un número entero válido."
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects non-integer productoId", async () => {
    await expect(restarStock(1.5, 3, "Venta")).rejects.toThrow(
      "El ID del producto debe ser un número entero válido."
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects inactive product", async () => {
    mocks.tx.producto.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.producto.findUnique.mockResolvedValue({
      id: 10,
      nombre: "Kit transmisión",
      cantidad: 10,
      activo: false,
    });

    const result = await restarStock(10, 3, "Venta");

    expect(result.error).toBe("Producto inactivo.");
    expect(mocks.tx.historialEstado.create).not.toHaveBeenCalled();
  });

  it("rejects insufficient stock", async () => {
    mocks.tx.producto.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.producto.findUnique.mockResolvedValue({
      id: 10,
      nombre: "Kit transmisión",
      cantidad: 2,
      activo: true,
    });

    const result = await restarStock(10, 5, "Venta");

    expect(result.error).toBe("Stock insuficiente. Stock actual: 2 unidades.");
    expect(mocks.tx.historialEstado.create).not.toHaveBeenCalled();
  });

  it("decrements stock atomically and registers historial", async () => {
    mocks.tx.producto.findUnique.mockResolvedValue({
      id: 10,
      nombre: "Kit transmisión",
      cantidad: 7,
      activo: true,
    });

    const result = await restarStock(10, 3, "Venta", "Cliente 42");

    expect(result.success).toBe(true);
    expect(result.stockAnterior).toBe(10);
    expect(result.stockNuevo).toBe(7);
    // Uses atomic decrement, not read-modify-write
    expect(mocks.tx.producto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, cantidad: { gte: 3 } },
        data: { cantidad: { decrement: 3 } },
      })
    );
    expect(mocks.tx.historialEstado.create).toHaveBeenCalledOnce();
  });

  it("revalidates /productos after success", async () => {
    await restarStock(10, 3, "Venta");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
  });
});
