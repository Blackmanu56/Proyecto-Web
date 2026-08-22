import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  producto: { findUnique: vi.fn(), findMany: vi.fn() },
  rol: { findMany: vi.fn() },
  usuario: { findMany: vi.fn() },
  preferenciaNotificacion: { findMany: vi.fn() },
  notificacion: { createMany: vi.fn(), findMany: vi.fn() },
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
  options: { preferencias?: Array<{ usuarioId: number; tipo: string; habilitada: boolean }> } = {}
) {
  mocks.producto.findUnique.mockResolvedValue({ ...PRODUCT_BASE, ...productOverrides });
  mocks.rol.findMany.mockResolvedValue(ROLES);
  mocks.usuario.findMany.mockImplementation(async (args: { where: { rolId: number } }) => {
    if (args.where.rolId === 1) return ADMIN_USERS;
    if (args.where.rolId === 2) return ENCARGADO_USERS;
    return [];
  });
  mocks.preferenciaNotificacion.findMany.mockResolvedValue(options.preferencias ?? []);
  mocks.notificacion.createMany.mockResolvedValue({ count: 0 });
}

function lastCreateManyData() {
  return mocks.notificacion.createMany.mock.calls.at(-1)![0].data as Array<{
    usuarioId: number;
    tipo: string;
    titulo: string;
    mensaje: string;
    entidad: string;
    productoId: number;
  }>;
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

describe("evaluarYNotificarStock", () => {
  // ── 1. STOCK_CRITICO → ADMINISTRADOR ────────────────────────────────────

  it("sends STOCK_CRITICO to ADMINISTRADOR when stock crosses below stockMinimo", async () => {
    // Stock 10 → 3, stockMinimo=5 → crosses threshold, not zero
    await evaluarYNotificarStock(defaultParams());

    const data = lastCreateManyData();
    const criticoToAdmin = data.find(
      (n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 10
    );

    expect(criticoToAdmin).toBeDefined();
    expect(criticoToAdmin!.titulo).toBe("⚠ Stock crítico");
    expect(criticoToAdmin!.productoId).toBe(5);
  });

  // ── 2. STOCK_CRITICO → ENCARGADO_STOCK ─────────────────────────────────

  it("sends STOCK_CRITICO to ENCARGADO_STOCK when stock crosses below stockMinimo", async () => {
    await evaluarYNotificarStock(defaultParams());

    const data = lastCreateManyData();
    const criticoToEncargado = data.find(
      (n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 20
    );

    expect(criticoToEncargado).toBeDefined();
    expect(criticoToEncargado!.titulo).toBe("⚠ Stock crítico");
  });

  // ── 3. STOCK_AGOTADO → ADMINISTRADOR ───────────────────────────────────

  it("sends STOCK_AGOTADO to ADMINISTRADOR when stock hits 0", async () => {
    // Stock 10 → 0
    await evaluarYNotificarStock(defaultParams({ cantidadNueva: 0 }));

    const data = lastCreateManyData();
    const agotadoToAdmin = data.find(
      (n) => n.tipo === "STOCK_AGOTADO" && n.usuarioId === 10
    );

    expect(agotadoToAdmin).toBeDefined();
    expect(agotadoToAdmin!.titulo).toBe("🔴 Stock agotado");
    expect(agotadoToAdmin!.mensaje).toContain("sin stock");
  });

  // ── 4. STOCK_AGOTADO → ENCARGADO_STOCK ────────────────────────────────

  it("sends STOCK_AGOTADO to ENCARGADO_STOCK when stock hits 0", async () => {
    await evaluarYNotificarStock(defaultParams({ cantidadNueva: 0 }));

    const data = lastCreateManyData();
    const agotadoToEncargado = data.find(
      (n) => n.tipo === "STOCK_AGOTADO" && n.usuarioId === 20
    );

    expect(agotadoToEncargado).toBeDefined();
    expect(agotadoToEncargado!.titulo).toBe("🔴 Stock agotado");
  });

  // ── 5. No duplicate notifications ──────────────────────────────────────

  it("does not create duplicate notifications for same product at same level", async () => {
    const params = defaultParams();

    await evaluarYNotificarStock(params);
    const firstData = lastCreateManyData();

    // Verify no duplicate usuarioId+tipo pairs in a single call
    const keys = firstData.map((n) => `${n.usuarioId}-${n.tipo}`);
    expect(new Set(keys).size).toBe(keys.length);

    // Call again with same params — same result, no extras
    await evaluarYNotificarStock(params);
    const secondData = lastCreateManyData();

    const keys2 = secondData.map((n) => `${n.usuarioId}-${n.tipo}`);
    expect(new Set(keys2).size).toBe(keys2.length);
  });

  // ── 6. STOCK_RESTADO → only movement user, not admins ─────────────────

  it("sends STOCK_RESTADO only to the user who caused the movement, not to admins", async () => {
    // User 30 is NOT admin (10) nor encargado (20)
    await evaluarYNotificarStock(defaultParams());

    const data = lastCreateManyData();
    const restadoEntries = data.filter((n) => n.tipo === "STOCK_RESTADO");

    // Only user 30 gets RESTADO
    expect(restadoEntries).toHaveLength(1);
    expect(restadoEntries[0].usuarioId).toBe(30);
    expect(restadoEntries[0].mensaje).toContain("Pedro");

    // Admins/encargados do NOT get RESTADO
    const restadoToAdmin = data.find(
      (n) => n.tipo === "STOCK_RESTADO" && n.usuarioId === 10
    );
    const restadoToEncargado = data.find(
      (n) => n.tipo === "STOCK_RESTADO" && n.usuarioId === 20
    );
    expect(restadoToAdmin).toBeUndefined();
    expect(restadoToEncargado).toBeUndefined();
  });

  // ── 7. STOCK_RECARGADO → only movement user, not admins ────────────────

  it("sends STOCK_RECARGADO only to the user who caused the movement, not to admins", async () => {
    // Stock increases: 5 → 15
    await evaluarYNotificarStock(
      defaultParams({ cantidadAnterior: 5, cantidadNueva: 15 })
    );

    const data = lastCreateManyData();
    const recargadoEntries = data.filter((n) => n.tipo === "STOCK_RECARGADO");

    // Only user 30 gets RECARGADO
    expect(recargadoEntries).toHaveLength(1);
    expect(recargadoEntries[0].usuarioId).toBe(30);
    expect(recargadoEntries[0].mensaje).toContain("Pedro");
    expect(recargadoEntries[0].mensaje).toContain("10 unidades");

    // Admins/encargados do NOT get RECARGADO
    const recargadoToAdmin = data.find(
      (n) => n.tipo === "STOCK_RECARGADO" && n.usuarioId === 10
    );
    expect(recargadoToAdmin).toBeUndefined();
  });

  // ── 8. No critical notification when stock stays above minimum ────────

  it("does not create any notification when stock decreases but stays above stockMinimo and user is admin", async () => {
    // Stock 10 → 8, stockMinimo=5 → still above threshold
    // User is admin, so RESTADO won't be sent to them either
    await evaluarYNotificarStock(
      defaultParams({
        usuarioId: 10,
        usuarioNombre: "admin",
        cantidadNueva: 8,
      })
    );

    // createMany should NOT be called (no notifications to create)
    expect(mocks.notificacion.createMany).not.toHaveBeenCalled();
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  it("skips when stock did not change", async () => {
    await evaluarYNotificarStock(defaultParams({ cantidadNueva: 10 }));

    expect(mocks.notificacion.createMany).not.toHaveBeenCalled();
  });

  it("skips when product is not found", async () => {
    mocks.producto.findUnique.mockResolvedValue(null);

    await evaluarYNotificarStock(defaultParams());

    expect(mocks.notificacion.createMany).not.toHaveBeenCalled();
  });

  it("skips when product is inactive", async () => {
    setupPrismaMocks({ activo: false });

    await evaluarYNotificarStock(defaultParams());

    expect(mocks.notificacion.createMany).not.toHaveBeenCalled();
  });

  it("respects notification preferences and skips disabled types", async () => {
    // User 10 (admin) has STOCK_CRITICO disabled
    setupPrismaMocks({}, {
      preferencias: [
        { usuarioId: 10, tipo: "STOCK_CRITICO", habilitada: false },
      ],
    });

    await evaluarYNotificarStock(defaultParams());

    const data = lastCreateManyData();

    // Admin 10 should NOT get STOCK_CRITICO
    const criticoToAdmin = data.find(
      (n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 10
    );
    expect(criticoToAdmin).toBeUndefined();

    // Encargado 20 still gets it (no preference blocking)
    const criticoToEncargado = data.find(
      (n) => n.tipo === "STOCK_CRITICO" && n.usuarioId === 20
    );
    expect(criticoToEncargado).toBeDefined();
  });

  it("creates both STOCK_RESTADO and STOCK_CRITICO when crossing threshold", async () => {
    await evaluarYNotificarStock(defaultParams());

    const data = lastCreateManyData();
    const tipos = data.map((n) => n.tipo);

    expect(tipos).toContain("STOCK_RESTADO");
    expect(tipos).toContain("STOCK_CRITICO");
    expect(tipos).not.toContain("STOCK_AGOTADO");
  });

  it("creates both STOCK_RESTADO and STOCK_AGOTADO when hitting zero", async () => {
    await evaluarYNotificarStock(defaultParams({ cantidadNueva: 0 }));

    const data = lastCreateManyData();
    const tipos = data.map((n) => n.tipo);

    expect(tipos).toContain("STOCK_RESTADO");
    expect(tipos).toContain("STOCK_AGOTADO");
    expect(tipos).not.toContain("STOCK_CRITICO");
  });

  it("handles error fetching recipients gracefully without crashing", async () => {
    mocks.rol.findMany.mockRejectedValue(new Error("DB connection lost"));

    // Should not throw
    await expect(
      evaluarYNotificarStock(defaultParams())
    ).resolves.toBeUndefined();

    expect(mocks.notificacion.createMany).not.toHaveBeenCalled();
  });
});

// ─── verificarStockActual ──────────────────────────────────────────────────

describe("verificarStockActual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificacion.createMany.mockResolvedValue({ count: 0 });
    mocks.notificacion.findMany.mockResolvedValue([]);
    mocks.rol.findMany.mockResolvedValue(ROLES);
    mocks.usuario.findMany.mockImplementation(async (args: { where: { rolId: number } }) => {
      if (args.where.rolId === 1) return ADMIN_USERS;
      if (args.where.rolId === 2) return ENCARGADO_USERS;
      return [];
    });
  });

  it("creates STOCK_CRITICO for products at or below stockMinimo", async () => {
    mocks.producto.findMany.mockResolvedValue([
      { id: 1, nombre: "Filtro A", cantidad: 3, stockMinimo: 5 },
    ]);

    await verificarStockActual();

    expect(mocks.notificacion.createMany).toHaveBeenCalledOnce();
    const data = lastCreateManyData();
    expect(data).toHaveLength(2); // admin + encargado
    expect(data.every((n) => n.tipo === "STOCK_CRITICO")).toBe(true);
  });

  it("creates STOCK_AGOTADO for products with zero stock", async () => {
    mocks.producto.findMany.mockResolvedValue([
      { id: 1, nombre: "Filtro A", cantidad: 0, stockMinimo: 5 },
    ]);

    await verificarStockActual();

    expect(mocks.notificacion.createMany).toHaveBeenCalledOnce();
    const data = lastCreateManyData();
    expect(data).toHaveLength(2);
    expect(data.every((n) => n.tipo === "STOCK_AGOTADO")).toBe(true);
  });

  it("creates both CRITICO and AGOTADO for mixed products", async () => {
    mocks.producto.findMany.mockResolvedValue([
      { id: 1, nombre: "Filtro A", cantidad: 3, stockMinimo: 5 },
      { id: 2, nombre: "Filtro B", cantidad: 0, stockMinimo: 2 },
    ]);

    await verificarStockActual();

    const data = lastCreateManyData();
    expect(data).toHaveLength(4); // 2 products × 2 users
    const tipos = data.map((n) => n.tipo);
    expect(tipos).toContain("STOCK_CRITICO");
    expect(tipos).toContain("STOCK_AGOTADO");
  });

  it("does not create notifications when all products are above minimum", async () => {
    mocks.producto.findMany.mockResolvedValue([
      { id: 1, nombre: "Filtro A", cantidad: 10, stockMinimo: 5 },
    ]);

    await verificarStockActual();

    expect(mocks.notificacion.createMany).not.toHaveBeenCalled();
  });

  it("skips existing notifications from last 24h (dedup)", async () => {
    mocks.producto.findMany.mockResolvedValue([
      { id: 1, nombre: "Filtro A", cantidad: 3, stockMinimo: 5 },
    ]);
    // Simulate existing notification for admin (user 10) for product 1
    mocks.notificacion.findMany.mockResolvedValue([
      { usuarioId: 10, tipo: "STOCK_CRITICO", productoId: 1 },
    ]);

    await verificarStockActual();

    const data = lastCreateManyData();
    // Only encargado (user 20) should get notification; admin already has it
    expect(data).toHaveLength(1);
    expect(data[0].usuarioId).toBe(20);
  });

  it("handles empty product list gracefully", async () => {
    mocks.producto.findMany.mockResolvedValue([]);

    await verificarStockActual();

    expect(mocks.notificacion.createMany).not.toHaveBeenCalled();
  });

  it("does not create notifications for products above minimum", async () => {
    mocks.producto.findMany.mockResolvedValue([
      { id: 1, nombre: "Filtro A", cantidad: 10, stockMinimo: 5 },
      { id: 2, nombre: "Filtro B", cantidad: 8, stockMinimo: 3 },
    ]);

    await verificarStockActual();

    expect(mocks.notificacion.createMany).not.toHaveBeenCalled();
  });
});
