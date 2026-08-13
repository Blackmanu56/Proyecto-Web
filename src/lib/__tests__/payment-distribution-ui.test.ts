import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatReposicionCorta } from "../movimiento-format";
import {
  PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS,
  SELECTABLE_PRODUCT_PAYMENT_METHODS,
  getProductPurchasePaymentSummary,
  getProductPurchaseCost,
  isProductPaymentDistributionIncomplete,
} from "../product-purchase-payments";

const paymentDistributionSource = readFileSync(
  new URL("../../components/ui/PaymentDistribution.tsx", import.meta.url),
  "utf8"
);

function productForm(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe("product purchase payment behavior", () => {
  it("calculates initial-stock cost from the real quantity and purchase-price fields", () => {
    const formData = productForm({
      cantidad: "2",
      precioCompra: "123600",
    });

    expect(getProductPurchaseCost(formData, "create")).toBe(247_200);
  });

  it("calculates replenishment cost from the real replenishment and purchase-price fields", () => {
    const formData = productForm({
      cantidadAReponer: "2",
      precioCompra: "123600",
    });

    expect(getProductPurchaseCost(formData, "edit")).toBe(247_200);
  });

  it("requires a complete valid distribution for creation and editing when cost is positive", () => {
    const completePayments = [
      { medio: "TRANSFERENCIA_BANCARIA", monto: 42_360 },
      { medio: "EFECTIVO_CAJA", monto: 204_840 },
    ];

    expect(isProductPaymentDistributionIncomplete(247_200, [])).toBe(true);
    expect(isProductPaymentDistributionIncomplete(247_200, completePayments)).toBe(false);
    expect(
      isProductPaymentDistributionIncomplete(247_200, [
        { medio: "TRANSFERENCIA_BANCARIA", monto: 247_199 },
      ])
    ).toBe(true);
  });

  it("does not require a distribution when initial stock or replenishment quantity is zero", () => {
    expect(isProductPaymentDistributionIncomplete(0, [])).toBe(false);
    expect(
      getProductPurchaseCost(
        productForm({ cantidad: "0", precioCompra: "123600" }),
        "create"
      )
    ).toBe(0);
    expect(
      getProductPurchaseCost(
        productForm({ cantidadAReponer: "0", precioCompra: "123600" }),
        "edit"
      )
    ).toBe(0);
  });

  it("rejects duplicate, non-positive, and non-finite payment rows", () => {
    expect(
      isProductPaymentDistributionIncomplete(200, [
        { medio: "TRANSFERENCIA_BANCARIA", monto: 100 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 100 },
      ])
    ).toBe(true);
    expect(
      isProductPaymentDistributionIncomplete(200, [
        { medio: "TRANSFERENCIA_BANCARIA", monto: 200 },
        { medio: "FONDOS_EXTERNOS", monto: 0 },
      ])
    ).toBe(true);
    expect(
      isProductPaymentDistributionIncomplete(200, [
        { medio: "TRANSFERENCIA_BANCARIA", monto: Number.NaN },
      ])
    ).toBe(true);
  });
});

describe("new replenishment payment selector", () => {
  it("offers only Efectivo and Transferencia for new purchases while preserving historical labels", () => {
    expect(SELECTABLE_PRODUCT_PAYMENT_METHODS.map((method) => method.value)).toEqual([
      "EFECTIVO_CAJA",
      "TRANSFERENCIA_BANCARIA",
    ]);
    // Historical labels are preserved for display of old records
    expect(PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS.MERCADO_PAGO).toBe("Mercado Pago");
    expect(PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS.CUENTA_CORRIENTE_PROVEEDOR).toBe("Cta. Cte. Proveedor");
    expect(PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS.FONDOS_EXTERNOS).toBe("Fondos Externos");
  });

  it("uses the short Transferencia label", () => {
    expect(
      SELECTABLE_PRODUCT_PAYMENT_METHODS.find(
        (method) => method.value === "TRANSFERENCIA_BANCARIA"
      )?.label
    ).toBe("Transferencia");
  });

  it("renders the optional external-funds origin as a full-width text input below its row", () => {
    const externalFundsBlock = paymentDistributionSource.match(
      /\{\/\* Optional origin\/reference for external funds \*\/\}([\s\S]*?)\{\/\* Row error hint \*\/\}/
    )?.[1];

    expect(externalFundsBlock).toBeDefined();
    expect(externalFundsBlock).toContain('<Input');
    expect(externalFundsBlock).toContain('type="text"');
    expect(externalFundsBlock).toContain(
      'placeholder="Aporte del propietario, caja externa, etc."'
    );
    expect(externalFundsBlock).toContain('className="h-6 w-full');
    expect(externalFundsBlock).not.toContain('<textarea');
  });
});

describe("purchase payment detail summary", () => {
  it("keeps the economic total separate from the physical Caja impact", () => {
    const summary = getProductPurchasePaymentSummary(247_200, [
      { medio: "TRANSFERENCIA_BANCARIA", monto: 147_200 },
      { medio: "EFECTIVO_CAJA", monto: 100_000 },
    ]);

    expect(summary).toEqual({
      total: 247_200,
      cashImpact: 100_000,
      payments: [
        { medio: "TRANSFERENCIA_BANCARIA", label: "Transferencia", monto: 147_200 },
        { medio: "EFECTIVO_CAJA", label: "Efectivo de Caja", monto: 100_000 },
      ],
    });
  });

  it("keeps a fully non-cash total visible while Caja impact remains zero", () => {
    const summary = getProductPurchasePaymentSummary(247_200, [
      { medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 },
    ]);

    expect(summary?.total).toBe(247_200);
    expect(summary?.cashImpact).toBe(0);
    expect(
      formatReposicionCorta({
        total: summary?.total,
        detalles: [
          {
            cantidad: 2,
            producto: { nombre: "Batería AGM", marca: "Yamaha" },
          },
        ],
      }, { includeTotal: true })
    ).toContain("247.200,00");
  });

  it("returns no additive section for historical purchases without PagoCompra", () => {
    expect(getProductPurchasePaymentSummary(247_200, [])).toBeNull();
  });
});
