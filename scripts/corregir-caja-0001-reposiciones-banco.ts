/**
 * Corrección histórica atómica e idempotente de Caja #0001.
 * NO ejecutar cuando el estado aprobado ya está aplicado.
 */

import { prisma } from "../src/lib/prisma";
import {
  AJUSTE_CAJA_0001_DESCRIPCIONES,
  assertCajaAjuste0001PostState,
  estadoAjusteReposiciones,
} from "../src/lib/caja-ajuste";

const CAJA_ID = 1;
const USUARIO_ID = 1;
const TOTAL_VENTAS_ESPERADO = -53400;
const FECHA_AJUSTE = new Date("2026-08-05T12:00:00.000-03:00");

const cajaSelect = { id: true, montoInicial: true, totalVentas: true } as const;
const compraSelect = { id: true, total: true, origenPago: true } as const;
const movimientoSelect = {
  id: true,
  compraId: true,
  tipo: true,
  monto: true,
  descripcion: true,
  fecha: true,
} as const;

async function main() {
  const resultado = await prisma.$transaction(async (tx) => {
    const caja = await tx.caja.findUnique({
      where: { id: CAJA_ID },
      select: cajaSelect,
    });
    if (!caja) throw new Error(`Caja ${CAJA_ID} no encontrada.`);

    const [compras, movimientos] = await Promise.all([
      tx.compra.findMany({
        where: { id: { in: [8, 9] } },
        select: compraSelect,
        orderBy: { id: "asc" },
      }),
      tx.movimientoCaja.findMany({
        where: { cajaId: CAJA_ID },
        select: movimientoSelect,
        orderBy: { id: "asc" },
      }),
    ]);

    const estado = estadoAjusteReposiciones(movimientos);
    if (estado === "applied") {
      const values = assertCajaAjuste0001PostState({ caja, compras, movimientos });
      return { aplicado: false as const, values };
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
      .reduce((sum, movimiento) => sum + movimiento.monto, 0);
    const egresos = movimientos
      .filter((movimiento) => movimiento.tipo === "EGRESO")
      .reduce((sum, movimiento) => sum + movimiento.monto, 0);
    const totalVentasNuevo = ingresosPostApertura - egresos + 1520000;
    if (totalVentasNuevo !== TOTAL_VENTAS_ESPERADO) {
      throw new Error(
        `totalVentas calculado ${totalVentasNuevo}; esperado ${TOTAL_VENTAS_ESPERADO}.`
      );
    }

    await tx.movimientoCaja.createMany({
      data: [
        {
          cajaId: CAJA_ID,
          usuarioId: USUARIO_ID,
          tipo: "INGRESO",
          monto: 400000,
          descripcion: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion8,
          fecha: FECHA_AJUSTE,
        },
        {
          cajaId: CAJA_ID,
          usuarioId: USUARIO_ID,
          tipo: "INGRESO",
          monto: 1120000,
          descripcion: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion9,
          fecha: FECHA_AJUSTE,
        },
      ],
    });
    await tx.compra.updateMany({
      where: { id: { in: [8, 9] } },
      data: { origenPago: "TRANSFERENCIA_BANCARIA" },
    });
    await tx.caja.update({
      where: { id: CAJA_ID },
      data: { totalVentas: totalVentasNuevo },
    });

    const [cajaFinal, comprasFinales, movimientosFinales] = await Promise.all([
      tx.caja.findUnique({ where: { id: CAJA_ID }, select: cajaSelect }),
      tx.compra.findMany({
        where: { id: { in: [8, 9] } },
        select: compraSelect,
        orderBy: { id: "asc" },
      }),
      tx.movimientoCaja.findMany({
        where: { cajaId: CAJA_ID },
        select: movimientoSelect,
        orderBy: { id: "asc" },
      }),
    ]);
    const values = assertCajaAjuste0001PostState({
      caja: cajaFinal,
      compras: comprasFinales,
      movimientos: movimientosFinales,
    });
    return { aplicado: true as const, values };
  });

  console.log(
    resultado.aplicado
      ? "[AJUSTE] ✅ Corrección aplicada y validada."
      : "[AJUSTE] ⏭ already applied; estado completo validado, sin escrituras."
  );
  console.log(resultado.values);
}

main()
  .catch((error) => {
    console.error("[AJUSTE] ❌", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
