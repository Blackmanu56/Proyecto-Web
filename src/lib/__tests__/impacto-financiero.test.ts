/**
 * Parte 7.1 — Tests de impacto financiero por movimiento del Libro Diario.
 *
 * Valida que cada operación impacta correctamente en los tres fondos:
 * Caja (efectivo), Banco, Por acreditar.
 *
 * A-J: escenarios del spec.
 */
import { describe, expect, it } from "vitest";
import {
  calcularImpactoFinanciero,
  calcularImpactosConSaldo,
  type MovimientoImpactoInput,
} from "../cuenta-financiera";

// ─── Helpers de construcción ───────────────────────────────────────────────

function ventaEfectivo(monto: number): MovimientoImpactoInput {
  return { tipo: "INGRESO", monto, impactaCaja: true, esNoEfectivo: false, venta: { metodoPago: "EFECTIVO", total: monto } };
}

function ventaTransferencia(monto: number): MovimientoImpactoInput {
  return { tipo: "INGRESO", monto, impactaCaja: false, esNoEfectivo: true, venta: { metodoPago: "TRANSFERENCIA", total: monto } };
}

function ventaDebito(monto: number): MovimientoImpactoInput {
  return { tipo: "INGRESO", monto, impactaCaja: false, esNoEfectivo: true, venta: { metodoPago: "TARJETA_DEBITO", total: monto } };
}

function ventaCredito(monto: number): MovimientoImpactoInput {
  return { tipo: "INGRESO", monto, impactaCaja: false, esNoEfectivo: true, venta: { metodoPago: "TARJETA_CREDITO", total: monto } };
}

function reposicionEfectivo(monto: number): MovimientoImpactoInput {
  return {
    tipo: "EGRESO", monto, impactaCaja: true,
    compra: { total: monto, pagos: [{ medio: "EFECTIVO_CAJA", monto }] },
    descripcion: "Reposicion de stock",
  };
}

function reposicionTransferencia(monto: number): MovimientoImpactoInput {
  return {
    tipo: "EGRESO", monto, impactaCaja: false,
    compra: { total: monto, pagos: [{ medio: "TRANSFERENCIA_BANCARIA", monto }] },
    descripcion: "Reposicion de stock",
  };
}

function reposicionMixta(total: number, efectivo: number): MovimientoImpactoInput {
  return {
    tipo: "EGRESO", monto: total, impactaCaja: true,
    compra: { total, pagos: [{ medio: "MIXTO", monto: efectivo }] },
    descripcion: "Reposicion mixta",
  };
}

function apertura(monto: number): MovimientoImpactoInput {
  return { tipo: "INGRESO", monto, impactaCaja: true, descripcion: "Saldo inicial de apertura" };
}

