/** Verificación estricta y de solo lectura del estado corregido de Caja #0001. */

import { prisma } from "../src/lib/prisma";
import { assertCajaAjuste0001PostState } from "../src/lib/caja-ajuste";

async function main() {
  const [caja, compras, movimientos] = await Promise.all([
    prisma.caja.findUnique({
      where: { id: 1 },
      select: { id: true, montoInicial: true, totalVentas: true },
    }),
    prisma.compra.findMany({
      where: { id: { in: [8, 9] } },
      select: { id: true, total: true, origenPago: true },
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
  ]);

  const values = assertCajaAjuste0001PostState({ caja, compras, movimientos });
  const ajustes = movimientos.filter((movimiento) =>
    values.adjustmentMovementIds.includes(movimiento.id)
  );

  console.log("── VERIFICACIÓN ESTRICTA CAJA #0001 ──");
  console.log(`totalVentas=${values.totalVentas}`);
  console.log(`balanceMostrado=${values.displayedBalance}`);
  console.log(`balanceMovimientos=${values.movementBalance}`);
  for (const compra of compras) {
    console.log(`compra${compra.id}.origenPago=${compra.origenPago}`);
  }
  for (const ajuste of ajustes) {
    console.log(
      `movimiento${ajuste.id}=${ajuste.tipo}|${ajuste.monto}|${ajuste.fecha.toISOString()}|${ajuste.descripcion}`
    );
  }
}

main()
  .catch((error) => {
    console.error("[VERIFY] ❌", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
