/**
 * Crea un snapshot local mínimo de Caja #0001 únicamente después de validar
 * que la corrección histórica está completa y es exacta.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { assertCajaAjuste0001PostState } from "../src/lib/caja-ajuste";

async function main() {
  const [caja, compras, movimientos, detalles] = await Promise.all([
    prisma.caja.findUnique({
      where: { id: 1 },
      select: { id: true, montoInicial: true, totalVentas: true },
    }),
    prisma.compra.findMany({
      where: { id: { in: [8, 9] } },
      select: { id: true, total: true, fecha: true, origenPago: true },
      orderBy: { id: "asc" },
    }),
    prisma.movimientoCaja.findMany({
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
    prisma.detalleCompra.findMany({
      where: { compraId: { in: [8, 9] } },
      select: {
        id: true,
        compraId: true,
        productoId: true,
        cantidad: true,
        costoUnitario: true,
        subtotal: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const values = assertCajaAjuste0001PostState({ caja, compras, movimientos });
  const relevantMovementIds = new Set(values.adjustmentMovementIds);
  const relevantMovements = movimientos.filter(
    (movimiento) =>
      relevantMovementIds.has(movimiento.id) ||
      movimiento.compraId === 8 ||
      movimiento.compraId === 9
  );

  const generatedAt = new Date().toISOString();
  const snapshot = {
    generatedAt,
    caja,
    compras,
    movimientos: relevantMovements,
    detallesCompra: detalles,
  };
  const filePath = join(
    __dirname,
    `backup-caja-0001-${generatedAt.replace(/[:.]/g, "-")}.json`
  );

  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`[BACKUP] ✅ ${filePath}`);
}

main()
  .catch((error) => {
    console.error("[BACKUP] ❌", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
