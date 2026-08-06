import { describe, expect, it, vi } from "vitest";
import {
  runCaja0001BackupWorkflow,
  runCaja0001CorrectionWorkflow,
  runCaja0001RenameWorkflow,
  runCaja0001VerifierWorkflow,
  type Caja0001State,
} from "../caja-ajuste-workflows";
import { AJUSTE_CAJA_0001_DESCRIPCIONES } from "../caja-ajuste";

function appliedState(): Caja0001State {
  return {
    caja: { id: 1, montoInicial: 100000, totalVentas: -53400 },
    compras: [
      { id: 8, total: 400000, origenPago: "TRANSFERENCIA_BANCARIA" },
      { id: 9, total: 1120000, origenPago: "TRANSFERENCIA_BANCARIA" },
    ],
    movimientos: [
      { id: 1, compraId: null, tipo: "INGRESO", monto: 100000, descripcion: "Saldo inicial de apertura", fecha: new Date("2026-06-01T12:00:00Z") },
      { id: 12, compraId: 8, tipo: "EGRESO", monto: 400000, descripcion: "Reposicion 8", fecha: new Date("2026-06-01T12:00:00Z") },
      { id: 13, compraId: 9, tipo: "EGRESO", monto: 1120000, descripcion: "Reposicion 9", fecha: new Date("2026-06-01T12:00:00Z") },
      { id: 20, compraId: null, tipo: "EGRESO", monto: 53400, descripcion: "Otros movimientos", fecha: new Date("2026-06-01T13:00:00Z") },
      { id: 79, compraId: null, tipo: "INGRESO", monto: 400000, descripcion: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion8, fecha: new Date("2026-08-05T12:00:00-03:00") },
      { id: 80, compraId: null, tipo: "INGRESO", monto: 1120000, descripcion: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion9, fecha: new Date("2026-08-05T12:00:00-03:00") },
    ],
  };
}

describe("Caja #0001 direct workflows", () => {
  it("treats an already-applied correction as a validated no-op", async () => {
    const tx = {
      readState: vi.fn().mockResolvedValue(appliedState()),
      createAdjustments: vi.fn(),
      updatePurchaseOrigins: vi.fn(),
      updateCajaTotal: vi.fn(),
    };
    const transaction = vi.fn(async (callback) => callback(tx));

    const result = await runCaja0001CorrectionWorkflow({ transaction });

    expect(result.applied).toBe(false);
    expect(tx.createAdjustments).not.toHaveBeenCalled();
    expect(tx.updatePurchaseOrigins).not.toHaveBeenCalled();
    expect(tx.updateCajaTotal).not.toHaveBeenCalled();
  });

  it("propagates a correction transaction failure and performs no later writes", async () => {
    const before = appliedState();
    before.compras.forEach((compra) => { compra.origenPago = "EFECTIVO_CAJA"; });
    before.movimientos = before.movimientos.filter((movimiento) => movimiento.id < 79);
    before.caja!.totalVentas = -1573400;
    const tx = {
      readState: vi.fn().mockResolvedValue(before),
      createAdjustments: vi.fn().mockRejectedValue(new Error("write failed")),
      updatePurchaseOrigins: vi.fn(),
      updateCajaTotal: vi.fn(),
    };
    const transaction = vi.fn(async (callback) => callback(tx));

    await expect(runCaja0001CorrectionWorkflow({ transaction })).rejects.toThrow("write failed");
    expect(tx.updatePurchaseOrigins).not.toHaveBeenCalled();
    expect(tx.updateCajaTotal).not.toHaveBeenCalled();
  });

  it("validates backup state before writing a file", async () => {
    const invalid = appliedState();
    invalid.movimientos.find((movement) => movement.id === 12)!.compraId = null;
    const writeBackup = vi.fn();

    await expect(runCaja0001BackupWorkflow({
      readSnapshot: vi.fn().mockResolvedValue({ ...invalid, detallesCompra: [] }),
      writeBackup,
    })).rejects.toThrow();
    expect(writeBackup).not.toHaveBeenCalled();
  });

  it("returns rename no-op for exact descriptions before writing a backup", async () => {
    const writeBackup = vi.fn();
    const updateDescription = vi.fn();
    const transaction = vi.fn(async (callback) => callback({
      readState: vi.fn().mockResolvedValue(appliedState()),
      updateDescription,
    }));

    const result = await runCaja0001RenameWorkflow({ transaction, writeBackup });

    expect(result.changed).toBe(false);
    expect(writeBackup).not.toHaveBeenCalled();
    expect(updateDescription).not.toHaveBeenCalled();
  });

  it("throws for invalid read-only verification and succeeds for valid state", async () => {
    const invalid = appliedState();
    invalid.movimientos.find((movement) => movement.id === 13)!.compraId = null;

    await expect(runCaja0001VerifierWorkflow({
      readState: vi.fn().mockResolvedValue(invalid),
    })).rejects.toThrow();

    await expect(runCaja0001VerifierWorkflow({
      readState: vi.fn().mockResolvedValue(appliedState()),
    })).resolves.toMatchObject({ movementBalance: 46600 });
  });
});
