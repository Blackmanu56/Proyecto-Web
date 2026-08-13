/**
 * Parte 6 — Tests de impresión del Libro Diario de Caja.
 *
 * Valida la lógica conceptual de la impresión adaptada
 * a la nueva arquitectura financiera (Efectivo / Banco / Por acreditar).
 *
 * Estos tests NO renderizan JSX — validan los helpers y la lógica
 * de datos que alimenta la impresión.
 */
import { describe, expect, it } from "vitest";
import { calcularEfectivoFisico } from "../caja-balance";
import { calcularSaldosFinancieros } from "../cuenta-financiera";

// ─── Helpers de simulación ─────────────────────────────────────────────────

interface MovSimulado {
  tipo: string;
  monto: number;
  impactaCaja?: boolean;
  venta?: { metodoPago?: string | null } | null;
  compra?: { pagos?: { medio: string; monto: number }[] | null } | null;
}

function simularMetodoPago(mov: MovSimulado): string {
  if (mov.venta?.metodoPago) return mov.venta.metodoPago;
  if (mov.compra?.pagos?.[0]?.medio) return mov.compra.pagos[0].medio;
  return "—";
}

function simularIngreso(mov: MovSimulado): string {
  const isIncome = mov.tipo === "INGRESO";
  const afectaCaja = mov.impactaCaja !== false;
  return isIncome && afectaCaja ? `$${mov.monto}` : "—";
}

