import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    solicitudStock: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    movimientoProducto: {
      create: vi.fn(),
    },
    notificacion: {
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
    compra: {
      create: vi.fn(),
    },
    pagoCompra: {
      create: vi.fn(),
    },
  };

  return {
    tx,
    getSession: vi.fn(),
    requirePermission: vi.fn(),
    transaction: vi.fn(),
    revalidatePath: vi.fn(),
    registrarMovimiento: vi.fn(),
    evaluarYNotificarStock: vi.fn(),
    preferenciaNotificacion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    // Direct prisma model mocks (cancelarSolicitudStock does NOT use $transaction)
    solicitudStock: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
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
    solicitudStock: mocks.solicitudStock,
    preferenciaNotificacion: mocks.preferenciaNotificacion,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/movimiento-producto", () => ({
  registrarMovimiento: mocks.registrarMovimiento,
}));

vi.mock("@/lib/stock-notifications", () => ({
  evaluarYNotificarStock: mocks.evaluarYNotificarStock,
}));

import {
  cancelarSolicitudStock,
  aprobarSolicitudStock,
} from "../../actions/solicitudes-stock";

// ─── Sessions ──────────────────────────────────────────────────────────────

const ownerSession = {
  userId: 1,
  username: "encargado",
  role: "ENCARGADO",
  permissions: ["productos.solicitar_stock"],
};

const adminSession = {
  userId: 2,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: [
    "productos.solicitar_stock",
    "productos.aprobar_solicitud_stock",
  ],
};

// ─── Factories ─────────────────────────────────────────────────────────────

function solicitudPendiente(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    productoId: 10,
    tipo: "RESTA",
    cantidad: 5,
    stockAnterior: 10,
    motivo: "Falta stock para venta",
    estado: "PENDIENTE",
    solicitanteId: 1,
    resueltoPorId: null,
    observacionResolucion: null,
    resolvedAt: null,
    producto: {
      id: 10,
      nombre: "Kit transmision",
      cantidad: 10,
      activo: true,
    },
    ...overrides,
  };
}

// ─── Setup helpers ─────────────────────────────────────────────────────────

