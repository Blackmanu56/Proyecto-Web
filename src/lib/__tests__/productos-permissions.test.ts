import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    producto: {
      findMany: vi.fn(),
    },
    historialEstado: {
      findMany: vi.fn(),
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
    producto: {
      findMany: mocks.tx.producto.findMany,
    },
    historialEstado: {
      findMany: mocks.tx.historialEstado.findMany,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { getProductos, getHistorialEstado } from "../../actions/productos";

const session = {
  userId: 1,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.ver"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue(session);
  mocks.requirePermission.mockResolvedValue(session);
  mocks.tx.producto.findMany.mockResolvedValue([
    { id: 1, nombre: "Filtro de aceite", cantidad: 10 },
  ]);
  mocks.tx.historialEstado.findMany.mockResolvedValue([
    { id: 1, estadoAnterior: "ACTIVO", estadoNuevo: "INACTIVO" },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getProductos permission gate", () => {
  it("returns data when user has productos.ver", async () => {
    const result = await getProductos();

    expect(result).toHaveLength(1);
    expect(mocks.requirePermission).toHaveBeenCalledWith("productos.ver", session);
  });

  it("throws when user lacks productos.ver", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta acción.")
    );

    await expect(getProductos()).rejects.toThrow("No tiene permisos para realizar esta acción.");
  });
});

describe("getHistorialEstado permission gate", () => {
  it("returns data when user has productos.historial", async () => {
    mocks.requirePermission.mockResolvedValue({ ...session, permissions: ["productos.historial"] });

    const result = await getHistorialEstado(10);

    expect(result).toHaveLength(1);
    expect(mocks.requirePermission).toHaveBeenCalledWith("productos.historial", session);
  });

  it("throws when user lacks productos.historial", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta acción.")
    );

    await expect(getHistorialEstado(10)).rejects.toThrow(
      "No tiene permisos para realizar esta acción."
    );
  });
});
