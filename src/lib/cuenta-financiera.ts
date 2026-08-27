/**
 * Helpers puros para cuentas financieras.
 * Sin dependencia de Prisma Client — mismas convenciones que caja-balance.ts.
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MovimientoFinancieroInput {
  tipo: string;
  monto: number;
}

export interface CuentaFinancieraSaldo {
  saldoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoActual: number;
}

export interface TotalDisponibleInput {
  efectivoFisico: number;
  saldoBanco: number;
}

export interface CuentaFinancieraBasica {
  tipo: string;
  esPrincipal: boolean;
  id?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calcula el saldo actual de una CuentaFinanciera.
 *
 * saldo = saldoInicial + ingresos − egresos
 *
 * El saldo se obtiene del ledger (movimientos), no de un campo persistido.
 * Esto evita inconsistencias si se olvida actualizar saldoActual en algún flujo.
 */
export function calcularSaldoCuentaFinanciera(
  saldoInicial: number,
  movimientos: readonly MovimientoFinancieroInput[] | null | undefined
): CuentaFinancieraSaldo {
  const safeInicial = Number(saldoInicial);
  const base = Number.isFinite(safeInicial) ? safeInicial : 0;

  let totalIngresos = 0;
  let totalEgresos = 0;

  for (const movimiento of movimientos ?? []) {
    const monto = Number(movimiento?.monto);
    if (!Number.isFinite(monto)) continue;

    if (movimiento.tipo === "INGRESO") totalIngresos += monto;
    if (movimiento.tipo === "EGRESO") totalEgresos += monto;
  }

  return {
    saldoInicial: base,
    totalIngresos,
    totalEgresos,
    saldoActual: base + totalIngresos - totalEgresos,
  };
}

/**
 * Calcula el total disponible del negocio.
 *
 * Total disponible = Efectivo físico (Caja) + Saldo Banco
 *
 * Las cuentas POR_ACREDITAR NO se incluyen porque el dinero
 * todavía no está efectivamente disponible en Banco.
 */
export function calcularTotalDisponible(
  input: TotalDisponibleInput
): number {
  const efectivo = Number(input?.efectivoFisico);
  const banco = Number(input?.saldoBanco);
  return (Number.isFinite(efectivo) ? efectivo : 0) +
    (Number.isFinite(banco) ? banco : 0);
}

// ─── Resolución de destino financiero ────────────────────────────────────────

export interface DestinoFinanciero {
  cuentaFinancieraId: number;
  tipo: string;
}

/**
 * Resuelve la cuenta financiera destino según el método de pago.
 *
 * EFECTIVO → null (se maneja por MovimientoCaja, no financiero)
 * TRANSFERENCIA / TARJETA_DEBITO → Banco principal
 * TARJETA_CREDITO → cuenta POR_ACREDITAR
 * Total $0 → null (no se crea movimiento neutral)
 *
 * Lanza Error si el método requiere cuenta financiera y no existe.
 */
export function resolverDestinoFinanciero(
  metodoPago: string,
  totalFinal: number,
  cuentaBanco: { id: number } | null,
  cuentaPorAcreditar: { id: number } | null
): DestinoFinanciero | null {
  if (totalFinal <= 0) return null;
  if (metodoPago === "EFECTIVO") return null;

  if (metodoPago === "TRANSFERENCIA" || metodoPago === "TARJETA_DEBITO") {
    if (!cuentaBanco) {
      throw new Error("No hay una cuenta bancaria principal configurada.");
    }
    return { cuentaFinancieraId: cuentaBanco.id, tipo: "BANCO" };
  }

  if (metodoPago === "TARJETA_CREDITO") {
    if (!cuentaPorAcreditar) {
      throw new Error("No hay una cuenta de tarjetas por acreditar configurada.");
    }
    return { cuentaFinancieraId: cuentaPorAcreditar.id, tipo: "POR_ACREDITAR" };
  }

  // Método no reconocido financieramente — sin movimiento
  return null;
}

// ─── Validaciones ────────────────────────────────────────────────────────────