function setupMocks(solicitud: Record<string, unknown> | null = solicitudPendiente()) {
  mocks.getSession.mockResolvedValue(ownerSession);
  mocks.requirePermission.mockResolvedValue(ownerSession);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  // Direct prisma model mocks (for cancelarSolicitudStock — no $transaction)
  mocks.solicitudStock.findUnique.mockResolvedValue(solicitud);
  mocks.solicitudStock.update.mockResolvedValue({ id: 100 });
  // Transaction client mocks (for aprobarSolicitudStock — inside $transaction)
  mocks.tx.solicitudStock.findUnique.mockResolvedValue(solicitud);
  mocks.tx.solicitudStock.update.mockResolvedValue({ id: 100 });
  mocks.tx.producto.findUnique.mockResolvedValue({
    id: 10,
    nombre: "Kit transmision",
    cantidad: 10,
    activo: true,
  });
  mocks.tx.producto.update.mockResolvedValue({ id: 10, cantidad: 5 });
  mocks.tx.producto.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.movimientoProducto.create.mockResolvedValue({ id: 1 });
  mocks.tx.notificacion.create.mockResolvedValue({ id: 1 });
  mocks.tx.caja.findFirst.mockResolvedValue({
    id: 1,
    estado: "ABIERTA",
    movimientos: [{ tipo: "INGRESO", monto: 50000 }],
  });
  mocks.tx.caja.update.mockResolvedValue({ id: 1 });
  mocks.tx.cuentaFinanciera.findFirst.mockResolvedValue({
    id: 1,
    tipo: "BANCO",
    esPrincipal: true,
    activa: true,
    saldoInicial: 100000,
    movimientos: [],
  });
  mocks.tx.movimientoCaja.create.mockResolvedValue({ id: 1 });
  mocks.tx.movimientoFinanciero.create.mockResolvedValue({ id: 1 });
  mocks.tx.compra.create.mockResolvedValue({ id: 1 });
  mocks.tx.pagoCompra.create.mockResolvedValue({ id: 1 });
  mocks.registrarMovimiento.mockResolvedValue(undefined);
  mocks.evaluarYNotificarStock.mockResolvedValue(undefined);
  mocks.preferenciaNotificacion.findUnique.mockResolvedValue(null);
  mocks.preferenciaNotificacion.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  setupMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── cancelarSolicitudStock ────────────────────────────────────────────────

describe("cancelarSolicitudStock", () => {
  it("requires productos.solicitar_stock permission", async () => {
    await cancelarSolicitudStock(100);

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "productos.solicitar_stock"
    );
  });

  it("allows owner to cancel own pending solicitud", async () => {
    const result = await cancelarSolicitudStock(100);

    expect(result.success).toBe(true);
    expect(mocks.solicitudStock.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: {
        estado: "CANCELADA",
        resueltoPorId: 1,
        observacionResolucion: "Cancelada por el solicitante",
        resolvedAt: expect.any(Date),
      },
    });
  });

  it("allows owner to cancel with custom motivo", async () => {
    const result = await cancelarSolicitudStock(100, "Ya no lo necesito");

    expect(result.success).toBe(true);
    expect(mocks.solicitudStock.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: expect.objectContaining({
        observacionResolucion: "Ya no lo necesito",
      }),
    });
  });

  it("rejects cancellation of another user's solicitud", async () => {
    setupMocks(solicitudPendiente({ solicitanteId: 99 }));

    const result = await cancelarSolicitudStock(100);

    expect(result.error).toBe(
      "No tiene permisos para cancelar esta solicitud."
    );
    expect(mocks.solicitudStock.update).not.toHaveBeenCalled();
  });

  it("rejects cancellation of a non-PENDIENTE solicitud", async () => {
    setupMocks(solicitudPendiente({ estado: "APROBADA" }));

    const result = await cancelarSolicitudStock(100);

    expect(result.error).toBe("Solo se pueden cancelar solicitudes pendientes.");
    expect(mocks.solicitudStock.update).not.toHaveBeenCalled();
  });

  it("rejects cancellation of a RECHAZADA solicitud", async () => {
    setupMocks(solicitudPendiente({ estado: "RECHAZADA" }));

    const result = await cancelarSolicitudStock(100);

    expect(result.error).toBe("Solo se pueden cancelar solicitudes pendientes.");
    expect(mocks.solicitudStock.update).not.toHaveBeenCalled();
  });

  it("rejects cancellation of a CANCELADA solicitud", async () => {
    setupMocks(solicitudPendiente({ estado: "CANCELADA" }));

    const result = await cancelarSolicitudStock(100);

    expect(result.error).toBe("Solo se pueden cancelar solicitudes pendientes.");
    expect(mocks.solicitudStock.update).not.toHaveBeenCalled();
  });

  it("does NOT modify stock when cancelling", async () => {
    await cancelarSolicitudStock(100);

    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
    expect(mocks.tx.producto.updateMany).not.toHaveBeenCalled();
  });

  it("does NOT call registrarMovimiento when cancelling", async () => {
    await cancelarSolicitudStock(100);

    expect(mocks.registrarMovimiento).not.toHaveBeenCalled();
  });

  it("returns error when solicitud not found", async () => {
    setupMocks(null);

    const result = await cancelarSolicitudStock(999);

    expect(result.error).toBe("Solicitud no encontrada.");
    expect(mocks.solicitudStock.update).not.toHaveBeenCalled();
  });

  it("rejects invalid solicitud ID", async () => {
    const result = await cancelarSolicitudStock(-1);

    expect(result.error).toBe(
      "El ID de la solicitud debe ser un n\u00famero entero v\u00e1lido."
    );
  });

  it("revalidates paths after successful cancellation", async () => {
    await cancelarSolicitudStock(100);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pedidos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
  });

  it("rejects for users without permission", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta accion.")
    );

    const result = await cancelarSolicitudStock(100);

    expect(result.error).toBe(
      "No tiene permisos para realizar esta accion."
    );
    expect(mocks.tx.solicitudStock.update).not.toHaveBeenCalled();
  });
});

// ─── aprobarSolicitudStock ─────────────────────────────────────────────────

