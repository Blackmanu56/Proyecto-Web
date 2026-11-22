import { uploadCatalogImage, rollbackStorageUpload, CatalogFolder } from "./storage-service";

/**
 * Guarda o sube un archivo de catálogo directamente a Supabase Storage (catalogo-chopper).
 * Valida magic bytes, tamaño de archivo, destino seguro y credenciales del servidor.
 * Si falta SUPABASE_SERVICE_ROLE_KEY, lanza un error claro impidiendo escrituras locales silenciosas.
 */
export async function saveFile(file: File, folder: CatalogFolder = "productos"): Promise<string> {
  const res = await uploadCatalogImage(file, folder);
  if (!res.success || !res.url) {
    throw new Error(res.error || "Error al subir imagen a Supabase Storage.");
  }
  return res.url;
}

/**
 * En Etapa 4, por política de reemplazo seguro no se eliminan físicamente imágenes
 * para evitar dejar sin imagen a otros productos o combos que compartan la referencia.
 */
export async function deleteFile(_url: string): Promise<void> {
  // No-op intencional por seguridad
  return;
}

export { rollbackStorageUpload, uploadCatalogImage };