/**
 * Valida que no exista ya un Banco principal.
 * Para usar al crear o editar CuentaFinanciera con tipo=BANCO y esPrincipal=true.
 *
 * La base de datos también lo previene con el índice parcial único
 * idx_one_banco_principal, pero esta validación permite dar un mensaje
 * claro en UI antes de llegar al error de PG.
 */
export function validarBancoPrincipal(
  cuentas: readonly CuentaFinancieraBasica[],
  excludedId?: number
): { valido: boolean; motivo?: string } {
  const existente = cuentas.find(
    (c) =>
      c.tipo === "BANCO" &&
      c.esPrincipal &&
      (excludedId === undefined || c.id !== excludedId)
  );
  if (existente) {
    return {
      valido: false,
      motivo: `Ya existe un Banco principal (id: ${existente.id}). Solo puede haber uno.`,
    };
  }
  return { valido: true };
}

// ─── Saldos financieros para UI ─────────────────────────────────────────────

export interface CuentaConSaldo {
  saldoInicial: number;
  movimientos: readonly MovimientoFinancieroInput[] | null | undefined;
}

export interface MovimientoFinancieroConFechaInput extends MovimientoFinancieroInput {
  fecha: Date | string;
}

export interface CuentaConSaldoPeriodo {
  saldoInicial: number;
  movimientos: readonly MovimientoFinancieroConFechaInput[] | null | undefined;
}

export interface SaldosFinancieros {
  banco: number;
  porAcreditar: number;
}

export interface ResumenBancoPeriodo {
  inicial: number;
  ingresos: number;
  egresos: number;
  saldo: number;
}

/**
 * Calcula el saldo total de un conjunto de cuentas financieras.
 * Útil para sumar varias cuentas POR_ACREDITAR en el futuro.
 */
export function sumarSaldosCuentas(
  cuentas: readonly CuentaConSaldo[]
): number {
  let total = 0;
  for (const cuenta of cuentas) {
    const saldo = calcularSaldoCuentaFinanciera(
      cuenta.saldoInicial,
      cuenta.movimientos
    ).saldoActual;
    if (Number.isFinite(saldo) && saldo > 0) {
      total += saldo;
    }
  }
  return total;
}

/**
 * Calcula los saldos financieros para el resumen de Caja.
 * Banco = saldo de la cuenta BANCO principal activa.
 * Por acreditar = suma de saldos de cuentas POR_ACREDITAR activas.
 * Total disponible = Efectivo + Banco (NO incluye Por acreditar).
 */
export function calcularSaldosFinancieros(
  cuentasBanco: readonly CuentaConSaldo[],
  cuentasPorAcreditar: readonly CuentaConSaldo[],
  efectivoFisico: number
): SaldosFinancieros & { efectivoFisico: number; totalDisponible: number } {
  const banco = sumarSaldosCuentas(cuentasBanco);
  const porAcreditar = sumarSaldosCuentas(cuentasPorAcreditar);
  const safeEfectivo = Number.isFinite(efectivoFisico) ? efectivoFisico : 0;
  const totalDisponible = safeEfectivo + banco;

  return { efectivoFisico: safeEfectivo, banco, porAcreditar, totalDisponible };
}

export function calcularResumenBancoPeriodo(
  cuentasBanco: readonly CuentaConSaldoPeriodo[],
  fechaDesde?: Date | string | null
): ResumenBancoPeriodo {
  const inicio = fechaDesde ? new Date(fechaDesde).getTime() : null;

  return cuentasBanco.reduce<ResumenBancoPeriodo>(
    (totales, cuenta) => {
      const baseInicial = Number.isFinite(cuenta.saldoInicial) ? cuenta.saldoInicial : 0;
      let inicial = baseInicial;
      let ingresos = 0;
      let egresos = 0;

      for (const movimiento of cuenta.movimientos ?? []) {
        const monto = Number(movimiento?.monto);
        if (!Number.isFinite(monto)) continue;

        const fecha = new Date(movimiento.fecha).getTime();
        const vaAntesDelPeriodo = inicio !== null && Number.isFinite(fecha) && fecha < inicio;

        if (vaAntesDelPeriodo) {
          if (movimiento.tipo === "INGRESO") inicial += monto;
          if (movimiento.tipo === "EGRESO") inicial -= monto;
          continue;
        }

        if (movimiento.tipo === "INGRESO") ingresos += monto;
        if (movimiento.tipo === "EGRESO") egresos += monto;
      }

      totales.inicial += inicial;
      totales.ingresos += ingresos;
      totales.egresos += egresos;
      totales.saldo += inicial + ingresos - egresos;
      return totales;
    },
    { inicial: 0, ingresos: 0, egresos: 0, saldo: 0 }
  );
}

