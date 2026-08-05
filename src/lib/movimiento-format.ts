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
