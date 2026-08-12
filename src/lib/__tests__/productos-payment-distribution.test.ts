import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Pago = {
  medio:
    | "EFECTIVO_CAJA"
    | "TRANSFERENCIA_BANCARIA"
    | "MERCADO_PAGO"
    | "CUENTA_CORRIENTE_PROVEEDOR"
    | "FONDOS_EXTERNOS";
  monto: number;
  observacion?: string;
};

const mocks = vi.hoisted(() => {
  const tx = {
    producto: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    compra: { create: vi.fn() },
    pagoCompra: { createMany: vi.fn() },
    caja: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    movimientoCaja: { create: vi.fn() },
  };

  return {
    tx,
    cajaFindFirst: vi.fn(),
    transaction: vi.fn(),
    getSession: vi.fn(),
    requirePermission: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/auth.server", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/auth-permissions", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    caja: { findFirst: mocks.cajaFindFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/upload", () => ({ saveFile: vi.fn(), deleteFile: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createProducto, updateProducto } from "../../actions/productos";

const OPEN_CAJA = {
  id: 30,
  estado: "ABIERTA",
  montoInicial: 100_000,
  totalVentas: 104_840,
};

const session = {
  userId: 1,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.crear", "productos.editar"],
};

function productoForm({
  cantidad = "12",
  pagos,
}: {
  cantidad?: string;
  pagos?: Pago[];
} = {}) {
  const formData = new FormData();
  const values = {
    nombre: "Kit transmisión",
    marca: "Honda",
    codigo: "",
    imagen: "",
    categoriaId: "2",
    proveedorId: "3",
    precioCompra: "123600",
    precioVenta: "150000",
    cantidad,
    stockMinimo: "2",
    origenPago: "EFECTIVO_CAJA",
  };

  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  if (pagos) formData.set("pagos", JSON.stringify(pagos));
  return formData;
}

function expectPayments(pagos: Pago[]) {
  expect(mocks.tx.pagoCompra.createMany).toHaveBeenCalledOnce();
  expect(mocks.tx.pagoCompra.createMany).toHaveBeenCalledWith({
    data: pagos.map((pago) => ({
      compraId: 50,
      medio: pago.medio,
      monto: pago.monto,
      observacion: pago.observacion || null,
    })),
  });
}

function expectSuccessfulReplenishment(pagos: Pago[]) {
  expect(mocks.transaction).toHaveBeenCalledOnce();
  expect(mocks.tx.producto.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 10 },
    data: expect.objectContaining({ cantidad: 12 }),
  }));
  expect(mocks.tx.compra.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      total: 247_200,
      detalles: {
        create: expect.objectContaining({
          productoId: 10,
          cantidad: 2,
          costoUnitario: 123_600,
          subtotal: 247_200,
        }),
      },
    }),
  }));
  expect(pagos.reduce((sum, pago) => sum + pago.monto, 0)).toBe(247_200);
  expectPayments(pagos);
}

function expectNoCajaImpact() {
  expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
  expect(mocks.tx.caja.update).not.toHaveBeenCalled();
}

function expectAnchoredCajaMovement(monto: number) {
  expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledOnce();
  expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      cajaId: 30,
      usuarioId: 1,
      compraId: 50,
      tipo: "EGRESO",
      monto,
      descripcion: expect.stringContaining("Total:"),
    }),
  });
}

function expectCajaRevalidated() {
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/caja");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue(session);
  mocks.requirePermission.mockResolvedValue(session);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.producto.findUnique.mockResolvedValue({ id: 10, cantidad: 10 });
  mocks.tx.producto.create.mockResolvedValue({ id: 10, nombre: "Kit transmisión" });
  mocks.tx.producto.update.mockResolvedValue({ id: 10, cantidad: 12 });
  mocks.tx.compra.create.mockResolvedValue({ id: 50 });
  mocks.tx.pagoCompra.createMany.mockResolvedValue({ count: 1 });
  mocks.cajaFindFirst.mockResolvedValue(OPEN_CAJA);
  mocks.tx.caja.findFirst.mockResolvedValue(OPEN_CAJA);
  mocks.tx.movimientoCaja.create.mockResolvedValue({ id: 70 });
  mocks.tx.caja.update.mockResolvedValue({ id: 30 });
});

afterEach(() => vi.restoreAllMocks());

