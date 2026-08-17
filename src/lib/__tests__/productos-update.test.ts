import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const tx = {
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    compra: {
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
  };

  return {
    tx,
    getSession: vi.fn(),
    requirePermission: vi.fn(),
    transaction: vi.fn(),
    revalidatePath: vi.fn(),
    saveFile: vi.fn(),
    deleteFile: vi.fn(),
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
  },
}));

vi.mock("@/lib/upload", () => ({
  saveFile: mocks.saveFile,
  deleteFile: mocks.deleteFile,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { updateProducto } from "../../actions/productos";

const session = {
  userId: 1,
  username: "admin",
  role: "ADMINISTRADOR",
  permissions: ["productos.editar"],
};

function productoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    nombre: "Kit transmisi?n",
    marca: "Honda",
    codigo: null,
    imagen: null,
    categoriaId: 2,
    proveedorId: 3,
    precioCompra: 100,
    precioVenta: 150,
    cantidad: 10,
    stockMinimo: 2,
    activo: true,
    marcaId: null,
    ...overrides,
  };
}

function productoForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    nombre: "Kit transmisi?n",
    marca: "Honda",
    codigo: "",
    imagen: "",
    categoriaId: "2",
    proveedorId: "3",
    precioCompra: "100",
    precioVenta: "150",
    cantidad: "10",
    stockMinimo: "2",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

function setupActionMocks(producto: Record<string, unknown> | null = productoBase()) {
  mocks.getSession.mockResolvedValue(session);
  mocks.requirePermission.mockResolvedValue(session);
  mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx));
  mocks.tx.producto.findUnique.mockResolvedValue(producto);
  mocks.tx.producto.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...productoBase(),
    ...data,
  }));
  mocks.tx.compra.create.mockResolvedValue({ id: 50 });
  mocks.tx.caja.findFirst.mockResolvedValue(null);
  mocks.tx.movimientoCaja.create.mockResolvedValue({ id: 70 });
  mocks.tx.caja.update.mockResolvedValue({ id: 30 });
  mocks.tx.cuentaFinanciera.findFirst.mockResolvedValue({
    id: 1,
    tipo: "BANCO",
    esPrincipal: true,
    activa: true,
    saldoInicial: 500_000,
    movimientos: [],
  });
  mocks.tx.movimientoFinanciero.create.mockResolvedValue({ id: 80 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  setupActionMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProductosTable edit modal submit contract", () => {
  it("associates the fixed footer submit button with the product form", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(currentDir, "../../components/tables/ProductosTable.tsx"), "utf8");

    expect(source).toContain('const PRODUCT_FORM_ID = "producto-form";');
    expect(source).toMatch(
      /<form\s+id=\{PRODUCT_FORM_ID\}\s+onSubmit=\{handleFormSubmit\}/
    );
    expect(source).toContain('<Button type="submit" form={PRODUCT_FORM_ID}');
    expect(source).not.toContain("closest('dialog')");
  });

  it("keeps server action errors visible in the modal instead of failing silently", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(currentDir, "../../components/tables/ProductosTable.tsx"), "utf8");

    expect(source).toContain("catch (error)");
    expect(source).toContain("setErrorMsg(error instanceof Error ? error.message");
  });
});

describe("updateProducto", () => {
  it("requires productos.editar on the server", async () => {
    const result = await updateProducto(10, productoForm());

    expect(result.success).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("productos.editar", session);
  });

  it("edits product data without modifying stock or creating purchase records", async () => {
    const result = await updateProducto(10, productoForm({ nombre: "Kit transmisi?n reforzado" }));

    expect(result.success).toBe(true);
    expect(mocks.tx.producto.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 10 },
      data: expect.objectContaining({ nombre: "Kit transmisi?n reforzado", cantidad: 10 }),
    }));
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
  });

  it("treats zero replenishment as a normal edit without purchase or cash movement", async () => {
    const result = await updateProducto(10, productoForm({ cantidad: "10" }));

    expect(result.success).toBe(true);
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.caja.findFirst).not.toHaveBeenCalled();
  });

  it("ignores stock and payment fields — la reposición pasa por SolicitudReposicion (D4)", async () => {
    mocks.tx.caja.findFirst.mockResolvedValueOnce({
      id: 30,
      estado: "ABIERTA",
      movimientos: [{ tipo: "INGRESO", monto: 1_000 }],
    });

    const result = await updateProducto(
      10,
      productoForm({
        cantidad: "12",
        origenPago: "EFECTIVO_CAJA",
        pagos: JSON.stringify([{ medio: "EFECTIVO_CAJA", monto: 200 }]),
      })
    );

    expect(result.success).toBe(true);
    // El stock se mantiene: se escribe el valor previo, nunca el del form.
    expect(mocks.tx.producto.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cantidad: 10 }),
    }));
    expect(mocks.tx.compra.create).not.toHaveBeenCalled();
    expect(mocks.tx.caja.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.movimientoCaja.create).not.toHaveBeenCalled();
    expect(mocks.tx.caja.update).not.toHaveBeenCalled();
  });

  it("returns a visible error when the product does not exist", async () => {
    setupActionMocks(null);

    const result = await updateProducto(999, productoForm());

    expect(result.error).toBe("Producto no encontrado");
    expect(mocks.tx.producto.update).not.toHaveBeenCalled();
  });

  it("returns a visible error for users without product edit permission", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("No tiene permisos para realizar esta acción."));

    const result = await updateProducto(10, productoForm());

    expect(result.error).toBe("No tiene permisos para realizar esta acción.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns a visible error for inactive users", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("Usuario inactivo o no encontrado."));

    const result = await updateProducto(10, productoForm());

    expect(result.error).toBe("Usuario inactivo o no encontrado.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("revalidates products after a successful edit", async () => {
    const result = await updateProducto(10, productoForm());

    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos");
  });
});
