import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ────────────────────── Mocks ────────────────────── */

const mocks = vi.hoisted(() => {
  const models = {
    solicitudStock: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    usuario: {
      findMany: vi.fn(),
    },
    notificacion: {
      createMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  };

  return {
    models,
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
    producto: mocks.models.producto,
    solicitudStock: mocks.models.solicitudStock,
    usuario: mocks.models.usuario,
    notificacion: mocks.models.notificacion,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  crearSolicitudStock,
  aprobarSolicitudStock,
  rechazarSolicitudStock,
  getContadorNotificaciones,
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from "../../actions/solicitudes-stock";

/* ────────────────────── Helpers ────────────────────── */

const adminSession = {
  userId: 2,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: [
    "productos.solicitar_stock",
    "productos.aprobar_solicitud_stock",
  ],
};

function setupMocksForCreate() {
  mocks.getSession.mockResolvedValue(adminSession);
  mocks.requirePermission.mockResolvedValue(adminSession);
  mocks.models.producto.findUnique.mockResolvedValue({
    id: 10,
    nombre: "Filtro de aceite",
    cantidad: 20,
    activo: true,
  });
  mocks.models.solicitudStock.create.mockResolvedValue({ id: 1 });
  mocks.models.usuario.findMany.mockResolvedValue([{ id: 2 }]);
  mocks.models.notificacion.createMany.mockResolvedValue({ count: 1 });
}

function setupMocksForApprove(
  solicitudOverrides: Record<string, unknown> = {}
) {
  mocks.getSession.mockResolvedValue(adminSession);
  mocks.requirePermission.mockResolvedValue(adminSession);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.models) => Promise<unknown>) =>
      callback(mocks.models)
  );
  mocks.models.solicitudStock.findUnique.mockResolvedValue({
    id: 100,
    productoId: 10,
    tipo: "RESTA",
    cantidad: 5,
    stockAnterior: 20,
    estado: "PENDIENTE",
    solicitanteId: 3,
    producto: {
      id: 10,
      nombre: "Filtro de aceite",
      cantidad: 20,
      activo: true,
    },
    ...solicitudOverrides,
  });
  mocks.models.producto.updateMany.mockResolvedValue({ count: 1 });
  mocks.models.producto.update.mockResolvedValue({ id: 10, cantidad: 25 });
  mocks.models.solicitudStock.update.mockResolvedValue({ id: 100 });
  mocks.models.notificacion.create.mockResolvedValue({ id: 1 });
}

function setupMocksForReject() {
  mocks.getSession.mockResolvedValue(adminSession);
  mocks.requirePermission.mockResolvedValue(adminSession);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.models) => Promise<unknown>) =>
      callback(mocks.models)
  );
  mocks.models.solicitudStock.findUnique.mockResolvedValue({
    id: 100,
    productoId: 10,
    tipo: "RESTA",
    cantidad: 5,
    stockAnterior: 20,
    estado: "PENDIENTE",
    solicitanteId: 3,
    producto: {
      id: 10,
      nombre: "Filtro de aceite",
      cantidad: 20,
      activo: true,
    },
  });
  mocks.models.solicitudStock.update.mockResolvedValue({ id: 100 });
  mocks.models.notificacion.create.mockResolvedValue({ id: 1 });
}