// ─── Impacto financiero por movimiento del Libro Diario ────────────────────

/**
 * Impacto financiero de un movimiento en los tres fondos:
 * Caja (efectivo físico), Banco, Por acreditar.
 *
 * Cada operación del Libro Diario impacta UNA sola vez en estos fondos.
 * No se crean filas separadas por MovimientoCaja y MovimientoFinanciero.
 */
export interface ImpactoFinanciero {
  ingresoCaja: number;
  egresoCaja: number;
  ingresoBanco: number;
  egresoBanco: number;
  ingresoPorAcreditar: number;
  egresoPorAcreditar: number;
}

/**
 * Saldo acumulado de un movimiento enriquecido.
 */
export interface MovimientoConImpacto {
  itemNumber: number;
  impacto: ImpactoFinanciero;
  saldoCaja: number;
  saldoBanco: number;
  saldoPorAcreditar: number;
}

/**
 * Input mínimo que necesitamos del movimiento para calcular su impacto.
 * Compatible con MovimientoInput de caja-filters.ts.
 */
export interface MovimientoImpactoInput {
  tipo?: string;
  monto?: number;
  impactaCaja?: boolean;
  esNoEfectivo?: boolean;
  venta?: { metodoPago?: string | null; total?: number } | null;
  compra?: {
    total?: number;
    pagos?: { medio: string; monto: number }[] | null;
  } | null;
  descripcion?: string;
}

/**
 * Determina el impacto financiero de un movimiento individual en los tres fondos.
 *
 * REGLAS:
 * - VENTA EFECTIVO → Caja
 * - VENTA TRANSFERENCIA / DÉBITO → Banco
 * - VENTA CRÉDITO → Por acreditar
 * - REPOSICIÓN EFECTIVO → Caja (egreso)
 * - REPOSICIÓN TRANSFERENCIA → Banco (egreso)
 * - REPOSICIÓN MIXTA → Caja + Banco (egreso split)
 * - APERTURA → Caja
 * - GASTO EFECTIVO → Caja (egreso)
 * - Históricos sin impacto conocido → 0 en todos
 */
