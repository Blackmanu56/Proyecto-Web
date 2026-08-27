import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    caja: { findUnique: vi.fn(), update: vi.fn() },
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
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { cerrarCaja } from "../../actions/caja";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue({ userId: 9, role: "ADMINISTRADOR" });
  mocks.requirePermission.mockResolvedValue({ userId: 9, role: "ADMINISTRADOR" });
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.caja.findUnique.mockResolvedValue({
    id: 4,
    estado: "ABIERTA",
    movimientos: [
      { tipo: "INGRESO", monto: 100_000 },
      { tipo: "INGRESO", monto: 50_000 },
      { tipo: "EGRESO", monto: 20_000 },
      { tipo: "EGRESO", monto: 10_000 },
    ],
  });
  mocks.tx.caja.update.mockResolvedValue({ id: 4, estado: "CERRADA" });
});

afterEach(() => vi.restoreAllMocks());

describe("Phase 1 Caja closing", () => {
  it("persists counted cash and observation and returns the physical difference", async () => {
    const result = await cerrarCaja(4, 118_000, "Faltante verificado");

    expect(result).toMatchObject({ success: true, efectivoEsperado: 120_000, diferencia: -2_000 });
    expect(mocks.tx.caja.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        estado: "CERRADA",
        fechaCierre: expect.any(Date),
        totalContado: 118_000,
        observacionCierre: "Faltante verificado",
      },
    });
  });

  it.each([null, undefined, Number.NaN, -1])("rejects an invalid counted amount: %s", async (value) => {
    const result = await cerrarCaja(4, value as number);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected Caja closing validation to fail");
    expect(result.error).toBe("Debe ingresar un monto contado válido para cerrar la caja.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("stores an empty observation as null", async () => {
    await cerrarCaja(4, 120_000, "   ");

    expect(mocks.tx.caja.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ observacionCierre: null }),
    }));
  });
});
