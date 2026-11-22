import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    producto: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    ajustePrecio: {
      create: vi.fn(),
    },
    movimientoProducto: {
      createMany: vi.fn(),
    },
  };

  return {
    tx,
    getSession: vi.fn(),
    requirePermission: vi.fn(),
    revalidatePath: vi.fn(),
    $transaction: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.$transaction,
  },
}));

vi.mock("@/lib/auth.server", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { ajustarPreciosMasivo } from "@/actions/productos";

describe("Ajuste Masivo de Precios - Estrategia Híbrida 3 Capas", () => {
  const mockUser = {
    userId: 1,
    username: "admin",
    role: "ADMIN",
    permissions: ["productos.editar"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(mockUser);
    mocks.requirePermission.mockResolvedValue(mockUser);
    mocks.$transaction.mockImplementation(async (callback, options) => {
      // Pass the options to verify timeout configuration
      return callback(mocks.tx);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("configura timeout y maxWait en prisma.$transaction y actualiza productos concurrentemente", async () => {
    const mockProducts = [
      { id: 1, nombre: "Aceite Motul", precioCompra: 5000, precioVenta: 10000, cantidad: 15, activo: true, categoriaId: 1, proveedorId: 1, marca: "Motul" },
      { id: 2, nombre: "Bujía NGK", precioCompra: 1000, precioVenta: 2000, cantidad: 50, activo: true, categoriaId: 1, proveedorId: 1, marca: "NGK" },
      { id: 3, nombre: "Filtro Aire", precioCompra: 3000, precioVenta: 6000, cantidad: 8, activo: true, categoriaId: 1, proveedorId: 1, marca: "Genérico" },
    ];

    mocks.tx.producto.findMany.mockResolvedValue(mockProducts);
    mocks.tx.ajustePrecio.create.mockResolvedValue({ id: 99 });
    mocks.tx.producto.update.mockResolvedValue({});
    mocks.tx.movimientoProducto.createMany.mockResolvedValue({ count: 3 });

    const result = await ajustarPreciosMasivo({
      filtros: { estado: "activos" },
      ajustarCompra: true,
      ajustarVenta: true,
      metodoCompra: "PORCENTAJE",
      valorCompra: 10,
      metodoVenta: "PORCENTAJE",
      valorVenta: 20,
      redondeo: "SIN_REDONDEO",
      motivo: "Aumento de costos general",
    });

    expect(result.success).toBe(true);
    expect(result.totalModificados).toBe(3);
    expect(result.ajusteId).toBe(99);

    // 1. Verificación de configuración de timeout de transacción
    expect(mocks.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        timeout: 30000,
        maxWait: 5000,
      })
    );

    // 2. Verificación de actualización concurrente de productos
    expect(mocks.tx.producto.update).toHaveBeenCalledTimes(3);
    expect(mocks.tx.producto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { precioCompra: 5500, precioVenta: 12000 },
    });
    expect(mocks.tx.producto.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { precioCompra: 1100, precioVenta: 2400 },
    });
    expect(mocks.tx.producto.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { precioCompra: 3300, precioVenta: 7200 },
    });

    // 3. Verificación de inserción masiva en lote de auditoría
    expect(mocks.tx.movimientoProducto.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.movimientoProducto.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          productoId: 1,
          tipo: "EDICION",
          usuarioId: 1,
          motivo: "Ajuste masivo #99: Aumento de costos general",
        }),
        expect.objectContaining({
          productoId: 2,
          tipo: "EDICION",
          usuarioId: 1,
        }),
        expect.objectContaining({
          productoId: 3,
          tipo: "EDICION",
          usuarioId: 1,
        }),
      ]),
    });
  });

  it("revierte atómicamente y retorna error si algún cálculo genera un precio inválido (<= 0)", async () => {
    const mockProducts = [
      { id: 1, nombre: "Aceite", precioCompra: 5000, precioVenta: 10000, cantidad: 10, activo: true },
      { id: 2, nombre: "Tornillo", precioCompra: 100, precioVenta: 200, cantidad: 100, activo: true },
    ];

    mocks.tx.producto.findMany.mockResolvedValue(mockProducts);

    // Descuento excesivo de $500 que dejaría al tornillo con precio de venta negativo (-$300)
    const result = await ajustarPreciosMasivo({
      filtros: { estado: "activos" },
      ajustarCompra: false,
      ajustarVenta: true,
      metodoVenta: "MONTO_FIJO",
      valorVenta: -500,
      redondeo: "SIN_REDONDEO",
      motivo: "Descuento excesivo",
    });

    expect(result.error).toContain("precio de venta inválido");
    // No se deben haber ejecutado updates ni inserciones
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
    expect(mocks.tx.movimientoProducto.createMany).not.toHaveBeenCalled();
  });

  it("retorna error descriptivo si no hay productos que coincidan con los filtros", async () => {
    mocks.tx.producto.findMany.mockResolvedValue([]);

    const result = await ajustarPreciosMasivo({
      filtros: { categoriaId: 999 },
      ajustarVenta: true,
      metodoVenta: "PORCENTAJE",
      valorVenta: 10,
      motivo: "Filtro vacío",
    });

    expect(result.error).toContain("No se encontraron productos");
    expect(mocks.tx.ajustePrecio.create).not.toHaveBeenCalled();
  });
});
