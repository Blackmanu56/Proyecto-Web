import { describe, expect, it } from "vitest";
import { getResultado as getResultadoBadge } from "../../components/reports/ResultadoBadge";
import { getResultado as getResultadoLabel } from "../../components/reports/ResultadoLabel";

describe("Caja closing result (ResultadoBadge)", () => {
  it("keeps historical missing counted cash as pending rather than correct", () => {
    expect(getResultadoBadge(null, 120_000)).toMatchObject({ label: "Sin arqueo", variant: "slate" });
  });

  it("calculates exact balance when counted equals expected", () => {
    expect(getResultadoBadge(120_000, 120_000)).toMatchObject({ label: "Balance Correcto", variant: "emerald" });
  });

  it("calculates shortage from counted minus expected physical cash", () => {
    expect(getResultadoBadge(118_000, 120_000)).toMatchObject({ label: "Faltante", variant: "red" });
  });

  it("calculates surplus when counted is greater than expected", () => {
    expect(getResultadoBadge(125_000, 120_000)).toMatchObject({ label: "Sobrante", variant: "blue" });
  });

  it("handles negative expected cash correctly when counted is 0", () => {
    // Expected is -5000 (expenses > opening + sales), counted is 0 -> diff is 0 - (-5000) = +5000 (Sobrante)
    expect(getResultadoBadge(0, -5_000)).toMatchObject({ label: "Sobrante", variant: "blue" });
  });
});

describe("Caja closing result (ResultadoLabel)", () => {
  it("returns 'Sin arqueo' when totalContado is null", () => {
    expect(getResultadoLabel(null, 120_000)).toEqual({ label: "Sin arqueo", colorClass: "text-text-muted" });
    expect(getResultadoLabel(null, -5_000)).toEqual({ label: "Sin arqueo", colorClass: "text-text-muted" });
  });

  it("returns 'Balance Correcto' when totalContado exactly equals totalEsperado", () => {
    expect(getResultadoLabel(120_000, 120_000)).toEqual({ label: "Balance Correcto", colorClass: "text-success" });
  });

  it("returns 'Sobrante' when totalContado is greater than totalEsperado", () => {
    expect(getResultadoLabel(125_000, 120_000)).toEqual({ label: "Sobrante", colorClass: "text-info" });
    expect(getResultadoLabel(0, -5_000)).toEqual({ label: "Sobrante", colorClass: "text-info" });
  });

  it("returns 'Faltante' when totalContado is less than totalEsperado", () => {
    expect(getResultadoLabel(118_000, 120_000)).toEqual({ label: "Faltante", colorClass: "text-danger" });
  });
});
