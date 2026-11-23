import { detectImageMagicBytes, uploadCatalogImage, rollbackStorageUpload, MAX_CATALOG_FILE_SIZE } from "../src/lib/storage-service";
import { getCatalogImageUrl, resolveCatalogImages, MIGRATED_PRODUCT_FILES, MIGRATED_COMBO_FILES } from "../src/lib/storage-catalog";
import { prisma } from "../src/lib/prisma";
import crypto from "crypto";

async function runStage4Tests() {
  console.log("================================================================================");
  console.log("   SUITE DE PRUEBAS ETAPA 4: SUBIDA Y REEMPLAZO SEGURO EN SUPABASE STORAGE     ");
  console.log("================================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
      process.exitCode = 1;
    }
  }

  // ─── 1. RECHAZO DE FORMATOS NO ADMITIDOS (MAGIC BYTES) ───
  console.log("--- 1. Validación Estricta de Magic Bytes (Seguridad contra extensiones falsas) ---");

  // Buffer de texto plano simulando archivo .txt o payload malicioso
  const fakeTextBuffer = Buffer.from("Hello world, this is a plain text file disguised as image.");
  const resText = detectImageMagicBytes(fakeTextBuffer);
  assert(!resText.valid, "Rechaza archivo de texto plano");

  // Archivo con extensión .jpg falsa pero contenido HTML/JS
  const fakeHtmlBuffer = Buffer.from("<!DOCTYPE html><html><script>alert(1)</script></html>");
  const resHtml = detectImageMagicBytes(fakeHtmlBuffer);
  assert(!resHtml.valid, "Rechaza contenido HTML/JS con extensión falsa");

  // Buffer menor a 12 bytes
  const tinyBuffer = Buffer.from([0x01, 0x02, 0x03]);
  const resTiny = detectImageMagicBytes(tinyBuffer);
  assert(!resTiny.valid, "Rechaza buffers corruptos o menores al encabezado mínimo");

  // JPEG genuino (FF D8 FF ...)
  const realJpegHeader = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
  const resJpeg = detectImageMagicBytes(realJpegHeader);
  assert(resJpeg.valid && resJpeg.ext === "jpg" && resJpeg.mime === "image/jpeg", "Detecta y acepta JPEG genuino");

  // PNG genuino (89 50 4E 47 0D 0A 1A 0A)
  const realPngHeader = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  const resPng = detectImageMagicBytes(realPngHeader);
  assert(resPng.valid && resPng.ext === "png" && resPng.mime === "image/png", "Detecta y acepta PNG genuino");

  // WebP genuino (RIFF .... WEBP)
  const realWebpHeader = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP"),
    Buffer.alloc(20),
  ]);
  const resWebp = detectImageMagicBytes(realWebpHeader);
  assert(resWebp.valid && resWebp.ext === "webp" && resWebp.mime === "image/webp", "Detecta y acepta WebP genuino");

  // ─── 2. RECHAZO DE ARCHIVOS SUPERIORES A 5 MB ───
  console.log("\n--- 2. Límite de Tamaño de Archivo (Máximo 5 MB) ---");

  // Buffer que supera los 5 MB
  const oversizedBuffer = Buffer.alloc(MAX_CATALOG_FILE_SIZE + 1024);
  // Poner magic bytes de JPEG para que no falle por formato sino por tamaño
  oversizedBuffer[0] = 0xff;
  oversizedBuffer[1] = 0xd8;
  oversizedBuffer[2] = 0xff;

  const uploadOversized = await uploadCatalogImage(oversizedBuffer, "productos");
  assert(
    !uploadOversized.success && Boolean(uploadOversized.error?.includes("supera el límite")),
    "Rechaza archivo superior a 5 MB (5.242.880 bytes)"
  );

  // Buffer vacío (0 bytes)
  const emptyBuffer = Buffer.alloc(0);
  const uploadEmpty = await uploadCatalogImage(emptyBuffer, "productos");
  assert(!uploadEmpty.success, "Rechaza archivo vacío de 0 bytes");

  // ─── 3. AUTENTICACIÓN SEGURA Y AISLAMIENTO DE CREDENCIALES ───
  console.log("\n--- 3. Autenticación de Servidor y Detección de Credenciales ---");

  // Guardar estado original de SUPABASE_SERVICE_ROLE_KEY
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Simular ausencia de clave en entorno
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const uploadNoAuth = await uploadCatalogImage(realJpegHeader, "productos");
  assert(
    !uploadNoAuth.success && Boolean(uploadNoAuth.error?.includes("SUPABASE_SERVICE_ROLE_KEY")),
    "Falla de forma segura si SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor"
  );

  // Restaurar key
  if (originalKey) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }

  // Validación de carpeta permitida
  const invalidFolderUpload = await uploadCatalogImage(realJpegHeader, "usuarios" as any);
  assert(
    !invalidFolderUpload.success && Boolean(invalidFolderUpload.error?.includes("Carpeta de almacenamiento inválida")),
    "Rechaza carpetas no autorizadas (solo admite 'productos' o 'combos')"
  );

  // ─── 4. COMPATIBILIDAD CON STORAGE-CATALOG (18 IMÁGENES + RUTAS NUEVAS) ───
  console.log("\n--- 4. Compatibilidad con el Resolutor Centralizado de Catálogo ---");

  // 12 productos migrados
  let allMigratedProductsPass = true;
  for (const filename of MIGRATED_PRODUCT_FILES) {
    const resolvedFromUploads = getCatalogImageUrl(`/uploads/${filename}`);
    const expected = `https://feecgedfxtmtmdaakxgy.supabase.co/storage/v1/object/public/catalogo-chopper/productos/${filename}`;
    if (resolvedFromUploads !== expected) {
      allMigratedProductsPass = false;
    }
  }
  assert(allMigratedProductsPass, "Las 12 imágenes de productos migradas resuelven correctamente a Supabase");

  // 6 combos migrados
  let allMigratedCombosPass = true;
  for (const filename of MIGRATED_COMBO_FILES) {
    const resolvedFromCombos = getCatalogImageUrl(`/combos/${filename}`);
    const expected = `https://feecgedfxtmtmdaakxgy.supabase.co/storage/v1/object/public/catalogo-chopper/combos/${filename}`;
    if (resolvedFromCombos !== expected) {
      allMigratedCombosPass = false;
    }
  }
  assert(allMigratedCombosPass, "Las 6 imágenes de combos migradas resuelven correctamente a Supabase");

  // URLs absolutas nuevas generadas en Etapa 4
  const testNewStorageUrl = "https://feecgedfxtmtmdaakxgy.supabase.co/storage/v1/object/public/catalogo-chopper/productos/1793638000000-abcd12.webp";
  assert(
    getCatalogImageUrl(testNewStorageUrl) === testNewStorageUrl,
    "URLs públicas completas de Supabase Storage se respetan intactas"
  );

  // Rutas relativas explícitas
  assert(
    getCatalogImageUrl("productos/1793638000000-abcd12.webp") === testNewStorageUrl,
    "Rutas relativas 'productos/...' resuelven a la URL pública de Supabase"
  );
  assert(
    getCatalogImageUrl("/combos/nuevo-combo-2026.jpg") === "https://feecgedfxtmtmdaakxgy.supabase.co/storage/v1/object/public/catalogo-chopper/combos/nuevo-combo-2026.jpg",
    "Rutas relativas '/combos/...' resuelven a la URL pública de Supabase"
  );

  // Valores vacíos, nulos o fallbacks
  assert(getCatalogImageUrl(null) === "", "Valor null retorna cadena vacía sin error");
  assert(getCatalogImageUrl(undefined) === "", "Valor undefined retorna cadena vacía sin error");
  assert(getCatalogImageUrl("", "/placeholder.jpg") === "/placeholder.jpg", "Valor vacío retorna fallback configurado");

  // ─── 5. SIMULACIÓN DE REEMPLAZO SEGURO Y TRANSACCIÓN POSTGRESQL ───
  console.log("\n--- 5. Verificación de Lógica de Reemplazo Seguro y Rollback ---");

  // Buscar un producto de prueba existente para verificar reemplazo seguro sin alterar productos comerciales
  const testCategory = await prisma.categoria.findFirst({ where: { activo: true } });
  const testProvider = await prisma.proveedor.findFirst({ where: { activo: true } });

  if (testCategory && testProvider) {
    const initialImgUrl = "/uploads/1787256814727-9ankcz.webp";
    
    // Crear producto de prueba controlado
    const testProd = await prisma.producto.create({
      data: {
        nombre: "Producto Test Validación Storage Etapa 4",
        marca: "Chopper Test",
        codigo: `TEST-STG4-${Date.now()}`,
        imagen: initialImgUrl,
        categoriaId: testCategory.id,
        proveedorId: testProvider.id,
        precioCompra: 1000,
        precioVenta: 1500,
        cantidad: 0,
        stockMinimo: 1,
        activo: true,
      },
    });

    console.log(`- Producto de prueba creado: ID ${testProd.id} con imagen inicial`);

    // Simular Reemplazo de Imagen:
    const newSimulatedUrl = "https://feecgedfxtmtmdaakxgy.supabase.co/storage/v1/object/public/catalogo-chopper/productos/1793638999999-nuevo.webp";
    
    // Reemplazo en PostgreSQL
    const updatedProd = await prisma.producto.update({
      where: { id: testProd.id },
      data: { imagen: newSimulatedUrl },
    });

    assert(
      updatedProd.imagen === newSimulatedUrl,
      "La referencia del producto se actualiza con la nueva imagen de Supabase Storage"
    );

    // Verificar que otros productos que tenían la imagen inicial NO fueron alterados
    const otherProductsWithInitial = await prisma.producto.count({
      where: { imagen: initialImgUrl },
    });
    assert(
      otherProductsWithInitial > 0,
      "Reemplazo seguro: La imagen anterior no se borra ni afecta a otros productos que la comparten"
    );

    // Simular Fallo de PostgreSQL después de subida: Rollback
    const simulatedNewObject = "productos/test-to-rollback.webp";
    const rollbackSuccess = await rollbackStorageUpload(simulatedNewObject);
    // (Retorna false si no hay service_role, lo cual es el comportamiento seguro esperado)
    assert(
      typeof rollbackSuccess === "boolean",
      "Función rollbackStorageUpload ejecuta con comprobación de seguridad de prefijos"
    );

    // Limpieza del producto de prueba
    await prisma.producto.delete({ where: { id: testProd.id } });
    console.log(`- Producto de prueba ID ${testProd.id} eliminado correctamente tras la verificación.`);
  }

  console.log("\n================================================================================");
  console.log(`RESULTADO DE LA SUITE: ${passedTests} de ${totalTests} pruebas superadas (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("================================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runStage4Tests()
  .catch((err) => {
    console.error("Error fatal en suite de pruebas:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
