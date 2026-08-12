import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReposicionDescripcion } from "../../components/ui/ReposicionDescripcion";
import { formatReposicionFila } from "../movimiento-format";

const detalle = {
  cantidad: 1,
  producto: { nombre: "Batería AGM", marca: "Yamaha" },
};

function renderRow(medios?: string[], total: number | null = 60_000) {
  const reposicionFila = formatReposicionFila({
    total,
    detalles: [detalle],
    ...(medios === undefined
      ? {}
      : { pagos: medios.map((medio) => ({ medio, monto: total ?? undefined })) }),
  });

  if (!reposicionFila) throw new Error("Expected replenishment row data");
  return renderToStaticMarkup(
    React.createElement(ReposicionDescripcion, { reposicionFila })
  );
}

describe("ReposicionDescripcion", () => {
  it.each([
    ["EFECTIVO_CAJA", "Efectivo"],
    ["TRANSFERENCIA_BANCARIA", "Transferencia"],
    ["CUENTA_CORRIENTE_PROVEEDOR", "Cta. Cte."],
    ["FONDOS_EXTERNOS", "Fondos externos"],
    ["MERCADO_PAGO", "Mercado Pago"],
  ])("renderiza dos líneas para %s", (medio, etiqueta) => {
    const html = renderRow([medio]);

    expect(html).toContain("Batería AGM · Yamaha");
    expect(html).toContain(`Total $ 60.000,00 · ${etiqueta}`);
    expect(html).toContain("max-w-[400px] overflow-hidden");
    expect(html).toContain("whitespace-nowrap overflow-hidden text-ellipsis");
    expect(html).toContain("text-[10px] text-[var(--text-muted)]");
  });

  it("renderiza Mixto para múltiples medios", () => {
    expect(renderRow(["EFECTIVO_CAJA", "TRANSFERENCIA_BANCARIA"])).toContain(
      "Total $ 60.000,00 · Mixto"
    );
  });

  it("mantiene un histórico sin pagos sin inventar el medio", () => {
    const html = renderRow();
    expect(html).toContain("Total $ 60.000,00");
    expect(html).not.toContain("Total $ 60.000,00 ·");
  });

  it("no renderiza una segunda línea vacía", () => {
    const html = renderRow([], null);
    expect(html).toContain("Batería AGM · Yamaha");
    expect(html).not.toContain("text-[10px] text-[var(--text-muted)]");
  });
});
