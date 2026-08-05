import {
  assertCajaAjuste0001PostState,
  estadoAjusteReposiciones,
  AJUSTE_CAJA_0001_DESCRIPCIONES,
  AJUSTE_CAJA_0001_TOKENS,
  type CajaAjustePostStateValues,
} from "./caja-ajuste";

export interface Caja0001State {
  caja: { id: number; montoInicial: number; totalVentas: number } | null;
  compras: { id: number; total: number; origenPago: string }[];
  movimientos: {
    id: number;
    compraId?: number | null;
    tipo: string;
    monto: number;
    descripcion: string;
    fecha: Date | string;
  }[];
}

export type DetalleCompraItem = {
  id: number;
  compraId: number;
  productoId: number;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
};

export interface CorrectionTx {
  readState: () => Promise<Caja0001State>;
  createAdjustments: (adjustments: Array<{ tipo: string; monto: number; descripcion: string; fecha: Date }>) => Promise<unknown>;
  updatePurchaseOrigins: (compraIds: number[], origen: string) => Promise<unknown>;
  updateCajaTotal: (total: number) => Promise<unknown>;
  updateDescription?: (movimientoId: number, descripcion: string) => Promise<unknown>;
}

export async function runCaja0001VerifierWorkflow(deps: {
  readState: () => Promise<Caja0001State>;
}): Promise<CajaAjustePostStateValues> {
  const state = await deps.readState();
  return assertCajaAjuste0001PostState(state);
}

export async function runCaja0001BackupWorkflow(deps: {
  readSnapshot: () => Promise<Caja0001State & { detallesCompra: DetalleCompraItem[] }>;
  writeBackup: (snapshot: unknown) => Promise<void> | void;
}): Promise<{ backup: unknown }> {
  const snapshot = await deps.readSnapshot();
  
  const values = assertCajaAjuste0001PostState({
    caja: snapshot.caja,
    compras: snapshot.compras,
    movimientos: snapshot.movimientos,
  });

  const relevantMovementIds = new Set(values.adjustmentMovementIds);
  const relevantMovements = snapshot.movimientos.filter(
    (m) =>
      relevantMovementIds.has(m.id) ||
      m.compraId === 8 ||
      m.compraId === 9
  );

  const generatedAt = new Date().toISOString();
  const backup = {
    generatedAt,
    caja: snapshot.caja,
    compras: snapshot.compras,
    movimientos: relevantMovements,
    detallesCompra: snapshot.detallesCompra,
  };

  await deps.writeBackup(backup);
  return { backup };
}

export async function runCaja0001RenameWorkflow<T extends { readState: () => Promise<Caja0001State>; updateDescription: (id: number, desc: string) => Promise<unknown> }>(deps: {
  transaction: (callback: (tx: T) => Promise<unknown>) => Promise<unknown>;
  writeBackup: (backup: unknown) => Promise<void> | void;
}): Promise<{ changed: boolean; backupPath?: string; values: CajaAjustePostStateValues }> {
  const result = await deps.transaction(async (tx) => {
    const { caja, compras, movimientos } = await tx.readState();

    if (estadoAjusteReposiciones(movimientos) !== "applied") {
      throw new Error("Los dos tokens de ajuste deben existir antes del renombre.");
    }

    const expectedByToken = [
      {
        token: AJUSTE_CAJA_0001_TOKENS.reposicion8,
        description: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion8,
      },
      {
        token: AJUSTE_CAJA_0001_TOKENS.reposicion9,
        description: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion9,
      },
    ];

    const targets = expectedByToken.map((expected) => {
      const matches = movimientos.filter((m) =>
        m.descripcion.toLowerCase().includes(expected.token.toLowerCase())
      );
      if (matches.length !== 1) {
        throw new Error(`${expected.token}: se encontró ${matches.length} veces.`);
      }
      return { ...expected, movimiento: matches[0] };
    });

    const alreadyApproved = targets.every(
      (target) => target.movimiento.descripcion === target.description
    );
    if (alreadyApproved) {
      const values = assertCajaAjuste0001PostState({ caja, compras, movimientos });
      return { changed: false as const, values };
    }

    const proposedMovements = movimientos.map((movimiento) => {
      const target = targets.find((t) => t.movimiento.id === movimiento.id);
      return target ? { ...movimiento, descripcion: target.description } : movimiento;
    });
    assertCajaAjuste0001PostState({ caja, compras, movimientos: proposedMovements });

    const backupPath = `scripts/backup-descripciones-ajustes-caja-0001-${Date.now()}.json`;
    await deps.writeBackup({
      generatedAt: new Date().toISOString(),
      caja,
      movimientos: targets.map(({ movimiento }) => movimiento),
    });

    for (const target of targets) {
      if (target.movimiento.descripcion === target.description) continue;
      await tx.updateDescription(target.movimiento.id, target.description);
    }

    const values = assertCajaAjuste0001PostState({
      caja,
      compras,
      movimientos: proposedMovements,
    });

    return {
      changed: true as const,
      backupPath,
      values,
    };
  });

  return result as { changed: boolean; backupPath?: string; values: CajaAjustePostStateValues };
}

