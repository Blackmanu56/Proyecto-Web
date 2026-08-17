import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    solicitudReposicion: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

import { rechazarReposicion } from "../../actions/reposiciones";

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
    estado: "PENDIENTE",
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
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  setupMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rechazarReposicion", () => {
  it("requires productos.aprobar_reposicion permission", async () => {
    const result = await rechazarReposicion(100, "Fondos insuficientes");

    expect(result.success).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "productos.aprobar_reposicion",
      adminSession
    );
  });

  it("rejects PENDIENTE solicitud with respuesta and resueltoEn", async () => {
    const result = await rechazarReposicion(100, "Fondos insuficientes");

    expect(result.success).toBe(true);
    expect(mocks.tx.solicitudReposicion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: expect.objectContaining({
          estado: "RECHAZADA",
          respuesta: "Fondos insuficientes",
          resueltoEn: expect.any(Date),
        }),
      })
    );
  });

  it("revalidates /solicitudes after success", async () => {
    await rechazarReposicion(100, "No aplica");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/solicitudes");
  });

  it("rejects non-PENDIENTE solicitud", async () => {
    setupMocks(solicitudPendiente({ estado: "RECHAZADA" }));

    const result = await rechazarReposicion(100, "Ya rechazada");

    expect(result.error).toBeTruthy();
    expect(mocks.tx.solicitudReposicion.update).not.toHaveBeenCalled();
  });

  it("rejects when solicitud not found", async () => {
    setupMocks(null);

    const result = await rechazarReposicion(999, "Motivo");

    expect(result.error).toBeTruthy();
    expect(mocks.tx.solicitudReposicion.update).not.toHaveBeenCalled();
  });

  it("rejects for users without permission", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta acción.")
    );

    const result = await rechazarReposicion(100, "Motivo");

    expect(result.error).toBe("No tiene permisos para realizar esta acción.");
    expect(mocks.tx.solicitudReposicion.update).not.toHaveBeenCalled();
  });
});
