import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getSession: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/auth.server", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    movimientoProducto: {
      findMany: mocks.findMany,
    },
  },
}));

import { getMovimientosProducto } from "../../actions/productos";

const session = {
  userId: 1,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.historial"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue(session);
  mocks.requirePermission.mockResolvedValue(session);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getMovimientosProducto", () => {
  it("requires productos.historial permission", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getMovimientosProducto(10);

    expect(mocks.requirePermission).toHaveBeenCalledWith("productos.historial", session);
  });

  it("returns movements ordered by createdAt desc", async () => {
    const mockMovimientos = [
      { id: 2, tipo: "VENTA", createdAt: new Date("2026-01-02"), usuario: { id: 1, username: "admin", nombreCompleto: "Admin" } },
      { id: 1, tipo: "COMPRA", createdAt: new Date("2026-01-01"), usuario: { id: 1, username: "admin", nombreCompleto: "Admin" } },
    ];
    mocks.findMany.mockResolvedValue(mockMovimientos);

    const result = await getMovimientosProducto(10);

    expect(result).toEqual(mockMovimientos);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { productoId: 10 },
      include: {
        usuario: {
          select: { id: true, username: true, nombreCompleto: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns [] on error", async () => {
    mocks.findMany.mockRejectedValue(new Error("DB connection failed"));

    const result = await getMovimientosProducto(10);

    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "Error en getMovimientosProducto:",
      expect.any(Error)
    );
  });
});
