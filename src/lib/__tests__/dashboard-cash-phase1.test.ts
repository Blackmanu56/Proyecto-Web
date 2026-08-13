import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  venta: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  caja: { findFirst: vi.fn() },
  producto: { count: vi.fn(), findMany: vi.fn(), fields: { stockMinimo: "stockMinimo" } },
  compra: { count: vi.fn() },
  cliente: { count: vi.fn() },
  proveedor: { count: vi.fn() },
  detalleVenta: { findMany: vi.fn() },
  movimientoCaja: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-permissions", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    venta: mocks.venta,
    caja: mocks.caja,
    producto: mocks.producto,
    compra: mocks.compra,
    cliente: mocks.cliente,
    proveedor: mocks.proveedor,
    detalleVenta: mocks.detalleVenta,
    movimientoCaja: mocks.movimientoCaja,
  },
}));

import { getDashboardData } from "../../actions/informes";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(undefined);
  mocks.venta.aggregate.mockResolvedValue({ _sum: { total: 0 } });
  mocks.venta.count.mockResolvedValue(0);
  mocks.venta.findMany.mockResolvedValue([]);
  mocks.producto.count.mockResolvedValue(0);
  mocks.producto.findMany.mockResolvedValue([]);
  mocks.compra.count.mockResolvedValue(0);
  mocks.cliente.count.mockResolvedValue(0);
  mocks.proveedor.count.mockResolvedValue(0);
  mocks.detalleVenta.findMany.mockResolvedValue([]);
  mocks.movimientoCaja.findMany.mockResolvedValue([]);
});

describe("Dashboard physical cash integration", () => {
  it("reports active Caja cash from movements rather than montoInicial plus totalVentas", async () => {
    mocks.caja.findFirst.mockResolvedValue({
      id: 1,
      montoInicial: 100_000,
      totalVentas: 900_000,
      movimientos: [
        { tipo: "INGRESO", monto: 100_000 },
        { tipo: "INGRESO", monto: 50_000 },
        { tipo: "EGRESO", monto: 30_000 },
      ],
    });

    const dashboard = await getDashboardData();

    expect(dashboard.stats.ingresosCaja).toBe(120_000);
    expect(mocks.caja.findFirst).toHaveBeenCalledWith({
      where: { estado: "ABIERTA" },
      include: {
        movimientos: {
          select: { tipo: true, monto: true },
        },
      },
    });
  });
});
