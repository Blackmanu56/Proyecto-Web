/**
 * Lógica pura del ajuste histórico de Caja #0001 (reposiciones pagadas por banco)
 * y del origen de pago de compras.
 * Separada de scripts/ y de las server actions para poder testearse en vitest.
 */

export const AJUSTE_CAJA_0001_TOKENS = {
  reposicion8: "AJUSTE-CAJA-0001-REPOSICION-0008",
  reposicion9: "AJUSTE-CAJA-0001-REPOSICION-0009",
} as const;

export const AJUSTE_CAJA_0001_DESCRIPCIONES = {
  reposicion8:
    "Ajuste histórico realizado el 05/08/2026 — Reposición #8 del 01/06/2026 pagada mediante transferencia bancaria [AJUSTE-CAJA-0001-REPOSICION-0008]",
  reposicion9:
    "Ajuste histórico realizado el 05/08/2026 — Reposición #9 del 01/06/2026 pagada mediante transferencia bancaria [AJUSTE-CAJA-0001-REPOSICION-0009]",
} as const;

export const AJUSTE_CAJA_0001_EXPECTED = {
  cajaId: 1,
  totalVentas: -53400,
  displayedBalance: 46600,
  movementBalance: 46600,
  adjustmentDate: "2026-08-05",
} as const;

