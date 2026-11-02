/**
 * Resolutor centralizado de imágenes del catálogo (Productos y Combos) para Supabase Storage.
 * Mantiene 100% compatibilidad hacia atrás con referencias locales anteriores y URLs absolutas.
 */

export const SUPABASE_STORAGE_CATALOG_BASE =
  "https://feecgedfxtmtmdaakxgy.supabase.co/storage/v1/object/public/catalogo-chopper";

// Archivos verificados de productos presentes en el bucket catalogo-chopper/productos/ (Etapa 2)
export const MIGRATED_PRODUCT_FILES = new Set<string>([
  "1787257247068-n6du8v.webp",
  "1787257275289-zfrhdi.webp",
  "1787256884615-ec2s6q.webp",
  "1787257109231-xgu3vc.webp",
  "1787256814727-9ankcz.webp",
  "1787256838982-qcmmog.webp",
  "1787256978094-sidqz3.webp",
  "1787256924603-yyphhb.webp",
  "1787257172217-pralxv.webp",
  "1787257208766-dhiz8x.webp",
  "1787257027628-2si0tm.webp",
  "1787257138942-7grty1.webp",
]);

// Archivos verificados de combos presentes en el bucket catalogo-chopper/combos/ (Etapa 2)
export const MIGRATED_COMBO_FILES = new Set<string>([
  "combo-service-motul.jpg",
  "combo-rodado-pirelli.jpg",
  "combo-transmision-did.jpg",
  "combo-frenos-seguridad.jpg",
  "combo-mantenimiento-cadena.jpg",
  "combo-iluminacion-bateria.jpg",
]);

/**
 * Resuelve la URL pública para una imagen de catálogo (producto o combo).
 *
 * 1. Si es nula, vacía o indefinida: retorna el fallback (por defecto cadena vacía).
 * 2. Si ya es una URL absoluta (http://, https://, data:, blob:), se respeta intacta.
 * 3. Si el nombre de archivo está confirmado en el manifiesto de Supabase Storage:
 *    - Si es de productos: retorna https://.../catalogo-chopper/productos/{filename}
 *    - Si es de combos: retorna https://.../catalogo-chopper/combos/{filename}
 * 4. Si es una referencia no migrada (banners, uploads locales nuevos, etc.):
 *    conserva la ruta original relativa tal como está.
 */
export function getCatalogImageUrl(rawPath: string | null | undefined, fallback: string = ""): string {
  if (!rawPath || typeof rawPath !== "string") {
    return fallback;
  }

  const trimmed = rawPath.trim();
  if (!trimmed) {
    return fallback;
  }

  // Si ya es una URL absoluta, respetarla sin modificar
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // Extraer nombre base limpio (sin querystring ni hash)
  const cleanPath = trimmed.split("?")[0].split("#")[0];
  const filename = cleanPath.split("/").pop() || "";

  // 1. Producto migrado a Supabase
  if (MIGRATED_PRODUCT_FILES.has(filename)) {
    return `${SUPABASE_STORAGE_CATALOG_BASE}/productos/${filename}`;
  }

  // 2. Combo migrado a Supabase
  if (MIGRATED_COMBO_FILES.has(filename)) {
    return `${SUPABASE_STORAGE_CATALOG_BASE}/combos/${filename}`;
  }

  // 3. Rutas relativas explícitas del catálogo en Supabase Storage
  if (cleanPath.startsWith("productos/") || cleanPath.startsWith("/productos/")) {
    const rel = cleanPath.replace(/^\/?productos\//, "");
    return `${SUPABASE_STORAGE_CATALOG_BASE}/productos/${rel}`;
  }
  if (cleanPath.startsWith("combos/") || cleanPath.startsWith("/combos/")) {
    const rel = cleanPath.replace(/^\/?combos\//, "");
    return `${SUPABASE_STORAGE_CATALOG_BASE}/combos/${rel}`;
  }

  // 4. Referencias no migradas: conservar ruta original
  return trimmed;
}

/**
 * Resuelve una lista de imágenes de catálogo (útil para galerías de combos o productos).
 */
export function resolveCatalogImages(
  rawPaths: (string | null | undefined)[],
  fallback: string = ""
): string[] {
  return rawPaths.map((p) => getCatalogImageUrl(p, fallback)).filter(Boolean);
}
