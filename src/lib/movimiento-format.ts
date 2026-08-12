/**
 * Formateo de descripciones de movimientos de caja para DISPLAY.
 * Los registros viejos guardados en la DB NO se reescriben; se formatean
 * solo al mostrarse. Nunca usar sobre datos que se usen para clasificar
 * (ver caja-filters.ts: getConcepto/getTipoVisual matchean la descripción cruda).
 */

/**
 * Convierte un enum de tipo de comprobante a su forma legible.
 * `FACTURA_C` -> `FACTURA C`
 */
export function formatTipoComprobante(tipo: string): string {
  if (!tipo) return tipo;
  return tipo.replace(/_/g, " ").trim();
}

/**
 * Sanea cualquier descripción de movimiento para su visualización:
 * - Reemplaza `_` por espacios (`FACTURA_C` -> `FACTURA C`).
 * - Reemplaza `N?` / `N ?` por `N°` (corrige el símbolo de grado corrupto).
 * - Normaliza el espacio alrededor del separador `-` (sin tocar `foo-bar`).
 * - Colapsa espacios múltiples y recorta.
 * - Conserva tildes. Idempotente: textos ya correctos pasan intactos.
 */
export function formatMovimientoDescripcion(descripcion: string): string {
  if (!descripcion) return descripcion;

  return descripcion
    .replace(/_/g, " ")
    .replace(/N\s*\?/gi, "N°")
    .replace(/(\S)-(\s)/g, "$1 -$2")
    .replace(/(\s)-(\S)/g, "$1- $2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formatea la descripción CORTA de una reposición para DISPLAY en el Libro Diario.
 * Nunca incluye cantidad ni reescribe la descripción cruda guardada en la DB.
 * - 1 producto: `Reposición — <nombre>` (+ ` · <marca>` si existe).
 * - N productos: `Reposición — <totalUnidades> productos`.
 * - Por defecto conserva exactamente el texto histórico usado por CSV/impresión.
 * - Con `includeTotal`, ubica Compra.total antes del producto para mantenerlo
 *   visible en la fila aun cuando el texto largo use ellipsis.
 * Retorna null cuando no hay compra o no tiene detalles (el caller cae al fallback).
 */
export function formatReposicionCorta(
  compra?: {
    total?: number | null;
    detalles: {
      cantidad: number;
      producto: { nombre: string; marca: string | null };
    }[];
  } | null,
  options: { includeTotal?: boolean } = {}
): string | null {
  if (!compra || !Array.isArray(compra.detalles) || compra.detalles.length === 0) return null;

  const totalLabel =
    options.includeTotal === true &&
    typeof compra.total === "number" &&
    Number.isFinite(compra.total) &&
    compra.total > 0
      ? new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
        }).format(compra.total)
      : "";
  const prefix = totalLabel ? `Reposición · ${totalLabel} —` : "Reposición —";

  if (compra.detalles.length === 1) {
    const { nombre, marca } = compra.detalles[0].producto;
    const productLabel = marca ? `${nombre} · ${marca}` : nombre;
    return `${prefix} ${productLabel}`;
  }

  const totalUnidades = compra.detalles.reduce((sum, d) => sum + (Number(d.cantidad) || 0), 0);
  return `${prefix} ${totalUnidades} productos`;
}

type ReposicionFilaCompra = {
  total?: number | null;
  detalles: {
    cantidad: number;
    producto: { nombre: string; marca: string | null };
  }[];
  pagos?: { id?: string | number; medio: string; monto?: number }[] | null;
};

const MEDIOS_REPOSICION_FILA: Record<string, string> = {
  EFECTIVO_CAJA: "Efectivo",
  TRANSFERENCIA_BANCARIA: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  CUENTA_CORRIENTE_PROVEEDOR: "Cta. Cte.",
  FONDOS_EXTERNOS: "Fondos externos",
};

/** Construye exclusivamente las dos líneas visibles de una reposición en Caja. */
export function formatReposicionFila(
  compra?: ReposicionFilaCompra | null
): { principal: string; secundaria: string } | null {
  const descripcionHistorica = formatReposicionCorta(compra);
  if (!descripcionHistorica) return null;

  const principal = descripcionHistorica.replace(/^Reposición\s+—\s+/, "");
  const total =
    typeof compra?.total === "number" && Number.isFinite(compra.total)
      ? new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
        })
          .format(compra.total)
          .replace(/\u00a0/g, " ")
      : null;
  const medios = [...new Set((compra?.pagos ?? []).map((pago) => pago.medio))];
  const medio =
    medios.length >= 2
      ? "Mixto"
      : medios.length === 1
        ? MEDIOS_REPOSICION_FILA[medios[0]]
        : null;
  const secundaria = [total ? `Total ${total}` : null, medio]
    .filter(Boolean)
    .join(" · ");

  return { principal, secundaria };
}
