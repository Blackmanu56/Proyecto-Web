import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    findMany: vi.fn(),
    count: vi.fn(),
    getSession: vi.fn(),
    requirePermission: vi.fn(),
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
    solicitudReposicion: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

import { getSolicitudesReposicion } from "../../actions/reposiciones";

const adminSession = {
  userId: 2,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.aprobar_reposicion"],
};

function setupMocks() {
  mocks.getSession.mockResolvedValue(adminSession);
  mocks.requirePermission.mockResolvedValue(adminSession);
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSolicitudesReposicion", () => {
  it("requires productos.aprobar_reposicion permission", async () => {
    await getSolicitudesReposicion();

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "productos.aprobar_reposicion",
      adminSession
    );
  });

  it("returns solicitudes with includes ordered by createdAt desc", async () => {
    const solicitudes = [
      { id: 2, createdAt: new Date("2026-08-16") },
      { id: 1, createdAt: new Date("2026-08-15") },
    ];
    mocks.findMany.mockResolvedValue(solicitudes);

    const result = await getSolicitudesReposicion();

    expect(result.success).toBe(true);
    expect(result.solicitudes).toEqual(solicitudes);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        include: expect.objectContaining({
          producto: true,
          proveedor: true,
          solicitante: true,
          aprobador: true,
          compra: true,
        }),
      })
    );
  });

  it("filters by estado when provided", async () => {
    await getSolicitudesReposicion({ estado: "PENDIENTE" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: "PENDIENTE" }),
      })
    );
  });

  it("filters by productoId when provided", async () => {
    await getSolicitudesReposicion({ productoId: 10 });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productoId: 10 }),
      })
    );
  });

  it("rejects for users without permission", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta acci?n.")
    );

    const result = await getSolicitudesReposicion();

    expect(result.error).toBe("No tiene permisos para realizar esta acci?n.");
  });
});