function gastoEfectivo(monto: number): MovimientoImpactoInput {
  return { tipo: "EGRESO", monto, impactaCaja: true, descripcion: "Gasto: limpieza" };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Parte 7.1 — Impacto financiero por movimiento", () => {
  // ─── A) Venta efectivo ────────────────────────────────────────────────
  it("A) Venta efectivo: Caja +100, Banco 0, Por acreditar 0", () => {
    const impacto = calcularImpactoFinanciero(ventaEfectivo(100_000));
    expect(impacto.ingresoCaja).toBe(100_000);
    expect(impacto.egresoCaja).toBe(0);
    expect(impacto.ingresoBanco).toBe(0);
    expect(impacto.egresoBanco).toBe(0);
    expect(impacto.ingresoPorAcreditar).toBe(0);
    expect(impacto.egresoPorAcreditar).toBe(0);
  });

  // ─── B) Venta transferencia ──────────────────────────────────────────
  it("B) Venta transferencia: Caja 0, Banco +100", () => {
    const impacto = calcularImpactoFinanciero(ventaTransferencia(100_000));
    expect(impacto.ingresoCaja).toBe(0);
    expect(impacto.ingresoBanco).toBe(100_000);
    expect(impacto.ingresoPorAcreditar).toBe(0);
  });

  // ─── C) Venta débito ─────────────────────────────────────────────────
  it("C) Venta débito: Banco +100", () => {
    const impacto = calcularImpactoFinanciero(ventaDebito(100_000));
    expect(impacto.ingresoCaja).toBe(0);
    expect(impacto.ingresoBanco).toBe(100_000);
    expect(impacto.ingresoPorAcreditar).toBe(0);
  });

  // ─── D) Venta crédito ────────────────────────────────────────────────
  it("D) Venta crédito: Por acreditar +100, Banco 0", () => {
    const impacto = calcularImpactoFinanciero(ventaCredito(100_000));
    expect(impacto.ingresoCaja).toBe(0);
    expect(impacto.ingresoBanco).toBe(0);
    expect(impacto.ingresoPorAcreditar).toBe(100_000);
  });

  // ─── E) Reposición efectivo ──────────────────────────────────────────
  it("E) Reposición efectivo: Caja -100", () => {
    const impacto = calcularImpactoFinanciero(reposicionEfectivo(100_000));
    expect(impacto.egresoCaja).toBe(100_000);
    expect(impacto.egresoBanco).toBe(0);
  });

  // ─── F) Reposición transferencia ─────────────────────────────────────
  it("F) Reposición transferencia: Banco -100", () => {
    const impacto = calcularImpactoFinanciero(reposicionTransferencia(100_000));
    expect(impacto.egresoCaja).toBe(0);
    expect(impacto.egresoBanco).toBe(100_000);
  });

  // ─── G) Reposición mixta ─────────────────────────────────────────────
  it("G) Reposición mixta: Caja -30, Banco -70", () => {
    const impacto = calcularImpactoFinanciero(reposicionMixta(100_000, 30_000));
    expect(impacto.egresoCaja).toBe(30_000);
    expect(impacto.egresoBanco).toBe(70_000);
  });

  // ─── H) Una operación con varios impactos = una fila ──────────────────
  it("H) Una operación con impacto mixto genera UN solo objeto de impacto", () => {
    const impacto = calcularImpactoFinanciero(reposicionMixta(100_000, 30_000));
    // El impacto tiene desglose en Caja Y Banco, pero es UN solo resultado
    const totalImpacto =
      impacto.egresoCaja + impacto.egresoBanco;
    expect(totalImpacto).toBe(100_000);
    // No se genera una segunda fila
  });

  // ─── I) Saldos acumulados correctos ──────────────────────────────────
  it("I) Saldos acumulados Caja/Banco/Por acreditar correctos", () => {
    const movimientos: MovimientoImpactoInput[] = [
      apertura(100_000),           // Caja +100
      ventaEfectivo(50_000),       // Caja +50
      ventaTransferencia(80_000),  // Banco +80
      ventaCredito(30_000),        // Por acreditar +30
      reposicionEfectivo(20_000),  // Caja -20
    ];

    const resultados = calcularImpactosConSaldo(movimientos);

    // Verificar saldos acumulados
    expect(resultados[0].saldoCaja).toBe(100_000);
    expect(resultados[1].saldoCaja).toBe(150_000);
    expect(resultados[2].saldoCaja).toBe(150_000); // Venta transferencia no toca Caja
    expect(resultados[3].saldoCaja).toBe(150_000); // Venta crédito no toca Caja
    expect(resultados[4].saldoCaja).toBe(130_000); // Reposición efectivo -20

    expect(resultados[0].saldoBanco).toBe(0);
    expect(resultados[1].saldoBanco).toBe(0);
    expect(resultados[2].saldoBanco).toBe(80_000);
    expect(resultados[3].saldoBanco).toBe(80_000);
    expect(resultados[4].saldoBanco).toBe(80_000);

    expect(resultados[0].saldoPorAcreditar).toBe(0);
    expect(resultados[1].saldoPorAcreditar).toBe(0);
    expect(resultados[2].saldoPorAcreditar).toBe(0);
    expect(resultados[3].saldoPorAcreditar).toBe(30_000);
    expect(resultados[4].saldoPorAcreditar).toBe(30_000);
  });

  // ─── J) Histórico sin MovimientoFinanciero no inventa Banco ──────────
  it("J) Histórico sin método de pago conocido no inventa impacto Banco", () => {
    const historico: MovimientoImpactoInput = {
      tipo: "INGRESO",
      monto: 50_000,
      impactaCaja: false,
      esNoEfectivo: true,
      venta: { metodoPago: null, total: 50_000 }, // Método desconocido
    };
    const impacto = calcularImpactoFinanciero(historico);
    expect(impacto.ingresoBanco).toBe(0);
    expect(impacto.ingresoCaja).toBe(0);
    expect(impacto.ingresoPorAcreditar).toBe(0);
  });

  // ─── K) Gasto efectivo ───────────────────────────────────────────────
  it("K) Gasto efectivo: Caja -50", () => {
    const impacto = calcularImpactoFinanciero(gastoEfectivo(50_000));
    expect(impacto.egresoCaja).toBe(50_000);
    expect(impacto.egresoBanco).toBe(0);
  });

  // ─── L) Apertura ─────────────────────────────────────────────────────
  it("L) Apertura: Caja +100, Banco 0, Por acreditar 0", () => {
    const impacto = calcularImpactoFinanciero(apertura(100_000));
    expect(impacto.ingresoCaja).toBe(100_000);
    expect(impacto.ingresoBanco).toBe(0);
    expect(impacto.ingresoPorAcreditar).toBe(0);
  });

  // ─── M) Mixto completo: varias operaciones ───────────────────────────
  it("M) Secuencia completa: apertura + venta + reposición mixta", () => {
    const movimientos: MovimientoImpactoInput[] = [
      apertura(100_000),
      ventaTransferencia(60_000),
      reposicionMixta(40_000, 15_000),
    ];

    const resultados = calcularImpactosConSaldo(movimientos);

    // Saldo final
    expect(resultados[2].saldoCaja).toBe(100_000 - 15_000); // 85k
    expect(resultados[2].saldoBanco).toBe(60_000 - 25_000); // 35k
    expect(resultados[2].saldoPorAcreditar).toBe(0);
  });

  // ─── N) Monto 0 o inválido → impacto 0 ──────────────────────────────
  it("N) Monto 0 o inválido genera impacto 0", () => {
    expect(calcularImpactoFinanciero({ tipo: "INGRESO", monto: 0 }).ingresoCaja).toBe(0);
    expect(calcularImpactoFinanciero({ tipo: "INGRESO", monto: NaN }).ingresoCaja).toBe(0);
    expect(calcularImpactoFinanciero({ tipo: "INGRESO" }).ingresoCaja).toBe(0);
  });
});