export async function runCaja0001CorrectionWorkflow<T extends CorrectionTx>(deps: {
  transaction: (callback: (tx: T) => Promise<unknown>) => Promise<unknown>;
}): Promise<{ applied: boolean; values: CajaAjustePostStateValues }> {
  const result = await deps.transaction(async (tx) => {
    const { caja, compras, movimientos } = await tx.readState();

    const estado = estadoAjusteReposiciones(movimientos);
    if (estado === "applied") {
      const values = assertCajaAjuste0001PostState({ caja, compras, movimientos });
      return { applied: false as const, values };
    }
    if (estado === "partial") {
      throw new Error("Estado parcial de tokens; no se aplica ninguna escritura.");
    }

    const compra8 = compras.find((compra) => compra.id === 8);
    const compra9 = compras.find((compra) => compra.id === 9);
    if (!compra8 || compra8.total !== 400000) {
      throw new Error(`Compra 8 inválida: ${compra8?.total}`);
    }
    if (!compra9 || compra9.total !== 1120000) {
      throw new Error(`Compra 9 inválida: ${compra9?.total}`);
    }
    if (
      compra8.origenPago !== "EFECTIVO_CAJA" ||
      compra9.origenPago !== "EFECTIVO_CAJA"
    ) {
      throw new Error("Origen de pago previo inesperado; no se aplica la corrección.");
    }

    const apertura = movimientos.find((movimiento) =>
      movimiento.descripcion.toLowerCase().startsWith("saldo inicial de apertura")
    );
    const ingresosPostApertura = movimientos
      .filter(
        (movimiento) =>
          movimiento.tipo === "INGRESO" && movimiento.id !== apertura?.id
      )
      .reduce((sum: number, movimiento) => sum + movimiento.monto, 0);
    const egresos = movimientos
      .filter((movimiento) => movimiento.tipo === "EGRESO")
      .reduce((sum: number, movimiento) => sum + movimiento.monto, 0);
    const totalVentasNuevo = ingresosPostApertura - egresos + 1520000;
    
    const TOTAL_VENTAS_ESPERADO = -53400;
    if (totalVentasNuevo !== TOTAL_VENTAS_ESPERADO) {
      throw new Error(
        `totalVentas calculated ${totalVentasNuevo}; esperado ${TOTAL_VENTAS_ESPERADO}.`
      );
    }

    const FECHA_AJUSTE = new Date("2026-08-05T12:00:00.000-03:00");
    await tx.createAdjustments([
      {
        tipo: "INGRESO",
        monto: 400000,
        descripcion: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion8,
        fecha: FECHA_AJUSTE,
      },
      {
        tipo: "INGRESO",
        monto: 1120000,
        descripcion: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion9,
        fecha: FECHA_AJUSTE,
      },
    ]);

    await tx.updatePurchaseOrigins([8, 9], "TRANSFERENCIA_BANCARIA");
    await tx.updateCajaTotal(totalVentasNuevo);

    const finalState = await tx.readState();
    const values = assertCajaAjuste0001PostState(finalState);
    return { applied: true as const, values };
  });

  return result as { applied: boolean; values: CajaAjustePostStateValues };
}
