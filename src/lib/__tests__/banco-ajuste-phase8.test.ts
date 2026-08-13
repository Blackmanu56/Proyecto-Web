import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    cuentaFinanciera: { findFirst: vi.fn() },
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
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { registrarAjusteBanco } from "../../actions/caja";

const ADMIN_SESSION = { userId: 7, role: "ADMINISTRADOR", permissions: ["caja.ver"] };
const VENTAS_SESSION = { userId: 8, role: "ENCARGADO_VENTAS", permissions: ["caja.ver"] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue(ADMIN_SESSION);
  mocks.requirePermission.mockResolvedValue(ADMIN_SESSION);
  mocks.transaction.mockImplementation(
    (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
  );
  mocks.tx.cuentaFinanciera.findFirst.mockResolvedValue({
    id: 1,
    nombre: "Banco principal",
    saldoInicial: 0,
    movimientos: [],
  });
  mocks.tx.movimientoFinanciero.create.mockResolvedValue({ id: 101 });
});

afterEach(() => vi.restoreAllMocks());

describe("Parte 8 — ajuste auditable de Banco", () => {
  it("A) Banco 0 + ingreso 500k → saldo 500k", async () => {
    const result = await registrarAjusteBanco({
      tipo: "INGRESO",
      monto: 500_000,
      motivo: "Saldo inicial Banco",
    });

    expect(result).toEqual({
      success: true,
      saldoActual: 0,
      saldoResultante: 500_000,
    });
    expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cuentaFinancieraId: 1,
        tipo: "INGRESO",
        monto: 500_000,
        descripcion: "Saldo inicial Banco",
        usuarioId: 7,
        referencia: null,
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/caja");
  });

  it("B) Banco 500k - egreso 100k → saldo 400k", async () => {
    mocks.tx.cuentaFinanciera.findFirst.mockResolvedValueOnce({
      id: 1,
      nombre: "Banco principal",
      saldoInicial: 500_000,
      movimientos: [],
    });

    const result = await registrarAjusteBanco({
      tipo: "EGRESO",
      monto: 100_000,
      motivo: "Corrección bancaria",
    });

    expect(result).toEqual({
      success: true,
      saldoActual: 500_000,
      saldoResultante: 400_000,
    });
  });

  it("C) Egreso > saldo → rechazado", async () => {
    mocks.tx.cuentaFinanciera.findFirst.mockResolvedValueOnce({
      id: 1,
      nombre: "Banco principal",
      saldoInicial: 80_000,
      movimientos: [],
    });

    const result = await registrarAjusteBanco({
      tipo: "EGRESO",
      monto: 100_000,
      motivo: "Ajuste mayor al saldo",
    });

    expect(result).toEqual({
      success: false,
      error: "El egreso supera el saldo disponible del Banco.",
    });
    expect(mocks.tx.movimientoFinanciero.create).not.toHaveBeenCalled();
  });

  it("D) Monto 0 o negativo → rechazado", async () => {
    await expect(
      registrarAjusteBanco({ tipo: "INGRESO", monto: 0, motivo: "Inválido" })
    ).resolves.toEqual({
      success: false,
      error: "El monto debe ser mayor a 0.",
    });

    await expect(
      registrarAjusteBanco({ tipo: "EGRESO", monto: -10, motivo: "Inválido" })
    ).resolves.toEqual({
      success: false,
      error: "El monto debe ser mayor a 0.",
    });
  });

  it("E) Motivo vacío → rechazado", async () => {
    const result = await registrarAjusteBanco({
      tipo: "INGRESO",
      monto: 100_000,
      motivo: "   ",
    });

    expect(result).toEqual({
      success: false,
      error: "Debe ingresar un motivo para el ajuste.",
    });
  });

  it("F) Usuario sin permiso de administrador → rechazado", async () => {
    mocks.getSession.mockResolvedValueOnce(VENTAS_SESSION);
    mocks.requirePermission.mockResolvedValueOnce(VENTAS_SESSION);

    const result = await registrarAjusteBanco({
      tipo: "INGRESO",
      monto: 100_000,
      motivo: "Intento sin permiso",
    });

    expect(result).toEqual({
      success: false,
      error: "Solo un administrador puede ajustar el Banco.",
    });
    expect(mocks.tx.movimientoFinanciero.create).not.toHaveBeenCalled();
  });
});
