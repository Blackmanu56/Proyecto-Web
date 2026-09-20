import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  producto: { findUnique: vi.fn(), findMany: vi.fn() },
  rol: { findMany: vi.fn() },
  usuario: { findMany: vi.fn() },
  preferenciaNotificacion: { findMany: vi.fn() },
  notificacion: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    producto: mocks.producto,
    rol: mocks.rol,
    usuario: mocks.usuario,
    preferenciaNotificacion: mocks.preferenciaNotificacion,
    notificacion: mocks.notificacion,
  },
}));

import { evaluarYNotificarStock, verificarStockActual } from "@/lib/stock-notifications";

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLES = [
  { id: 1, nombre: "ADMINISTRADOR" },
  { id: 2, nombre: "ENCARGADO_STOCK" },
];

const ADMIN_USERS = [{ id: 10 }];
const ENCARGADO_USERS = [{ id: 20 }];

const PRODUCT_BASE = {
  id: 5,
  nombre: "Filtro de aceite",
  stockMinimo: 5,
  activo: true,
};

// ─── Default params ─────────────────────────────────────────────────────────

function defaultParams(overrides: Record<string, unknown> = {}) {
  return {
    productoId: 5,
    cantidadAnterior: 10,
    cantidadNueva: 3,
    usuarioId: 30,
    usuarioNombre: "Pedro",
    tipoMovimiento: "VENTA",
    motivo: "Venta realizada",
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

function setupPrismaMocks(
  productOverrides: Record<string, unknown> = {},
  options: {
    preferencias?: Array<{ usuarioId: number; tipo: string; habilitada: boolean }>;
    activeProducts?: Array<{ id: number; cantidad: number; stockMinimo: number; activo?: boolean }>;
    existingUnread?: any;
  } = {}
) {
  mocks.producto.findUnique.mockResolvedValue({ ...PRODUCT_BASE, ...productOverrides });
  mocks.producto.findMany.mockResolvedValue(
    options.activeProducts ?? [{ id: 5, cantidad: 3, stockMinimo: 5, activo: true }]
  );
  mocks.rol.findMany.mockResolvedValue(ROLES);
  mocks.usuario.findMany.mockImplementation(async (args: { where: { rolId: number } }) => {
    if (args.where.rolId === 1) return ADMIN_USERS;
    if (args.where.rolId === 2) return ENCARGADO_USERS;
    return [];
  });
  mocks.preferenciaNotificacion.findMany.mockResolvedValue(options.preferencias ?? []);
  mocks.notificacion.create.mockResolvedValue({ id: 1 });
  mocks.notificacion.createMany.mockResolvedValue({ count: 0 });
  mocks.notificacion.findFirst.mockImplementation(async (args: any) => {
    if (typeof options.existingUnread === "function") {
      return options.existingUnread(args);
    }
    return options.existingUnread ?? null;
  });
  mocks.notificacion.findMany.mockResolvedValue([]);
  mocks.notificacion.update.mockResolvedValue({ id: 1 });
  mocks.notificacion.deleteMany.mockResolvedValue({ count: 1 });
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  setupPrismaMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("evaluarYNotificarStock (Grouped notifications)", () => {
  it("creates grouped STOCK_CRITICO for ADMINISTRADOR and ENCARGADO_STOCK when crossing below stockMinimo", async () => {
    // 1 critical product (id 5, cantidad 3, min 5)
    setupPrismaMocks({}, {
      activeProducts: [{ id: 5, cantidad: 3, stockMinimo: 5 }],
    });

    await evaluarYNotificarStock(defaultParams({ cantidadAnterior: 10, cantidadNueva: 3 }));

    // Verify create was called for admin (10) and encargado (20) with grouped format
    const createCalls = mocks.notificacion.create.mock.calls.map((c) => c[0].data);
    const criticoAdmin = createCalls.find((n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 10);
    const criticoEncargado = createCalls.find((n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 20);

    expect(criticoAdmin).toBeDefined();
    expect(criticoAdmin.titulo).toBe("⚠ Stock crítico");
    expect(criticoAdmin.mensaje).toBe("Se detectaron 1 productos con stock crítico");
    expect(criticoAdmin.productoId).toBeNull();

    expect(criticoEncargado).toBeDefined();
    expect(criticoEncargado.mensaje).toBe("Se detectaron 1 productos con stock crítico");
  });

  it("updates counter on existing unread grouped notification when new product enters critical state", async () => {
    // 7 products are now critical, existing unread has id 99
    setupPrismaMocks({}, {
      activeProducts: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, cantidad: 2, stockMinimo: 5 })),
      existingUnread: (args: any) => {
        if (args?.where?.tipo === "STOCK_CRITICO" && !args?.where?.leida) {
          return { id: 99, tipo: "STOCK_CRITICO", usuarioId: args.where.usuarioId, mensaje: "Se detectaron 6 productos con stock crítico" };
        }
        return null;
      },
    });

    await evaluarYNotificarStock(defaultParams({ cantidadAnterior: 10, cantidadNueva: 3 }));

    // Should update existing notification 99 to 7 products
    expect(mocks.notificacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 99 },
        data: expect.objectContaining({
          mensaje: "Se detectaron 7 productos con stock crítico",
        }),
      })
    );
  });

  it("creates grouped STOCK_AGOTADO for ADMINISTRADOR and ENCARGADO_STOCK when product hits zero", async () => {
    setupPrismaMocks({}, {
      activeProducts: [{ id: 5, cantidad: 0, stockMinimo: 5 }],
    });

    await evaluarYNotificarStock(defaultParams({ cantidadAnterior: 10, cantidadNueva: 0 }));

    const createCalls = mocks.notificacion.create.mock.calls.map((c) => c[0].data);
    const agotadoAdmin = createCalls.find((n) => n.tipo === "STOCK_AGOTADO" && n.usuarioId === 10);
    const agotadoEncargado = createCalls.find((n) => n.tipo === "STOCK_AGOTADO" && n.usuarioId === 20);

    expect(agotadoAdmin).toBeDefined();
    expect(agotadoAdmin.titulo).toBe("🔴 Stock agotado");
    expect(agotadoAdmin.mensaje).toBe("Se detectaron 1 productos sin stock");
    expect(agotadoAdmin.productoId).toBeNull();

    expect(agotadoEncargado).toBeDefined();
    expect(agotadoEncargado.mensaje).toBe("Se detectaron 1 productos sin stock");
  });

  it("removes/resolves unread notification when count drops to 0", async () => {
    // 0 critical products (all replenished)
    setupPrismaMocks({}, {
      activeProducts: [{ id: 5, cantidad: 20, stockMinimo: 5 }],
    });

    await evaluarYNotificarStock(defaultParams({ cantidadAnterior: 3, cantidadNueva: 20 }));

    // Should delete/clean up unread critical notifications
    expect(mocks.notificacion.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipo: "STOCK_CRITICO",
          leida: false,
        }),
      })
    );
  });

  it("handles STOCK_CRITICO and STOCK_AGOTADO independently", async () => {
    // 3 critical products and 2 empty products
    setupPrismaMocks({}, {
      activeProducts: [
        { id: 1, cantidad: 2, stockMinimo: 5 },
        { id: 2, cantidad: 3, stockMinimo: 5 },
        { id: 3, cantidad: 1, stockMinimo: 5 },
        { id: 4, cantidad: 0, stockMinimo: 5 },
        { id: 5, cantidad: 0, stockMinimo: 5 },
      ],
    });

    await evaluarYNotificarStock(defaultParams({ cantidadAnterior: 10, cantidadNueva: 0 }));

    const createCalls = mocks.notificacion.create.mock.calls.map((c) => c[0].data);
    const criticoAdmin = createCalls.find((n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 10);
    const agotadoAdmin = createCalls.find((n) => n.tipo === "STOCK_AGOTADO" && n.usuarioId === 10);

    expect(criticoAdmin).toBeDefined();
    expect(criticoAdmin.mensaje).toBe("Se detectaron 3 productos con stock crítico");

    expect(agotadoAdmin).toBeDefined();
    expect(agotadoAdmin.mensaje).toBe("Se detectaron 2 productos sin stock");
  });

  it("sends individual STOCK_RESTADO only to the movement user", async () => {
    await evaluarYNotificarStock(defaultParams());

    const createCalls = mocks.notificacion.create.mock.calls.map((c) => c[0].data);
    const restado = createCalls.find((n) => n.tipo === "STOCK_RESTADO");

    expect(restado).toBeDefined();
    expect(restado.usuarioId).toBe(30);
    expect(restado.mensaje).toContain("Pedro restó 7 unidades");
  });

  it("sends individual STOCK_RECARGADO only to the movement user", async () => {
    setupPrismaMocks({}, {
      activeProducts: [{ id: 5, cantidad: 15, stockMinimo: 5 }],
    });

    await evaluarYNotificarStock(defaultParams({ cantidadAnterior: 5, cantidadNueva: 15 }));

    const createCalls = mocks.notificacion.create.mock.calls.map((c) => c[0].data);
    const recargado = createCalls.find((n) => n.tipo === "STOCK_RECARGADO");

    expect(recargado).toBeDefined();
    expect(recargado.usuarioId).toBe(30);
    expect(recargado.mensaje).toContain("Pedro agregó 10 unidades");
  });

  it("respects notification preferences and skips disabled types", async () => {
    // Admin 10 has disabled STOCK_CRITICO
    setupPrismaMocks({}, {
      preferencias: [{ usuarioId: 10, tipo: "STOCK_CRITICO", habilitada: false }],
      activeProducts: [{ id: 5, cantidad: 3, stockMinimo: 5 }],
    });

    await evaluarYNotificarStock(defaultParams({ cantidadAnterior: 10, cantidadNueva: 3 }));

    const createCalls = mocks.notificacion.create.mock.calls.map((c) => c[0].data);
    const criticoAdmin = createCalls.find((n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 10);
    const criticoEncargado = createCalls.find((n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 20);

    expect(criticoAdmin).toBeUndefined();
    expect(criticoEncargado).toBeDefined();
  });
});

describe("verificarStockActual (Grouped sync)", () => {
  it("creates grouped notifications if no recent notification exists in last 24h", async () => {
    setupPrismaMocks({}, {
      activeProducts: [
        { id: 1, cantidad: 3, stockMinimo: 5 },
        { id: 2, cantidad: 0, stockMinimo: 5 },
      ],
      existingUnread: null,
    });

    await verificarStockActual();

    const createCalls = mocks.notificacion.create.mock.calls.map((c) => c[0].data);
    expect(createCalls.some((n) => n.tipo === "STOCK_CRITICO" && n.mensaje === "Se detectaron 1 productos con stock crítico")).toBe(true);
    expect(createCalls.some((n) => n.tipo === "STOCK_AGOTADO" && n.mensaje === "Se detectaron 1 productos sin stock")).toBe(true);
  });

  it("updates unread grouped notification with current counts on sync", async () => {
    setupPrismaMocks({}, {
      activeProducts: [
        { id: 1, cantidad: 3, stockMinimo: 5 },
        { id: 2, cantidad: 2, stockMinimo: 5 },
      ],
      existingUnread: (args: any) => {
        if (args?.where?.tipo === "STOCK_CRITICO" && args?.where?.leida === false) {
          return { id: 77, tipo: "STOCK_CRITICO", usuarioId: args.where.usuarioId };
        }
        return null;
      },
    });

    await verificarStockActual();

    expect(mocks.notificacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 77 },
        data: expect.objectContaining({
          mensaje: "Se detectaron 2 productos con stock crítico",
        }),
      })
    );
  });

  it("deletes unread notifications if no products are in alert state", async () => {
    setupPrismaMocks({}, {
      activeProducts: [{ id: 1, cantidad: 10, stockMinimo: 5 }],
    });

    await verificarStockActual();

    expect(mocks.notificacion.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipo: "STOCK_CRITICO", leida: false }),
      })
    );
    expect(mocks.notificacion.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipo: "STOCK_AGOTADO", leida: false }),
      })
    );
  });
});
