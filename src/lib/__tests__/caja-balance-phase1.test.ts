import { describe, expect, it } from "vitest";
import { calcularEfectivoCajaActiva, calcularEfectivoFisico } from "../caja-balance";

describe("physical Caja balance", () => {
  it("counts the opening movement exactly once", () => {
    expect(calcularEfectivoFisico([
      { tipo: "INGRESO", monto: 100_000 },
      { tipo: "INGRESO", monto: 50_000 },
    ])).toEqual({ totalIngresos: 150_000, totalEgresos: 0, efectivoEsperado: 150_000 });
  });

  it("keeps non-cash economic operations outside the physical ledger", () => {
    expect(calcularEfectivoFisico([
      { tipo: "INGRESO", monto: 100_000 },
      { tipo: "INGRESO", monto: 50_000 },
      { tipo: "EGRESO", monto: 20_000 },
      { tipo: "EGRESO", monto: 10_000 },
    ])).toEqual({ totalIngresos: 150_000, totalEgresos: 30_000, efectivoEsperado: 120_000 });
  });

  it("ignores malformed amounts instead of poisoning the expected cash", () => {
    expect(calcularEfectivoFisico([
      { tipo: "INGRESO", monto: Number.NaN },
      { tipo: "EGRESO", monto: Number.POSITIVE_INFINITY },
    ])).toEqual({ totalIngresos: 0, totalEgresos: 0, efectivoEsperado: 0 });
  });
});

describe("Dashboard active Caja cash", () => {
  it("derives the displayed cash from movements and ignores legacy accumulators", () => {
    expect(calcularEfectivoCajaActiva({
      movimientos: [
        { tipo: "INGRESO", monto: 100_000 },
        { tipo: "INGRESO", monto: 50_000 },
        { tipo: "EGRESO", monto: 30_000 },
      ],
    })).toBe(120_000);
  });

  it("returns zero when there is no active Caja", () => {
    expect(calcularEfectivoCajaActiva(null)).toBe(0);
  });
});
