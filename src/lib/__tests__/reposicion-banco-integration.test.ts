/**
 * Parte 3 — Reposiciones conectadas con Banco.
 *
 * Escenarios obligatorios del spec:
 * A)  Efectivo con Caja abierta
 * B)  Efectivo sin Caja abierta
 * C)  Transferencia con Banco suficiente
 * D)  Transferencia con Caja cerrada
 * E)  Transferencia sin Banco principal
 * F)  Transferencia con saldo Banco insuficiente
 * G)  Mixto (Efectivo + Transferencia)
 * H)  Mixto sin Caja abierta (efectivo > 0)
 * I)  Mixto con efectivo insuficiente
 * J)  Mixto con Banco insuficiente
 * K)  Histórico con Mercado Pago / Fondos Externos / Cta. Cte. sigue legible
 * L)  Stock y DetalleCompra funcionan igual
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ── Mocks ──────────────────────────────────────────────────────────────────── */

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
    cuentaFinanciera: {
      findFirst: vi.fn(),
    },
    movimientoCaja: { create: vi.fn() },
    movimientoFinanciero: { create: vi.fn() },
  };

  return {
    tx,
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
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/upload", () => ({ saveFile: vi.fn(), deleteFile: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createProducto, updateProducto } from "../../actions/productos";
import { PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS } from "../../lib/product-purchase-payments";

/* ── Constants ──────────────────────────────────────────────────────────────── */

const SESSION = {
  userId: 1,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.crear", "productos.editar"],
};

const OPEN_CAJA = {
  id: 30,
  estado: "ABIERTA",
  montoInicial: 100_000,
  totalVentas: 204_840,
  movimientos: [{ tipo: "INGRESO", monto: 204_840 }],
};

const BANK_ACCOUNT = {
  id: 1,
  tipo: "BANCO",
  esPrincipal: true,
  activa: true,
  saldoInicial: 500_000,
  movimientos: [],
};

const CLOSED_CAJA = null;

/* ── Helpers ────────────────────────────────────────────────────────────────── */

type Pago = { medio: "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA"; monto: number };

function productoForm({
  cantidad = "1",
  pagos,
}: {
  cantidad?: string;
  pagos?: Pago[];
} = {}) {
  const formData = new FormData();
  const values: Record<string, string> = {
    nombre: "Filtro de aceite",
    marca: "Honda",
    codigo: "",
    imagen: "",
    categoriaId: "2",
    proveedorId: "3",
    precioCompra: "100000",
    precioVenta: "150000",
    cantidad,
    stockMinimo: "1",
    origenPago: "EFECTIVO_CAJA",
  };

  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  if (pagos) formData.set("pagos", JSON.stringify(pagos));
  return formData;
}

function expectNoCajaImpact() {
  expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
  expect(mocks.tx.caja.update).not.toHaveBeenCalled();
}

function expectNoFinancieroImpact() {
  expect(mocks.tx.movimientoFinanciero.create).not.toHaveBeenCalled();
}

/* ── Setup ──────────────────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.requirePermission.mockResolvedValue(SESSION);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.producto.create.mockResolvedValue({ id: 10, nombre: "Filtro de aceite" });
  mocks.tx.producto.findUnique.mockResolvedValue({ id: 10, cantidad: 10 });
  mocks.tx.producto.update.mockResolvedValue({ id: 10, cantidad: 11 });
  mocks.tx.compra.create.mockResolvedValue({ id: 50 });
  mocks.tx.pagoCompra.createMany.mockResolvedValue({ count: 1 });
  mocks.tx.caja.findFirst.mockResolvedValue(OPEN_CAJA);
  mocks.tx.cuentaFinanciera.findFirst.mockResolvedValue(BANK_ACCOUNT);
  mocks.tx.movimientoCaja.create.mockResolvedValue({ id: 70 });
  mocks.tx.caja.update.mockResolvedValue({ id: 30 });
  mocks.tx.movimientoFinanciero.create.mockResolvedValue({ id: 80 });
});

afterEach(() => vi.restoreAllMocks());

/* ── Tests ──────────────────────────────────────────────────────────────────── */

describe("Parte 3 — Reposiciones con Banco", () => {
  // ─── A) Reposición $100.000 Efectivo con Caja abierta ─────────────────────
  it("A) Efectivo con Caja abierta: crea MovimientoCaja EGRESO, no toca Banco", async () => {
    const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 100_000 }];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.success).toBe(true);
    expect(mocks.tx.compra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ total: 100_000 }),
      })
    );
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "EGRESO", monto: 100_000 }),
      })
    );
    expectNoFinancieroImpact();
  });

  // ─── B) Efectivo sin Caja abierta ─────────────────────────────────────────
  it("B) Efectivo sin Caja abierta: rechaza atómicamente", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(CLOSED_CAJA);
    const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 100_000 }];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.error).toContain("No hay una caja abierta");
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expectNoFinancieroImpact();
  });

  // ─── C) Transferencia $100.000 con Banco suficiente ────────────────────────
  it("C) Transferencia con Banco suficiente: crea MovimientoFinanciero EGRESO, no toca Caja", async () => {
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.success).toBe(true);
    expect(mocks.tx.compra.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cuentaFinancieraId: 1,
          tipo: "EGRESO",
          monto: 100_000,
          compraId: 50,
        }),
      })
    );
    expectNoCajaImpact();
  });

  // ─── D) Transferencia con Caja cerrada ─────────────────────────────────────
  it("D) Transferencia con Caja cerrada: permite la operación", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(CLOSED_CAJA);
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.success).toBe(true);
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
    expectNoCajaImpact();
  });

  // ─── E) Transferencia sin Banco principal ──────────────────────────────────
  it("E) Transferencia sin Banco principal: falla", async () => {
    mocks.tx.cuentaFinanciera.findFirst.mockResolvedValueOnce(null);
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.error).toBe("No hay una cuenta bancaria principal configurada.");
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expectNoFinancieroImpact();
  });

  // ─── F) Transferencia con saldo Banco insuficiente ─────────────────────────
  it("F) Transferencia con saldo Banco insuficiente: falla", async () => {
    mocks.tx.cuentaFinanciera.findFirst.mockResolvedValueOnce({
      ...BANK_ACCOUNT,
      saldoInicial: 50_000,
      movimientos: [],
    });
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.error).toContain("Saldo bancario insuficiente");
    expect(result.error).toContain("Disponible: $50000.00");
    expect(result.error).toContain("Solicitado: $100000.00");
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expectNoFinancieroImpact();
  });

  // ─── G) Mixto: Efectivo $30.000 + Transferencia $70.000 ───────────────────
  it("G) Mixto: crea MovimientoCaja EGRESO + MovimientoFinanciero EGRESO", async () => {
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 30_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
    ];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.success).toBe(true);
    expect(mocks.tx.compra.create).toHaveBeenCalledOnce();

    // PagoCompra registra ambos
    expect(mocks.tx.pagoCompra.createMany).toHaveBeenCalledOnce();
    expect(mocks.tx.pagoCompra.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ medio: "EFECTIVO_CAJA", monto: 30_000 }),
        expect.objectContaining({ medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 }),
      ]),
    });

    // MovimientoCaja solo efectivo
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "EGRESO", monto: 30_000 }),
      })
    );

    // MovimientoFinanciero solo transferencia
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cuentaFinancieraId: 1,
          tipo: "EGRESO",
          monto: 70_000,
        }),
      })
    );
  });

  // ─── H) Mixto sin Caja abierta (efectivo > 0) ────────────────────────────
  it("H) Mixto sin Caja abierta con efectivo > 0: falla", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(CLOSED_CAJA);
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 30_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
    ];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.error).toContain("No hay una caja abierta");
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expectNoFinancieroImpact();
  });

  // ─── I) Mixto con efectivo insuficiente ────────────────────────────────────
  it("I) Mixto con efectivo insuficiente: falla", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce({
      ...OPEN_CAJA,
      movimientos: [{ tipo: "INGRESO", monto: 10_000 }],
    });
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 50_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 50_000 },
    ];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.error).toContain("Fondos insuficientes en Caja");
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expectNoFinancieroImpact();
  });

  // ─── J) Mixto con Banco insuficiente ───────────────────────────────────────
  it("J) Mixto con Banco insuficiente: falla", async () => {
    mocks.tx.cuentaFinanciera.findFirst.mockResolvedValueOnce({
      ...BANK_ACCOUNT,
      saldoInicial: 10_000,
      movimientos: [],
    });
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 30_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
    ];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.error).toContain("Saldo bancario insuficiente");
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expectNoCajaImpact();
    expectNoFinancieroImpact();
  });

  // ─── K) Histórico con Mercado Pago / Fondos Externos / Cta. Cte. ──────────
  it("K) Labels históricos siguen siendo formateables", () => {
    expect(PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS.MERCADO_PAGO).toBe("Mercado Pago");
    expect(PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS.FONDOS_EXTERNOS).toBe("Fondos Externos");
    expect(PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS.CUENTA_CORRIENTE_PROVEEDOR).toBe("Cta. Cte. Proveedor");
  });

  // ─── L) Stock y DetalleCompra funcionan igual ─────────────────────────────
  it("L) Stock y DetalleCompra se crean correctamente en reposición mixta", async () => {
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 30_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
    ];

    const result = await createProducto(productoForm({ cantidad: "1", pagos }));

    expect(result.success).toBe(true);

    // Producto creado con stock correcto
    expect(mocks.tx.producto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cantidad: 1 }),
      })
    );

    // Compra con detalle correcto
    expect(mocks.tx.compra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 100_000,
          detalles: {
            create: expect.objectContaining({
              productoId: 10,
              cantidad: 1,
              costoUnitario: 100_000,
              subtotal: 100_000,
            }),
          },
        }),
      })
    );
  });

  // ─── Bonus: updateProducto (reposición a producto existente) ───────────────
  it("updateProducto con transferencia crea MovimientoFinanciero EGRESO", async () => {
    const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

    const result = await updateProducto(10, productoForm({ cantidad: "11", pagos }));

    expect(result.success).toBe(true);
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cuentaFinancieraId: 1,
          tipo: "EGRESO",
          monto: 100_000,
        }),
      })
    );
    expectNoCajaImpact();
  });

  it("updateProducto mixto crea ambos movimientos", async () => {
    const pagos: Pago[] = [
      { medio: "EFECTIVO_CAJA", monto: 20_000 },
      { medio: "TRANSFERENCIA_BANCARIA", monto: 80_000 },
    ];

    const result = await updateProducto(10, productoForm({ cantidad: "11", pagos }));

    expect(result.success).toBe(true);
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "EGRESO", monto: 20_000 }),
      })
    );
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "EGRESO", monto: 80_000 }),
      })
    );
  });
});
