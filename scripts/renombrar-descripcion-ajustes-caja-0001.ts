/** Renombra únicamente descripciones históricas; no ejecutar sobre el estado aprobado. */

import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import {
  AJUSTE_CAJA_0001_DESCRIPCIONES,
  AJUSTE_CAJA_0001_TOKENS,
  assertCajaAjuste0001PostState,
  estadoAjusteReposiciones,
} from "../src/lib/caja-ajuste";

const expectedByToken = [
  {
    token: AJUSTE_CAJA_0001_TOKENS.reposicion8,
    description: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion8,
  },
  {
    token: AJUSTE_CAJA_0001_TOKENS.reposicion9,
    description: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion9,
  },
] as const;

async function main() {
  const resultado = await prisma.$transaction(async (tx) => {
    const [caja, compras, movimientos] = await Promise.all([
      tx.caja.findUnique({
        where: { id: 1 },
        select: { id: true, montoInicial: true, totalVentas: true },
      }),
      tx.compra.findMany({
        where: { id: { in: [8, 9] } },
        select: { id: true, total: true, origenPago: true },
        orderBy: { id: "asc" },
      }),
      tx.movimientoCaja.findMany({
        where: { cajaId: 1 },
        select: {
          id: true,
          compraId: true,
          tipo: true,
          monto: true,
          descripcion: true,
          fecha: true,
        },
        orderBy: { id: "asc" },
      }),
    ]);

    if (estadoAjusteReposiciones(movimientos) !== "applied") {
      throw new Error("Los dos tokens de ajuste deben existir antes del renombre.");
    }

    const targets = expectedByToken.map((expected) => {
      const matches = movimientos.filter((movimiento) =>
        movimiento.descripcion.toLowerCase().includes(expected.token.toLowerCase())
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
      const target = targets.find((candidate) => candidate.movimiento.id === movimiento.id);
      return target ? { ...movimiento, descripcion: target.description } : movimiento;
    });
    assertCajaAjuste0001PostState({ caja, compras, movimientos: proposedMovements });

    const backupPath = `scripts/backup-descripciones-ajustes-caja-0001-${Date.now()}.json`;
    writeFileSync(
      backupPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          caja,
          movimientos: targets.map(({ movimiento }) => movimiento),
        },
        null,
        2
      ),
      "utf8"
    );

    for (const target of targets) {
      if (target.movimiento.descripcion === target.description) continue;
      await tx.movimientoCaja.update({
        where: { id: target.movimiento.id },
        data: { descripcion: target.description },
      });
    }

    return {
      changed: true as const,
      backupPath,
      values: assertCajaAjuste0001PostState({
        caja,
        compras,
        movimientos: proposedMovements,
      }),
    };
  });

  if (!resultado.changed) {
    console.log("[RENAME] ⏭ Descripciones aprobadas; sin backup ni escrituras.");
    return;
  }
  console.log(`[RENAME] ✅ Descripciones actualizadas. Backup: ${resultado.backupPath}`);
}

main()
  .catch((error) => {
    console.error("[RENAME] ❌", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