describe("aprobarSolicitudStock", () => {
  it("requires productos.aprobar_solicitud_stock permission", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);

    await aprobarSolicitudStock(100);

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "productos.aprobar_solicitud_stock"
    );
  });

  it("approves RESTA solicitud and decrements stock", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);

    const result = await aprobarSolicitudStock(100);

    expect(result.success).toBe(true);
    // Solicitud updated to APROBADA
    expect(mocks.tx.solicitudStock.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: expect.objectContaining({
        estado: "APROBADA",
        resueltoPorId: 2,
      }),
    });
    // Stock decremented via updateMany (atomic)
    expect(mocks.tx.producto.updateMany).toHaveBeenCalledWith({
      where: { id: 10, cantidad: { gte: 5 } },
      data: { cantidad: { decrement: 5 } },
    });
  });

  it("approves REPOSICION solicitud and increments stock", async () => {
    setupMocks(solicitudPendiente({ tipo: "REPOSICION" }));
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);

    const result = await aprobarSolicitudStock(100);

    expect(result.success).toBe(true);
    expect(mocks.tx.producto.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { cantidad: { increment: 5 } },
    });
  });

  it("registers cash egress in Caja when approving REPOSICION with EFECTIVO", async () => {
    setupMocks(
      solicitudPendiente({
        tipo: "REPOSICION",
        cantidad: 4,
        producto: {
          id: 10,
          nombre: "Kit transmision",
          cantidad: 10,
          precioCompra: 2500,
          activo: true,
        },
      })
    );
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);

    const result = await aprobarSolicitudStock(100, "EFECTIVO");

    expect(result.success).toBe(true);
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cajaId: 1,
        usuarioId: 1,
        tipo: "EGRESO",
        monto: 10000,
        descripcion: "Reposición de stock: Kit transmision (4 u.)",
      }),
    });
    expect(mocks.tx.caja.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { gastosManuales: { increment: 10000 } },
    });
  });

  it("registers bank egress in Banco when approving REPOSICION with BANCO", async () => {
    setupMocks(
      solicitudPendiente({
        tipo: "REPOSICION",
        cantidad: 2,
        producto: {
          id: 10,
          nombre: "Kit transmision",
          cantidad: 10,
          precioCompra: 3000,
          activo: true,
        },
      })
    );
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);

    const result = await aprobarSolicitudStock(100, "BANCO");

    expect(result.success).toBe(true);
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cuentaFinancieraId: 1,
        usuarioId: 1,
        tipo: "EGRESO",
        monto: 6000,
        descripcion: "Reposición de stock: Kit transmision (2 u.)",
      }),
    });
  });

  it("creates MovimientoProducto with correct args for RESTA", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);

    await aprobarSolicitudStock(100, "Observacion admin");

    expect(mocks.registrarMovimiento).toHaveBeenCalledWith(
      mocks.tx,
      {
        productoId: 10,
        tipo: "SOLICITUD_RESTA_APROBADA",
        cantidadAnterior: 10,
        cantidadNueva: 5,
        motivo: "Solicitud de resta #100 aprobada",
        observacion: "Observacion admin",
        usuarioId: 1,
      }
    );
  });

  it("creates MovimientoProducto with correct args for REPOSICION", async () => {
    setupMocks(solicitudPendiente({ tipo: "REPOSICION" }));
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);

    await aprobarSolicitudStock(100);

    expect(mocks.registrarMovimiento).toHaveBeenCalledWith(
      mocks.tx,
      {
        productoId: 10,
        tipo: "REPOSICION_APROBADA",
        cantidadAnterior: 10,
        cantidadNueva: 15,
        motivo: "Solicitud de reposici\u00f3n #100 aprobada",
        observacion: undefined,
        usuarioId: 1,
      }
    );
  });

  it("does not call registrarMovimiento when permission check fails", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta accion.")
    );

    await aprobarSolicitudStock(100);

    expect(mocks.registrarMovimiento).not.toHaveBeenCalled();
  });

  it("rejects approval of non-PENDIENTE solicitud", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);
    setupMocks(solicitudPendiente({ estado: "APROBADA" }));

    const result = await aprobarSolicitudStock(100);

    expect(result.error).toBe("La solicitud ya fue resuelta.");
    expect(mocks.registrarMovimiento).not.toHaveBeenCalled();
    expect(mocks.tx.solicitudStock.update).not.toHaveBeenCalled();
  });

  it("rejects approval when solicitud not found", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);
    setupMocks(null);

    const result = await aprobarSolicitudStock(999);

    expect(result.error).toBe("Solicitud no encontrada.");
    expect(mocks.registrarMovimiento).not.toHaveBeenCalled();
  });

  it("rejects self-approval", async () => {
    // ownerSession (userId=1) is the solicitante
    mocks.requirePermission.mockResolvedValue(ownerSession);
    mocks.getSession.mockResolvedValue(ownerSession);

    const result = await aprobarSolicitudStock(100);

    expect(result.error).toBe("No puede aprobar su propia solicitud.");
    expect(mocks.registrarMovimiento).not.toHaveBeenCalled();
  });

  it("rejects approval when product is inactive", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);
    setupMocks(
      solicitudPendiente({
        producto: { id: 10, nombre: "Kit", cantidad: 10, activo: false },
      })
    );

    const result = await aprobarSolicitudStock(100);

    expect(result.error).toBe("Producto inactivo.");
    expect(mocks.registrarMovimiento).not.toHaveBeenCalled();
  });

  it("rejects RESTA when stock is insufficient", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);
    // updateMany returns count=0 when stock < cantidad
    mocks.tx.producto.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.producto.findUnique.mockResolvedValue({
      id: 10,
      cantidad: 2,
    });

    const result = await aprobarSolicitudStock(100);

    expect(result.error).toBe(
      "Stock insuficiente. Stock actual: 2 unidades."
    );
  });

  it("revalidates paths after successful approval", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);

    await aprobarSolicitudStock(100);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/solicitudes-stock");
  });

  it("calls evaluarYNotificarStock after approval", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);

    await aprobarSolicitudStock(100);

    expect(mocks.evaluarYNotificarStock).toHaveBeenCalledWith({
      productoId: 10,
      cantidadAnterior: 10,
      cantidadNueva: 5,
      usuarioId: 1,
      usuarioNombre: "admin",
      tipoMovimiento: "SOLICITUD_RESTA_APROBADA",
      motivo: "Solicitud de resta aprobada",
    });
  });

  it("rejects invalid solicitud ID", async () => {
    const result = await aprobarSolicitudStock(0);

    expect(result.error).toBe(
      "El ID de la solicitud debe ser un n\u00famero entero v\u00e1lido."
    );
  });

  it("rejects for users without permission", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("No tiene permisos para realizar esta accion.")
    );

    const result = await aprobarSolicitudStock(100);

    expect(result.error).toBe(
      "No tiene permisos para realizar esta accion."
    );
    expect(mocks.registrarMovimiento).not.toHaveBeenCalled();
  });
});
