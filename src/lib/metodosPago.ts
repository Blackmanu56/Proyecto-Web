/**
 * Métodos de pago de ventas: orden canónico de display y etiquetas.
 * Extraído de CajaTerminal.tsx (constantes originales, sin cambios de comportamiento)
 * para que los reportes de ventas reutilicen el mismo criterio.
 */

export const METODOS_PAGO_ORDEN = ["EFECTIVO", "TRANSFERENCIA", "TARJETA_DEBITO", "TARJETA_CREDITO"];

export function labelMetodoPago(metodo: string): string {
  const labels: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TRANSFERENCIA: "Transferencia",
    TARJETA_DEBITO: "Débito",
    TARJETA_CREDITO: "Crédito",
    MERCADOPAGO: "Mercado Pago",
    OTROS: "Otros",
  };
  return labels[metodo] ?? metodo;
}
