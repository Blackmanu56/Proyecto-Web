import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MovimientoDetalleModal from "../../components/ui/MovimientoDetalleModal";

const cajaActionSource = readFileSync(
  new URL("../../actions/caja.ts", import.meta.url),
  "utf8"
);
function renderReplenishmentDetail(
  pagos?: Array<{
    id: number;
    medio: string;
    monto: number;
    observacion?: string | null;
  }>
) {
  const compra = {
    id: 50,
    total: 247_200,
    proveedor: { id: 3, nombre: "Repuestos Alemania" },
    detalles: [
      {
        id: 1,
        cantidad: 2,
        costoUnitario: 123_600,
        subtotal: 247_200,
        producto: {
          id: 10,
          nombre: "Batería AGM",
          marca: "Yamaha",
          cantidad: 12,
          categoria: { id: 2, nombre: "Eléctrico" },
        },
      },
    ],
    ...(pagos === undefined ? {} : { pagos }),
  };

  return renderToStaticMarkup(
    React.createElement(MovimientoDetalleModal, {
      open: true,
      onClose: () => undefined,
      movimiento: {
        id: 70,
        tipo: "EGRESO",
        monto: pagos?.find((pago) => pago.medio === "EFECTIVO_CAJA")?.monto ?? 0,
        descripcion: "Reposición de 'Batería AGM' x2",
        fecha: "2026-08-12T03:00:00.000Z",
        usuario: { username: "admin", nombreCompleto: "Administrador" },
        compraId: 50,
        compra,
      },
    })
  );
}

function getTopAmountLabel(html: string) {
  return html.match(/<p class="text-xs font-semibold [^"]+">([^<]+)<\/p>/)?.[1];
}

function renderNonReplenishmentDetail() {
  return renderToStaticMarkup(
    React.createElement(MovimientoDetalleModal, {
      open: true,
      onClose: () => undefined,
      movimiento: {
        id: 71,
        tipo: "EGRESO",
        monto: 15_000,
        descripcion: "Gasto de mantenimiento",
        fecha: "2026-08-12T03:00:00.000Z",
        usuario: { username: "admin", nombreCompleto: "Administrador" },
      },
    })
  );
}

describe("Caja replenishment payment detail contract", () => {
  it("loads only the payment fields required by the existing detail modal", () => {
    expect(cajaActionSource).toMatch(
      /pagos:\s*\{\s*select:\s*\{[\s\S]*?id:\s*true,[\s\S]*?medio:\s*true,[\s\S]*?monto:\s*true,[\s\S]*?observacion:\s*true[\s\S]*?\}\s*\}/
    );
  });

  it.each([undefined, []])(
    "does not render payment distribution for historical pagos=%j",
    (pagos) => {
      const html = renderReplenishmentDetail(pagos);

      expect(html).toContain("Detalle de la Reposición");
      expect(html).toContain("Batería AGM");
      expect(html).toContain("Repuestos Alemania");
      expect(html).not.toContain("Distribución de pago");
    }
  );

  it("renders derived labels, amounts, external origin, total and cash impact", () => {
    const html = renderReplenishmentDetail([
      { id: 1, medio: "EFECTIVO_CAJA", monto: 100_000 },
      { id: 2, medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 },
      {
        id: 3,
        medio: "FONDOS_EXTERNOS",
        monto: 47_200,
        observacion: "Aporte del propietario",
      },
    ]);

    expect(html).toContain("Efectivo de Caja");
    expect(html).toContain("Transferencia");
    expect(html).toContain("Fondos Externos");
    expect(html).toContain("Origen: Aporte del propietario");
    expect(html).toContain("247.200,00");
    expect(html).toContain("100.000,00");
    expect(html).toContain("Afectó Caja");
  });

  it.each([
    {
      paymentKind: "mixed",
      pagos: [
        { id: 1, medio: "EFECTIVO_CAJA", monto: 100_000 },
        { id: 2, medio: "TRANSFERENCIA_BANCARIA", monto: 147_200 },
      ],
    },
    {
      paymentKind: "cash",
      pagos: [{ id: 1, medio: "EFECTIVO_CAJA", monto: 247_200 }],
    },
    {
      paymentKind: "cash-neutral",
      pagos: [{ id: 1, medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }],
    },
  ])("labels the top amount as cash impact for $paymentKind replenishments", ({ pagos }) => {
    expect(getTopAmountLabel(renderReplenishmentDetail(pagos))).toBe("Afectó Caja");
  });

  it("keeps the top amount label as Monto for non-replenishment movements", () => {
    expect(getTopAmountLabel(renderNonReplenishmentDetail())).toBe("Monto");
  });

  it("keeps the original product/provider/total detail before the additive block", () => {
    const html = renderReplenishmentDetail([
      { id: 1, medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 },
    ]);
    const originalIndex = html.indexOf("Detalle de la Reposición");
    const productIndex = html.indexOf("Batería AGM", originalIndex);
    const providerIndex = html.indexOf("Repuestos Alemania", originalIndex);
    const totalIndex = html.indexOf("Importe total", originalIndex);
    const distributionIndex = html.indexOf("Distribución de pago");

    expect(originalIndex).toBeGreaterThan(-1);
    expect(productIndex).toBeGreaterThan(originalIndex);
    expect(providerIndex).toBeGreaterThan(originalIndex);
    expect(totalIndex).toBeGreaterThan(originalIndex);
    expect(distributionIndex).toBeGreaterThan(productIndex);
    expect(distributionIndex).toBeGreaterThan(providerIndex);
    expect(distributionIndex).toBeGreaterThan(totalIndex);
  });
});