export interface CajaAjustePostStateInput {
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

export interface CajaAjustePostStateValues {
  totalVentas: number;
  displayedBalance: number;
  movementBalance: number;
  adjustmentMovementIds: number[];
}

function calendarDateInBuenosAires(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Valida el estado completo posterior a la corrección histórica de Caja #0001. */
export function assertCajaAjuste0001PostState(
  state: CajaAjustePostStateInput
): CajaAjustePostStateValues {
  const errors: string[] = [];
  const caja = state.caja;
  const compras = Array.isArray(state.compras) ? state.compras : [];
  const movimientos = Array.isArray(state.movimientos) ? state.movimientos : [];

  if (!caja || caja.id !== AJUSTE_CAJA_0001_EXPECTED.cajaId) {
    errors.push("Falta Caja #1");
  }

  const totalVentas = caja?.totalVentas ?? Number.NaN;
  const displayedBalance = caja
    ? caja.montoInicial + caja.totalVentas
    : Number.NaN;
  if (totalVentas !== AJUSTE_CAJA_0001_EXPECTED.totalVentas) {
    errors.push(`totalVentas=${totalVentas}`);
  }
  if (displayedBalance !== AJUSTE_CAJA_0001_EXPECTED.displayedBalance) {
    errors.push(`balance mostrado=${displayedBalance}`);
  }

  for (const expected of [
    { id: 8, total: 400000 },
    { id: 9, total: 1120000 },
  ]) {
    const matches = compras.filter((compra) => compra.id === expected.id);
    if (matches.length !== 1) {
      errors.push(`Compra ${expected.id}: cantidad=${matches.length}`);
      continue;
    }
    const compra = matches[0];
    if (compra.total !== expected.total) {
      errors.push(`Compra ${expected.id}: total=${compra.total}`);
    }
    if (compra.origenPago !== "TRANSFERENCIA_BANCARIA") {
      errors.push(`Compra ${expected.id}: origenPago=${compra.origenPago}`);
    }
  }

  // Validar egresos originales de compras 8 y 9
  for (const expected of [
    { compraId: 8, amount: 400000 },
    { compraId: 9, amount: 1120000 },
  ]) {
    const matches = movimientos.filter(
      (m) => m.compraId === expected.compraId
    );
    if (matches.length !== 1) {
      errors.push(
        `Egreso original compra ${expected.compraId}: cantidad=${matches.length}`
      );
      continue;
    }
    const egreso = matches[0];
    if (egreso.tipo !== "EGRESO") {
      errors.push(
        `Egreso original compra ${expected.compraId}: tipo=${egreso.tipo}`
      );
    }
    if (egreso.monto !== expected.amount) {
      errors.push(
        `Egreso original compra ${expected.compraId}: monto=${egreso.monto}`
      );
    }
  }

  const adjustmentMovementIds: number[] = [];
  for (const expected of [
    {
      token: AJUSTE_CAJA_0001_TOKENS.reposicion8,
      amount: 400000,
      description: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion8,
    },
    {
      token: AJUSTE_CAJA_0001_TOKENS.reposicion9,
      amount: 1120000,
      description: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion9,
    },
  ]) {
    const matches = movimientos.filter((movimiento) =>
      movimiento.descripcion.toLowerCase().includes(expected.token.toLowerCase())
    );
    if (matches.length !== 1) {
      errors.push(`${expected.token}: cantidad=${matches.length}`);
      continue;
    }

    const movimiento = matches[0];
    adjustmentMovementIds.push(movimiento.id);
    if (movimiento.tipo !== "INGRESO") {
      errors.push(`${expected.token}: tipo=${movimiento.tipo}`);
    }
    if (movimiento.monto !== expected.amount) {
      errors.push(`${expected.token}: monto=${movimiento.monto}`);
    }
    if (movimiento.descripcion !== expected.description) {
      errors.push(`${expected.token}: descripción no aprobada`);
    }
    const movementDate = calendarDateInBuenosAires(movimiento.fecha);
    if (movementDate !== AJUSTE_CAJA_0001_EXPECTED.adjustmentDate) {
      errors.push(`${expected.token}: fecha=${movementDate}`);
    }
  }

  const movementBalance = movimientos.reduce((balance, movimiento) => {
    if (movimiento.tipo === "INGRESO") return balance + movimiento.monto;
    if (movimiento.tipo === "EGRESO") return balance - movimiento.monto;
    errors.push(`Movimiento ${movimiento.id}: tipo inválido=${movimiento.tipo}`);
    return balance;
  }, 0);
  if (movementBalance !== AJUSTE_CAJA_0001_EXPECTED.movementBalance) {
    errors.push(`balance movimientos=${movementBalance}`);
  }
  if (movementBalance !== displayedBalance) {
    errors.push("balance de movimientos difiere del balance mostrado");
  }

  if (errors.length > 0) {
    throw new Error(`Estado corregido de Caja #0001 inválido: ${errors.join("; ")}`);
  }

  return { totalVentas, displayedBalance, movementBalance, adjustmentMovementIds };
}

export type EstadoAjuste = "none" | "partial" | "applied";

export function estadoAjusteReposiciones(
  movimientos: { descripcion?: string | null }[]
): EstadoAjuste {
  const descs = (movimientos || []).map((m) => (m.descripcion || "").toLowerCase());
  const has8 = descs.some((d) =>
    d.includes(AJUSTE_CAJA_0001_TOKENS.reposicion8.toLowerCase())
  );
  const has9 = descs.some((d) =>
    d.includes(AJUSTE_CAJA_0001_TOKENS.reposicion9.toLowerCase())
  );
  if (has8 && has9) return "applied";
  if (has8 || has9) return "partial";
  return "none";
}

export const ORIGENES_PAGO_COMPRA = [
  "EFECTIVO_CAJA",
  "TRANSFERENCIA_BANCARIA",
  "CUENTA_CORRIENTE_PROVEEDOR",
  "FONDOS_EXTERNOS",
] as const;

export type OrigenPagoCompraValue = (typeof ORIGENES_PAGO_COMPRA)[number];

export function esOrigenPagoValido(
  value: string | null | undefined
): value is OrigenPagoCompraValue {
  return !!value && (ORIGENES_PAGO_COMPRA as readonly string[]).includes(value);
}

/**
 * Decide si una reposición genera egreso de caja (movimiento + decremento de totalVentas).
 * Solo el efectivo de caja toca el cajón físico.
 * Null/undefined → true (comportamiento histórico previo, default EFECTIVO_CAJA).
 */
export function shouldCreateCajaEgreso(
  origenPago: string | null | undefined
): boolean {
  if (!origenPago) return true;
  return origenPago === "EFECTIVO_CAJA";
}
