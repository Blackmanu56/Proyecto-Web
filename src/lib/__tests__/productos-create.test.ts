import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mocks = vi.hoisted(() => {
  const tx = {
    producto: { create: vi.fn() },
    compra: { create: vi.fn() },
    caja: { findFirst: vi.fn(), update: vi.fn() },
    movimientoCaja: { create: vi.fn() },
  };

  return {
    tx,
    getSession: vi.fn(),
    requirePermission: vi.fn(),
    transaction: vi.fn(),
    revalidatePath: vi.fn(),
    saveFile: vi.fn(),
  };
});

vi.mock("@/lib/auth.server", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/auth-permissions", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/upload", () => ({ saveFile: mocks.saveFile, deleteFile: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createProducto } from "../../actions/productos";

const session = {
  userId: 1,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.crear"],
};

function productoForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    nombre: "Kit transmisión",
    marca: "Honda",
    codigo: "",
    imagen: "",
    categoriaId: "2",
    proveedorId: "3",
    precioCompra: "100",
    precioVenta: "150",
    cantidad: "2",
    stockMinimo: "1",
    origenPago: "EFECTIVO_CAJA",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue(session);
  mocks.requirePermission.mockResolvedValue(session);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.producto.create.mockResolvedValue({ id: 10, nombre: "Kit transmisión" });
  mocks.tx.compra.create.mockResolvedValue({ id: 50 });
  mocks.tx.caja.findFirst.mockResolvedValue({
    id: 30,
    estado: "ABIERTA",
    montoInicial: 500,
    totalVentas: 500,
  });
  mocks.tx.movimientoCaja.create.mockResolvedValue({ id: 70 });
  mocks.tx.caja.update.mockResolvedValue({ id: 30 });
});

afterEach(() => vi.restoreAllMocks());

describe("createProducto initial stock", () => {
  it("persists a cash purchase and creates the matching cash egress", async () => {
    const result = await createProducto(productoForm());

    expect(result.success).toBe(true);
    expect(mocks.tx.compra.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        proveedorId: 3,
        usuarioId: 1,
        total: 200,
        origenPago: "EFECTIVO_CAJA",
        detalles: { create: expect.objectContaining({ productoId: 10, cantidad: 2, subtotal: 200 }) },
      }),
    }));
    expect(mocks.tx.movimientoCaja.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cajaId: 30, compraId: 50, tipo: "EGRESO", monto: 200 }),
    }));
    expect(mocks.tx.caja.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { totalVentas: { decrement: 200 } },
    });
  });

  it("forwards and persists transfer origin without touching cash totals", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(null);

    const result = await createProducto(
      productoForm({ origenPago: "TRANSFERENCIA_BANCARIA" })
    );

    expect(result.success).toBe(true);
    expect(mocks.tx.compra.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ origenPago: "TRANSFERENCIA_BANCARIA", total: 200 }),
    }));
    expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it("rejects cash initial stock without an open cash register before any write", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(null);

    const result = await createProducto(productoForm({ origenPago: "EFECTIVO_CAJA" }));

    expect(result.error).toBe(
      "No hay una caja abierta para registrar el pago en efectivo."
    );
    expect(mocks.tx.producto.create).not.toHaveBeenCalled();
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it("records the purchase even when no cash register is open", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce(null);

    const result = await createProducto(
      productoForm({ origenPago: "FONDOS_EXTERNOS" })
    );

    expect(result.success).toBe(true);
    expect(mocks.tx.producto.create).toHaveBeenCalledOnce();
    expect(mocks.tx.compra.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ origenPago: "FONDOS_EXTERNOS" }),
    }));
    expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it("revalidates products only after a successful transaction", async () => {
    mocks.tx.caja.findFirst.mockReset().mockResolvedValue({
      id: 30,
      estado: "ABIERTA",
      montoInicial: 500,
      totalVentas: 500,
    });
    const result = await createProducto(productoForm());

    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");

    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(session);
    mocks.transaction.mockRejectedValueOnce(new Error("transaction failed"));
    const failed = await createProducto(productoForm());

    expect(failed.error).toBeTruthy();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("ProductosTable purchase payment input", () => {
  it("renders PaymentDistribution for both initial stock and replenishment", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(currentDir, "../../components/tables/ProductosTable.tsx"),
      "utf8"
    );

    expect(source.match(/<PaymentDistribution/g)).toHaveLength(2);
    expect(source).toContain("onChange={setPayments}");
    expect(source).toContain('formData.set("pagos", JSON.stringify(validPayments))');
  });
});