/* ────────────────────── Tests ────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── crearSolicitudStock ────────────────────────────────────────────────

describe("crearSolicitudStock", () => {
  it("requires productos.solicitar_stock permission", async () => {
    setupMocksForCreate();
    await crearSolicitudStock("RESTA", 10, 5, "Ajuste");
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "productos.solicitar_stock"
    );
  });

  it("rejects if producto is inactive", async () => {
    setupMocksForCreate();
    mocks.models.producto.findUnique.mockResolvedValue({
      id: 10,
      nombre: "Filtro",
      cantidad: 20,
      activo: false,
    });

    const result = await crearSolicitudStock("RESTA", 10, 5, "Ajuste");
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toBe("Producto inactivo.");
  });

  it("rejects RESTA if stock insufficient", async () => {
    setupMocksForCreate();
    mocks.models.producto.findUnique.mockResolvedValue({
      id: 10,
      nombre: "Filtro",
      cantidad: 2,
      activo: true,
    });

    const result = await crearSolicitudStock("RESTA", 10, 5, "Ajuste");
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("Stock insuficiente");
  });

  it("creates solicitud and notifies admins", async () => {
    setupMocksForCreate();
    const result = await crearSolicitudStock("RESTA", 10, 5, "Ajuste");

    expect(result).toHaveProperty("success", true);
    expect(mocks.models.solicitudStock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productoId: 10,
          tipo: "RESTA",
          cantidad: 5,
          estado: "PENDIENTE",
          solicitanteId: 2,
        }),
      })
    );
    expect(mocks.models.notificacion.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            usuarioId: 2,
            tipo: "SOLICITUD_CREADA",
          }),
        ]),
      })
    );
  });

  it("allows REPOSICION even when cantidad > stock", async () => {
    setupMocksForCreate();
    mocks.models.producto.findUnique.mockResolvedValue({
      id: 10,
      nombre: "Filtro",
      cantidad: 0,
      activo: true,
    });

    const result = await crearSolicitudStock("REPOSICION", 10, 100, "Reponer");
    expect(result).toHaveProperty("success", true);
  });

  it("rejects empty motivo", async () => {
    setupMocksForCreate();
    const result = await crearSolicitudStock("RESTA", 10, 5, "");
    expect("error" in result).toBe(true);
  });

  it("rejects invalid tipo", async () => {
    setupMocksForCreate();
    const result = await crearSolicitudStock(
      "INVALID" as "RESTA",
      10,
      5,
      "Test"
    );
    expect("error" in result).toBe(true);
  });
});

// ─── aprobarSolicitudStock ─────────────────────────────────────────────

describe("aprobarSolicitudStock", () => {
  it("requires productos.aprobar_solicitud_stock permission", async () => {
    setupMocksForApprove();
    await aprobarSolicitudStock(100);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "productos.aprobar_solicitud_stock"
    );
  });

  it("approves RESTA solicitud atomically", async () => {
    setupMocksForApprove();
    const result = await aprobarSolicitudStock(100);

    expect(result).toHaveProperty("success", true);
    expect(mocks.models.producto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, cantidad: { gte: 5 } },
        data: { cantidad: { decrement: 5 } },
      })
    );
    expect(mocks.models.solicitudStock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: expect.objectContaining({ estado: "APROBADA" }),
      })
    );
    expect(mocks.models.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuarioId: 3,
          tipo: "SOLICITUD_APROBADA",
        }),
      })
    );
  });

  it("approves REPOSICION solicitud by incrementing stock", async () => {
    setupMocksForApprove({ tipo: "REPOSICION" });
    const result = await aprobarSolicitudStock(100);

    expect(result).toHaveProperty("success", true);
    expect(mocks.models.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: { cantidad: { increment: 5 } },
      })
    );
  });

  it("prevents self-approval", async () => {
    setupMocksForApprove({ solicitanteId: 2 }); // Same as adminSession.userId
    const result = await aprobarSolicitudStock(100);

    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain(
      "No puede aprobar su propia solicitud"
    );
  });

  it("rejects already-resolved solicitud", async () => {
    setupMocksForApprove({ estado: "APROBADA" });
    const result = await aprobarSolicitudStock(100);

    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("ya fue resuelta");
  });

  it("rejects RESTA when stock insufficient", async () => {
    setupMocksForApprove();
    mocks.models.producto.updateMany.mockResolvedValue({ count: 0 });
    mocks.models.producto.findUnique.mockResolvedValue({
      id: 10,
      cantidad: 2,
    });

    const result = await aprobarSolicitudStock(100);

    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("Stock insuficiente");
  });
});

// ─── rechazarSolicitudStock ────────────────────────────────────────────

describe("rechazarSolicitudStock", () => {
  it("requires productos.aprobar_solicitud_stock permission", async () => {
    setupMocksForReject();
    await rechazarSolicitudStock(100, "No aplica");
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "productos.aprobar_solicitud_stock"
    );
  });

  it("rejects with motivo and creates notification", async () => {
    setupMocksForReject();
    const result = await rechazarSolicitudStock(100, "Stock insuficiente");

    expect(result).toHaveProperty("success", true);
    expect(mocks.models.solicitudStock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: "RECHAZADA",
          observacionResolucion: "Stock insuficiente",
        }),
      })
    );
    expect(mocks.models.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: "SOLICITUD_RECHAZADA",
        }),
      })
    );
  });

  it("requires motivo", async () => {
    setupMocksForReject();
    const result = await rechazarSolicitudStock(100, "");
    expect("error" in result).toBe(true);
  });

  it("rejects already-resolved solicitud", async () => {
    setupMocksForReject();
    mocks.models.solicitudStock.findUnique.mockResolvedValue({
      id: 100,
      estado: "APROBADA",
      producto: { nombre: "Test", activo: true },
    });

    const result = await rechazarSolicitudStock(100, "Motivo");
    expect("error" in result).toBe(true);
  });
});

// ─── getContadorNotificaciones ──────────────────────────────────────────

describe("getContadorNotificaciones", () => {
  it("returns unread count for authenticated user", async () => {
    mocks.getSession.mockResolvedValue(adminSession);
    mocks.models.notificacion.count.mockResolvedValue(5);

    const result = await getContadorNotificaciones();
    expect(result).toHaveProperty("count", 5);
  });
});

// ─── getNotificaciones ─────────────────────────────────────────────────

describe("getNotificaciones", () => {
  it("returns notifications for authenticated user", async () => {
    mocks.getSession.mockResolvedValue(adminSession);
    const fakeNotis = [
      { id: 1, titulo: "Test", mensaje: "Msg", leida: false },
    ];
    mocks.models.notificacion.findMany.mockResolvedValue(fakeNotis);

    const result = await getNotificaciones();
    expect(result).toHaveProperty("notificaciones");
    expect(
      (result as { notificaciones: unknown[] }).notificaciones
    ).toHaveLength(1);
  });

  it("rejects unauthenticated user", async () => {
    mocks.getSession.mockResolvedValue(null);
    const result = await getNotificaciones();
    expect("error" in result).toBe(true);
  });
});

// ─── marcarNotificacionLeida ───────────────────────────────────────────

describe("marcarNotificacionLeida", () => {
  it("marks owned notification as read", async () => {
    mocks.getSession.mockResolvedValue(adminSession);
    mocks.models.notificacion.updateMany.mockResolvedValue({ count: 1 });

    const result = await marcarNotificacionLeida(1);
    expect(result).toHaveProperty("success", true);
  });

  it("rejects if notification not found or not owned", async () => {
    mocks.getSession.mockResolvedValue(adminSession);
    mocks.models.notificacion.updateMany.mockResolvedValue({ count: 0 });

    const result = await marcarNotificacionLeida(999);
    expect("error" in result).toBe(true);
  });
});

// ─── marcarTodasLeidas ─────────────────────────────────────────────────

describe("marcarTodasLeidas", () => {
  it("marks all unread notifications as read", async () => {
    mocks.getSession.mockResolvedValue(adminSession);
    mocks.models.notificacion.updateMany.mockResolvedValue({ count: 3 });

    const result = await marcarTodasLeidas();
    expect(result).toHaveProperty("success", true);
  });
});
