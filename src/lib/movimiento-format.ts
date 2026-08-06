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
 * Retorna null cuando no hay compra o no tiene detalles (el caller cae al fallback).
 */
export function formatReposicionCorta(
  compra?: { detalles: { cantidad: number; producto: { nombre: string; marca: string | null } }[] } | null
): string | null {
  if (!compra || !Array.isArray(compra.detalles) || compra.detalles.length === 0) return null;

  if (compra.detalles.length === 1) {
    const { nombre, marca } = compra.detalles[0].producto;
    return marca ? `Reposición — ${nombre} · ${marca}` : `Reposición — ${nombre}`;
  }

  const totalUnidades = compra.detalles.reduce((sum, d) => sum + (Number(d.cantidad) || 0), 0);
  return `Reposición — ${totalUnidades} productos`;
}
