import { describe, expect, it } from "vitest";
import { getResultado } from "../../components/reports/ResultadoBadge";

describe("Caja closing result", () => {
  it("keeps historical missing counted cash as pending rather than correct", () => {
    expect(getResultado(null, 120_000)).toMatchObject({ label: "Sin arqueo", variant: "slate" });
  });

  it("calculates shortage from counted minus expected physical cash", () => {
    expect(getResultado(118_000, 120_000)).toMatchObject({ label: "Faltante", variant: "red" });
  });
});
