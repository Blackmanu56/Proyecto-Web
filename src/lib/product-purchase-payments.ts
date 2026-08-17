export type ProductPurchaseMode = "create" | "edit" | "reposicion";

export const PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS = {
  EFECTIVO_CAJA: "Efectivo de Caja",
  TRANSFERENCIA_BANCARIA: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  CUENTA_CORRIENTE_PROVEEDOR: "Cta. Cte. Proveedor",
  FONDOS_EXTERNOS: "Fondos Externos",
} as const;

export type ProductPurchasePaymentMethod =
  keyof typeof PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS;

export const SELECTABLE_PRODUCT_PAYMENT_METHODS = [
  { value: "EFECTIVO_CAJA", label: "Efectivo de Caja", cajaImpact: true, requiresOpenCaja: true },
  { value: "TRANSFERENCIA_BANCARIA", label: "Transferencia", cajaImpact: false, requiresOpenCaja: false },
] as const;

type ProductPayment = {
  id?: string | number;
  medio: string;
  monto: number;
  observacion?: string | null;
};

export function getProductPurchasePaymentSummary(
  total: number,
  payments: readonly ProductPayment[]
) {
  if (payments.length === 0) return null;

  return {
    total,
    cashImpact: payments.reduce(
      (sum, payment) =>
        payment.medio === "EFECTIVO_CAJA" && Number.isFinite(payment.monto)
          ? sum + payment.monto
          : sum,
      0
    ),
    payments: payments.map((payment) => ({
      ...payment,
      label:
        PRODUCT_PURCHASE_PAYMENT_METHOD_LABELS[
          payment.medio as ProductPurchasePaymentMethod
        ] ?? payment.medio,
    })),
  };
}

function readPositiveNumber(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function getProductPurchaseCost(
  formData: FormData,
  mode: ProductPurchaseMode
) {
  const quantityField = mode === "edit" ? "cantidadAReponer" : "cantidad";
  const quantity = readPositiveNumber(formData.get(quantityField));
  const purchasePrice = readPositiveNumber(formData.get("precioCompra"));

  return quantity * purchasePrice;
}

export function isProductPaymentDistributionIncomplete(
  totalCost: number,
  payments: readonly ProductPayment[]
) {
  if (!Number.isFinite(totalCost) || totalCost <= 0) return false;
  if (payments.length === 0) return true;
  if (payments.some((payment) => !Number.isFinite(payment.monto) || payment.monto <= 0)) {
    return true;
  }

  const methods = payments.map((payment) => payment.medio);
  if (new Set(methods).size !== methods.length) return true;

  const assignedTotal = payments.reduce((sum, payment) => sum + payment.monto, 0);
  return Math.abs(assignedTotal - totalCost) > 0.01;
}