describe("payment distribution in product purchases", () => {
  it("1. persists initial stock paid only with cash and affects Caja once", async () => {
    const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 123_600 }];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.success).toBe(true);
    expect(mocks.tx.compra.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ total: 123_600 }),
    }));
    expect(mocks.tx.producto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cantidad: 1 }),
    }));
    expect(pagos.reduce((sum, pago) => sum + pago.monto, 0)).toBe(123_600);
    expectPayments(pagos);
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledOnce();
    expect(mocks.tx.caja.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { totalVentas: { decrement: 123_600 } },
    });
  });

  it("accepts an initial 247200 transfer with only 204840 in Caja", async () => {
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }];

    const result = await createProducto(productoForm({ cantidad: "2", pagos }));

    expect(result.success).toBe(true);
    expect(mocks.tx.compra.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ total: 247_200 }),
    }));
    expectPayments(pagos);
    expect(mocks.tx.caja.findFirst).toHaveBeenCalledOnce();
    expectAnchoredCajaMovement(0);
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
    expectCajaRevalidated();
  });

  it("rejects legacy initial cash above the Caja balance before any write", async () => {
    const result = await createProducto(productoForm({ cantidad: "2" }));

    expect(result.error).toContain("Fondos insuficientes en Caja");
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.pagoCompra.createMany).not.toHaveBeenCalled();
    expectNoCajaImpact();
  });

  it("persists initial stock paid without cash but does not anchor it when no Caja is open", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(null);
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }];

    const result = await createProducto(productoForm({ cantidad: "2", pagos }));

    expect(result.success).toBe(true);
    expectPayments(pagos);
    expectNoCajaImpact();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/caja");
  });

  it("rejects initial stock assigned to Caja cash when no Caja is open", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(null);
    const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 247_200 }];

    const result = await createProducto(productoForm({ cantidad: "2", pagos }));

    expect(result.error).toContain("No hay una caja abierta");
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.pagoCompra.createMany).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates a product without stock without requiring or touching Caja", async () => {
    const result = await createProducto(
      productoForm({
        cantidad: "0",
        pagos: [{ medio: "EFECTIVO_CAJA", monto: 123_600 }],
      })
    );

    expect(result.success).toBe(true);
    expect(mocks.tx.producto.create).toHaveBeenCalledOnce();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.pagoCompra.createMany).not.toHaveBeenCalled();
    expect(mocks.tx.caja.findFirst).not.toHaveBeenCalled();
    expectNoCajaImpact();
  });

  it("2. accepts a 247200 transfer with only 204840 in Caja and does not warn through backend validation", async () => {
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.success).toBe(true);
    expectSuccessfulReplenishment(pagos);
    expectAnchoredCajaMovement(0);
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
    expectCajaRevalidated();
  });

  it("3. persists Mercado Pago without affecting Caja", async () => {
    const pagos: Pago[] = [{ medio: "MERCADO_PAGO", monto: 247_200 }];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.success).toBe(true);
    expectSuccessfulReplenishment(pagos);
    expectAnchoredCajaMovement(0);
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it("4. persists supplier current account without affecting Caja", async () => {
    const pagos: Pago[] = [{ medio: "CUENTA_CORRIENTE_PROVEEDOR", monto: 247_200 }];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.success).toBe(true);
    expectSuccessfulReplenishment(pagos);
    expectAnchoredCajaMovement(0);
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it("5. persists external funds without an observation", async () => {
    const pagos: Pago[] = [{ medio: "FONDOS_EXTERNOS", monto: 247_200 }];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.success).toBe(true);
    expectSuccessfulReplenishment(pagos);
    expectAnchoredCajaMovement(0);
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it("6. persists the optional external-funds origin/reference", async () => {
    const pagos: Pago[] = [{
      medio: "FONDOS_EXTERNOS",
      monto: 247_200,
      observacion: "Aporte socio 08/2026",
    }];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.success).toBe(true);
    expectSuccessfulReplenishment(pagos);
    expectAnchoredCajaMovement(0);
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it("7. persists a mixed transfer/cash payment and only cash affects Caja", async () => {
    const pagos: Pago[] = [
      { medio: "TRANSFERENCIA_BANCARIA", monto: 42_400 },
      { medio: "EFECTIVO_CAJA", monto: 204_800 },
    ];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.success).toBe(true);
    expectSuccessfulReplenishment(pagos);
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ monto: 204_800 }),
    }));
    expect(mocks.tx.caja.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { totalVentas: { decrement: 204_800 } },
    });
    expectCajaRevalidated();
  });

  it("persists a non-cash replenishment without an anchor when no Caja is open", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(null);
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.success).toBe(true);
    expectSuccessfulReplenishment(pagos);
    expectNoCajaImpact();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/caja");
  });

  it("rejects replenishment assigned to Caja cash when no Caja is open", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(null);
    const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 247_200 }];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.error).toContain("No hay una caja abierta");
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.pagoCompra.createMany).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a mixed replenishment containing Caja cash when no Caja is open", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(null);
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 100_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 147_200 },
    ];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.error).toContain("No hay una caja abierta");
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.pagoCompra.createMany).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("8. accepts cash exactly equal to the available Caja balance", async () => {
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 204_840 },
      { medio: "MERCADO_PAGO", monto: 42_360 },
    ];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.success).toBe(true);
    expectSuccessfulReplenishment(pagos);
    expect(mocks.tx.caja.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { totalVentas: { decrement: 204_840 } },
    });
  });

  it("9. rejects an all-cash amount above Caja before any write", async () => {
    const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 247_200 }];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.error).toContain("Fondos insuficientes en Caja");
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.pagoCompra.createMany).not.toHaveBeenCalled();
    expectNoCajaImpact();
  });

  it("10. rejects a mixed payment when only its 220000 cash share exceeds the 204840 balance", async () => {
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 220_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 27_200 },
    ];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.error).toContain("Fondos insuficientes en Caja");
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.pagoCompra.createMany).not.toHaveBeenCalled();
    expectNoCajaImpact();
  });

  it("rejects duplicate methods before any write, so retrying cannot create duplicate payments", async () => {
    const pagos: Pago[] = [
      { medio: "TRANSFERENCIA_BANCARIA", monto: 120_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 127_200 },
    ];

    const result = await updateProducto(10, productoForm({ pagos }));

    expect(result.error).toBe("No se permiten métodos de pago duplicados.");
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.pagoCompra.createMany).not.toHaveBeenCalled();
  });

  it("does not commit staged transaction writes after a technical payment failure", async () => {
    const committedWrites: string[] = [];
    mocks.transaction.mockImplementationOnce(async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => {
      const stagedWrites: string[] = [];
      mocks.tx.producto.update.mockImplementationOnce(async () => {
        stagedWrites.push("producto.update");
        return { id: 10, cantidad: 12 };
      });
      mocks.tx.compra.create.mockImplementationOnce(async () => {
        stagedWrites.push("compra.create");
        return { id: 50 };
      });
      mocks.tx.pagoCompra.createMany.mockImplementationOnce(async () => {
        stagedWrites.push("pagoCompra.createMany");
        throw new TypeError("delegate exploded");
      });

      try {
        const value = await callback(mocks.tx);
        committedWrites.push(...stagedWrites);
        return value;
      } catch (error) {
        throw error;
      }
    });

    const result = await updateProducto(
      10,
      productoForm({ pagos: [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }] })
    );

    expect(result.error).toBe("No se pudo registrar la reposición. Intentá nuevamente.");
    expect(console.error).toHaveBeenCalledWith(
      "Error en updateProducto:",
      expect.objectContaining({ message: "delegate exploded" })
    );
    expect(mocks.tx.producto.update).toHaveBeenCalledOnce();
    expect(mocks.tx.compra.create).toHaveBeenCalledOnce();
    expect(mocks.tx.pagoCompra.createMany).toHaveBeenCalledOnce();
    expect(committedWrites).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("preserves expected authorization messages", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("Usuario inactivo o no encontrado.")
    );

    const result = await createProducto(productoForm({ cantidad: "0" }));

    expect(result.error).toBe("Usuario inactivo o no encontrado.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("redacts unexpected technical permission errors and logs their detail", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new Error("Prisma P2024: connection pool timeout")
    );

    const result = await createProducto(productoForm({ cantidad: "0" }));

    expect(result.error).toBe("No se pudo registrar la reposición. Intentá nuevamente.");
    expect(console.error).toHaveBeenCalledWith(
      "Error en createProducto:",
      expect.objectContaining({ message: "Prisma P2024: connection pool timeout" })
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
