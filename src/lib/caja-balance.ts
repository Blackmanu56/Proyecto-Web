export interface MovimientoFisicoCaja {
  tipo: string;
  monto: number;
}

export interface TotalesEfectivoFisico {
  totalIngresos: number;
  totalEgresos: number;
  efectivoEsperado: number;
}

export interface CajaActivaConMovimientos {
  movimientos: readonly MovimientoFisicoCaja[];
}

/**
 * Calcula el efectivo físico exclusivamente desde movimientos reales de Caja.
 * La apertura ya es un INGRESO, por lo que montoInicial no se suma nuevamente.
 */
export function calcularEfectivoFisico(
  movimientos: readonly MovimientoFisicoCaja[] | null | undefined
): TotalesEfectivoFisico {
  let totalIngresos = 0;
  let totalEgresos = 0;

  for (const movimiento of movimientos ?? []) {
    const monto = Number(movimiento?.monto);
    if (!Number.isFinite(monto)) continue;

    if (movimiento.tipo === "INGRESO") totalIngresos += monto;
    if (movimiento.tipo === "EGRESO") totalEgresos += monto;
  }

  return {
    totalIngresos,
    totalEgresos,
    efectivoEsperado: totalIngresos - totalEgresos,
  };
}

/** Fuente única para la tarjeta de Dashboard cuando existe una Caja activa. */
export function calcularEfectivoCajaActiva(
  caja: CajaActivaConMovimientos | null | undefined
): number {
  return caja
    ? calcularEfectivoFisico(caja.movimientos).efectivoEsperado
    : 0;
}