export function calcularImpactoFinanciero(
  mov: MovimientoImpactoInput
): ImpactoFinanciero {
  const monto = Number(mov.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
  }

  const tipo = mov.tipo || "INGRESO";
  const esIngreso = tipo === "INGRESO";
  const afectaCaja = mov.impactaCaja !== false;
  const desc = (mov.descripcion || "").toLowerCase();

  // ── ACREDITACIONES DE FONDOS (Transferencia de POR_ACREDITAR a BANCO) ─
  if (desc.includes("acreditación") || desc.includes("acreditacion")) {
    if (esIngreso) {
      return {
        ingresoCaja: 0,
        egresoCaja: 0,
        ingresoBanco: monto,
        egresoBanco: 0,
        ingresoPorAcreditar: 0,
        egresoPorAcreditar: monto,
      };
    }
    return {
      ingresoCaja: 0,
      egresoCaja: 0,
      ingresoBanco: 0,
      egresoBanco: 0,
      ingresoPorAcreditar: 0,
      egresoPorAcreditar: monto,
    };
  }

  // ── AJUSTES DE BANCO ──────────────────────────────────────────────────
  if (desc.includes("[ajuste_banco]")) {
    if (esIngreso) {
      return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: monto, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
    }
    return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: 0, egresoBanco: monto, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
  }

  // ── VENTAS ────────────────────────────────────────────────────────────
  if (esIngreso) {
    const metodo = mov.venta?.metodoPago ?? null;

    // Venta efectivo → Caja
    if (metodo === "EFECTIVO" || (afectaCaja && !mov.esNoEfectivo)) {
      return { ingresoCaja: monto, egresoCaja: 0, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
    }

    // Venta transferencia / débito → Banco
    if (metodo === "TRANSFERENCIA" || metodo === "TARJETA_DEBITO") {
      return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: monto, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
    }

    // Venta crédito → Por acreditar
    if (metodo === "TARJETA_CREDITO") {
      return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: monto, egresoPorAcreditar: 0 };
    }

    // Histórico sin método conocido: si impactaCaja → Caja, si no → 0
    if (afectaCaja) {
      return { ingresoCaja: monto, egresoCaja: 0, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
    }

    // Venta no efectiva sin método conocido → 0 (histórico sin impacto financiero registrado)
    return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
  }

  // ── EGRESOS (reposiciones, gastos) ────────────────────────────────────

  // Gasto manual → siempre Caja
  if (desc.startsWith("gasto:")) {
    return { ingresoCaja: 0, egresoCaja: monto, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
  }

  // Reposición: determinar método de pago
  const pagos = mov.compra?.pagos;
  const primerPago = pagos?.[0];

  if (primerPago) {
    const medio = primerPago.medio;

    // Reposición efectivo → Caja
    if (medio === "EFECTIVO_CAJA") {
      return { ingresoCaja: 0, egresoCaja: monto, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
    }

    // Reposición transferencia → Banco
    if (medio === "TRANSFERENCIA_BANCARIA") {
      return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: 0, egresoBanco: monto, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
    }

    // Reposición mixta → Caja + Banco
    if (medio === "MIXTO") {
      const efectivo = Number(primerPago.monto);
      const parteEfectivo = Number.isFinite(efectivo) ? efectivo : 0;
      const parteBanco = monto - parteEfectivo;
      return {
        ingresoCaja: 0,
        egresoCaja: parteEfectivo,
        ingresoBanco: 0,
        egresoBanco: parteBanco > 0 ? parteBanco : 0,
        ingresoPorAcreditar: 0,
        egresoPorAcreditar: 0,
      };
    }

    // Otros métodos históricos (Mercado Pago, Fondos Externos, Cta Cte) → 0
    // No inventamos impacto financiero para históricos
    return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
  }

  // Reposición sin pagos registrados: si impactaCaja → Caja, si no → 0
  if (afectaCaja) {
    return { ingresoCaja: 0, egresoCaja: monto, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
  }

  // Histórico sin información → 0
  return { ingresoCaja: 0, egresoCaja: 0, ingresoBanco: 0, egresoBanco: 0, ingresoPorAcreditar: 0, egresoPorAcreditar: 0 };
}

/**
 * Calcula los impactos financieros y saldos acumulados para una lista
 * cronológica de movimientos del Libro Diario.
 *
 * Retorna un array paralelo al input, donde cada elemento tiene:
 * - itemNumber (mismo que enrichMovimientos)
 * - impacto (desglose por fondo)
 * - saldoCaja / saldoBanco / saldoPorAcreditar (acumulados)
 *
 * IMPORTANTE: el array de entrada DEBE estar ordenado cronológicamente
 * (misma orden que usa enrichMovimientos).
 */
export function calcularImpactosConSaldo(
  movimientos: readonly MovimientoImpactoInput[]
): MovimientoConImpacto[] {
  let saldoCaja = 0;
  let saldoBanco = 0;
  let saldoPorAcreditar = 0;

  return movimientos.map((mov, idx) => {
    const impacto = calcularImpactoFinanciero(mov);

    saldoCaja += impacto.ingresoCaja - impacto.egresoCaja;
    saldoBanco += impacto.ingresoBanco - impacto.egresoBanco;
    saldoPorAcreditar += impacto.ingresoPorAcreditar - impacto.egresoPorAcreditar;

    return {
      itemNumber: idx + 1,
      impacto,
      saldoCaja,
      saldoBanco,
      saldoPorAcreditar,
    };
  });
}
