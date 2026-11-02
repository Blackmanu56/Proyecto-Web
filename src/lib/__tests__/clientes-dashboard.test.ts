import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    requirePermission: vi.fn(),
    clienteCount: vi.fn(),
    clienteFindMany: vi.fn(),
    ventaAggregate: vi.fn(),
    ventaGroupBy: vi.fn(),
    ventaFindMany: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cliente: {
      count: mocks.clienteCount,
      findMany: mocks.clienteFindMany,
    },
    venta: {
      aggregate: mocks.ventaAggregate,
      groupBy: mocks.ventaGroupBy,
      findMany: mocks.ventaFindMany,
    },
  },
}));

vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: mocks.requirePermission,
}));

import { getClientesDashboard } from "@/actions/informes";

describe("getClientesDashboard - Mejoras de Informe de Clientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(true);
  });

  it("calcula conCompras, distribucionCompras y nuevosVsRecurrentes con datos reales", async () => {
    // 3 clientes:
    // Cliente 1: 0 compras
    // Cliente 2: 1 compra en 2026-01
    // Cliente 3: 2 compras (primera en 2026-01, segunda en 2026-02)
    mocks.clienteCount
      .mockResolvedValueOnce(3) // total
      .mockResolvedValueOnce(2) // activos
      .mockResolvedValueOnce(1) // inactivos
      .mockResolvedValueOnce(1); // nuevos 30d

    mocks.ventaAggregate.mockResolvedValue({
      _sum: { total: 150000 },
    });

    mocks.ventaGroupBy.mockResolvedValue([
      {
        clienteId: 2,
        _count: { id: 1 },
        _sum: { total: 50000 },
        _min: { fecha: new Date("2026-01-10T12:00:00") },
        _max: { fecha: new Date("2026-01-10T12:00:00") },
      },
      {
        clienteId: 3,
        _count: { id: 2 },
        _sum: { total: 100000 },
        _min: { fecha: new Date("2026-01-15T14:00:00") },
        _max: { fecha: new Date("2026-02-10T11:00:00") },
      },
    ]);

    mocks.clienteFindMany.mockResolvedValue([
      { id: 1, nombre: "Cliente Cero", dni: "111", activo: true, creadoEn: new Date("2025-12-01") },
      { id: 2, nombre: "Cliente Uno", dni: "222", activo: true, creadoEn: new Date("2026-01-05") },
      { id: 3, nombre: "Cliente Dos", dni: "333", activo: false, creadoEn: new Date("2026-01-01") },
    ]);

    mocks.ventaFindMany.mockResolvedValue([
      { clienteId: 2, fecha: new Date("2026-01-10T12:00:00") },
      { clienteId: 3, fecha: new Date("2026-01-15T14:00:00") },
      { clienteId: 3, fecha: new Date("2026-02-10T11:00:00") },
    ]);

    const result = await getClientesDashboard();

    // 1. Resumen: Clientes con compras
    expect(result.resumen.total).toBe(3);
    expect(result.resumen.conCompras).toBe(2);

    // 2. Distribución por nivel de gasto sin superposiciones
    expect(result.distribucionGasto).toEqual([
      { rango: "Hasta $50.000", clientes: 1 }, // Cliente Cero (0)
      { rango: "$50.001 - $100.000", clientes: 1 }, // Cliente Uno (50000)
      { rango: "$100.001 - $300.000", clientes: 1 }, // Cliente Dos (100000)
      { rango: "Más de $300.000", clientes: 0 },
    ]);

    // 3. Distribución por cantidad de compras (5 buckets requeridos)
    expect(result.distribucionCompras).toEqual([
      { rango: "0 compras", clientes: 1 }, // Cliente Cero
      { rango: "1 compra", clientes: 1 },  // Cliente Uno
      { rango: "2-3 compras", clientes: 1 }, // Cliente Dos
      { rango: "4-5 compras", clientes: 0 },
      { rango: "6 o más compras", clientes: 0 },
    ]);

    // 4. Clientes nuevos vs recurrentes
    // En 2026-01: compraron cliente 2 y 3 (ambos primera vez -> 2 nuevos, 0 recurrentes)
    // En 2026-02: compró cliente 3 (su primera compra fue en 2026-01 -> 0 nuevos, 1 recurrente)
    const mesEnero = result.nuevosVsRecurrentes.find((m) => m.mes === "2026-01");
    const mesFebrero = result.nuevosVsRecurrentes.find((m) => m.mes === "2026-02");

    expect(mesEnero).toBeDefined();
    expect(mesEnero?.nuevos).toBe(2);
    expect(mesEnero?.recurrentes).toBe(0);

    expect(mesFebrero).toBeDefined();
    expect(mesFebrero?.nuevos).toBe(0);
    expect(mesFebrero?.recurrentes).toBe(1);
  });
});