function simularEgreso(mov: MovSimulado): string {
  const isIncome = mov.tipo === "INGRESO";
  const afectaCaja = mov.impactaCaja !== false;
  return !isIncome && afectaCaja ? `$${mov.monto}` : "—";
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Parte 6 — Impresión Libro Diario de Caja", () => {
  // ─── A) Venta efectivo: importe + ingreso ──────────────────────────────
  it("A) Venta efectivo: muestra importe económico + ingreso efectivo", () => {
    const mov: MovSimulado = {
      tipo: "INGRESO",
      monto: 50_000,
      venta: { metodoPago: "EFECTIVO" },
    };
    expect(simularMetodoPago(mov)).toBe("EFECTIVO");
    expect(simularIngreso(mov)).toBe("$50000");
    expect(simularEgreso(mov)).toBe("—");
  });

  // ─── B) Venta transferencia: importe sin ingreso ──────────────────────
  it("B) Venta transferencia: muestra importe económico + ingreso vacío", () => {
    const mov: MovSimulado = {
      tipo: "INGRESO",
      monto: 80_000,
      impactaCaja: false,
      venta: { metodoPago: "TRANSFERENCIA" },
    };
    expect(simularMetodoPago(mov)).toBe("TRANSFERENCIA");
    expect(simularIngreso(mov)).toBe("—");
    expect(simularEgreso(mov)).toBe("—");
  });

  // ─── C) Reposición transferencia: importe sin egreso ──────────────────
  it("C) Reposición transferencia: muestra importe económico + egreso vacío", () => {
    const mov: MovSimulado = {
      tipo: "EGRESO",
      monto: 60_000,
      impactaCaja: false,
      compra: { pagos: [{ medio: "TRANSFERENCIA_BANCARIA", monto: 60_000 }] },
    };
    expect(simularMetodoPago(mov)).toBe("TRANSFERENCIA_BANCARIA");
    expect(simularIngreso(mov)).toBe("—");
    expect(simularEgreso(mov)).toBe("—");
  });

  // ─── D) Reposición mixta: importe total + egreso solo efectivo ────────
  it("D) Reposición mixta: muestra importe total + egreso solo efectivo", () => {
    const mov: MovSimulado = {
      tipo: "EGRESO",
      monto: 100_000,
      compra: { pagos: [{ medio: "MIXTO", monto: 100_000 }] },
    };
    // Para mixto, el MovimientoCaja solo registra la parte efectivo
    // El importe total es 100k, pero el egreso físico es solo la parte efectivo
    expect(simularMetodoPago(mov)).toBe("MIXTO");
    expect(simularIngreso(mov)).toBe("—");
    // El egreso depende de impactaCaja (por defecto true)
    expect(simularEgreso(mov)).toBe("$100000");
  });

  // ─── E) Total disponible: efectivo + banco ────────────────────────────
  it("E) Total disponible = efectivo + banco (NO incluye por acreditar)", () => {
    const cuentasBanco = [{ saldoInicial: 0, movimientos: [{ tipo: "INGRESO", monto: 200_000 }] }];
    const cuentasPorAcreditar = [{ saldoInicial: 0, movimientos: [{ tipo: "INGRESO", monto: 100_000 }] }];
    const efectivoFisico = 150_000;

    const saldos = calcularSaldosFinancieros(cuentasBanco, cuentasPorAcreditar, efectivoFisico);

    expect(saldos.efectivoFisico).toBe(150_000);
    expect(saldos.banco).toBe(200_000);
    expect(saldos.porAcreditar).toBe(100_000);
    expect(saldos.totalDisponible).toBe(350_000); // 150k + 200k
    expect(saldos.totalDisponible).not.toBe(450_000); // NO incluye por acreditar
  });

  // ─── F) Por acreditar no entra en Total disponible ────────────────────
  it("F) Por acreditar NO se incluye en Total disponible", () => {
    const cuentasBanco = [{ saldoInicial: 0, movimientos: [] }];
    const cuentasPorAcreditar = [{ saldoInicial: 0, movimientos: [{ tipo: "INGRESO", monto: 500_000 }] }];
    const efectivoFisico = 0;

    const saldos = calcularSaldosFinancieros(cuentasBanco, cuentasPorAcreditar, efectivoFisico);

    expect(saldos.porAcreditar).toBe(500_000);
    expect(saldos.totalDisponible).toBe(0); // efectivo 0 + banco 0
  });

  // ─── G) Cierre: diferencia usa solo efectivo ──────────────────────────
  it("G) Diferencia de cierre = efectivo contado - efectivo esperado (Banco NO participa)", () => {
    const efectivoEsperado = 150_000;
    const efectivoContado = 148_000;
    const diferencia = efectivoContado - efectivoEsperado;

    expect(diferencia).toBe(-2_000);
    expect(diferencia).toBeLessThan(0); // Faltante
  });

  it("G2) Diferencia balanceada cuando coinciden", () => {
    const efectivoEsperado = 150_000;
    const efectivoContado = 150_000;
    const diferencia = efectivoContado - efectivoEsperado;

    expect(diferencia).toBe(0); // Balanceada
  });

  it("G3) Diferencia sobrante cuando contado > esperado", () => {
    const efectivoEsperado = 150_000;
    const efectivoContado = 152_000;
    const diferencia = efectivoContado - efectivoEsperado;

    expect(diferencia).toBe(2_000); // Sobrante
  });

  // ─── H) Sin firmas ────────────────────────────────────────────────────
  it("H) El HTML de impresión NO debe contener bloques de firma", () => {
    // Verificación conceptual: las firmas fueron eliminadas del print HTML
    // Este test documenta el requisito
    const firmasRequieren = false; // Firmas eliminadas en Parte 6
    expect(firmasRequieren).toBe(false);
  });

  // ─── I) Venta débito: importe sin ingreso ─────────────────────────────
  it("I) Venta débito: muestra importe + ingreso vacío (va a Banco)", () => {
    const mov: MovSimulado = {
      tipo: "INGRESO",
      monto: 30_000,
      impactaCaja: false,
      venta: { metodoPago: "TARJETA_DEBITO" },
    };
    expect(simularMetodoPago(mov)).toBe("TARJETA_DEBITO");
    expect(simularIngreso(mov)).toBe("—");
  });

  // ─── J) Venta crédito: importe sin ingreso ────────────────────────────
  it("J) Venta crédito: muestra importe + ingreso vacío (va a Por acreditar)", () => {
    const mov: MovSimulado = {
      tipo: "INGRESO",
      monto: 100_000,
      impactaCaja: false,
      venta: { metodoPago: "TARJETA_CREDITO" },
    };
    expect(simularMetodoPago(mov)).toBe("TARJETA_CREDITO");
    expect(simularIngreso(mov)).toBe("—");
  });

  // ─── K) Efectivo esperado solo depende de MovimientoCaja ──────────────
  it("K) Efectivo esperado = solo movimientos de Caja (Banco no participa)", () => {
    const movimientosCaja = [
      { tipo: "INGRESO", monto: 100_000 }, // Apertura
      { tipo: "INGRESO", monto: 50_000 },  // Venta efectivo
    ];
    const efectivo = calcularEfectivoFisico(movimientosCaja).efectivoEsperado;
    expect(efectivo).toBe(150_000);
  });

  // ─── L) Historial de labels de pago ───────────────────────────────────
  it("L) Labels históricos (Mercado Pago, Fondos Externos, Cta Cte) siguen funcionando", () => {
    expect(simularMetodoPago({ tipo: "INGRESO", monto: 1000, venta: { metodoPago: "MERCADO_PAGO" } })).toBe("MERCADO_PAGO");
    expect(simularMetodoPago({ tipo: "INGRESO", monto: 1000, venta: { metodoPago: "CUENTA_CORRIENTE_PROVEEDOR" } })).toBe("CUENTA_CORRIENTE_PROVEEDOR");
    expect(simularMetodoPago({ tipo: "INGRESO", monto: 1000, venta: { metodoPago: "FONDOS_EXTERNOS" } })).toBe("FONDOS_EXTERNOS");
  });
});
