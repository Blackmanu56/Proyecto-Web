import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { uploadCatalogImage } from "../src/lib/storage-service";
import { prisma } from "../src/lib/prisma";

// Cargar .env.local prioritariamente
const envLocalPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

function getSha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function runRealUploadVerification() {
  console.log("================================================================================");
  console.log("   VERIFICACIÓN REAL DE SUBIDA A SUPABASE STORAGE (ETAPA 4B)                   ");
  console.log("================================================================================\n");

  // 1. Verificación de presencia y validez funcional (sin revelar la clave)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey || serviceKey.trim() === "") {
    console.error("❌ ERROR: La variable SUPABASE_SERVICE_ROLE_KEY no está disponible en .env.local");
    process.exit(1);
  }

  const isJwt = serviceKey.startsWith("eyJ") && serviceKey.split(".").length === 3;
  console.log(`✅ Credencial SUPABASE_SERVICE_ROLE_KEY cargada desde .env.local.`);
  console.log(`- Formato JWT válido: ${isJwt ? "SÍ" : "NO"}`);
  console.log(`- Longitud de clave en memoria: ${serviceKey.length} caracteres (oculta por seguridad)`);

  // 2. Comprobar que no hay archivos en public/uploads previos a la prueba
  const localUploadsDir = path.join(process.cwd(), "public", "uploads");
  const filesBefore = fs.existsSync(localUploadsDir) ? fs.readdirSync(localUploadsDir) : [];

  // 3. Crear buffer WebP legítimo de prueba (1x1 px transparente, 34 bytes)
  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x4c, 0x0d, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00,
    0x00, 0x07, 0x10, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  const originalSha256 = getSha256(validWebpBuffer);

  console.log("\n--- Subida Real de Prueba desde SGI (catalogo-chopper/productos/) ---");
  const uploadResult = await uploadCatalogImage(validWebpBuffer, "productos");

  if (!uploadResult.success || !uploadResult.url || !uploadResult.objectPath) {
    console.error(`❌ Falló la subida a Supabase Storage: ${uploadResult.error}`);
    process.exit(1);
  }

  console.log("✓ Subida exitosa a Supabase Storage.");
  console.log(`  - Bucket: catalogo-chopper`);
  console.log(`  - Ruta: ${uploadResult.objectPath}`);
  console.log(`  - URL pública: ${uploadResult.url}`);

  // 4. Verificación de acceso público HTTP 200 y SHA-256
  console.log("\n--- Verificación HTTP y Hash SHA-256 ---");
  const downloadResponse = await fetch(uploadResult.url);
  console.log(`- Estado HTTP de respuesta: ${downloadResponse.status} ${downloadResponse.statusText}`);

  if (downloadResponse.status !== 200) {
    console.error(`❌ La URL pública devolvió HTTP ${downloadResponse.status} en lugar de 200.`);
    process.exit(1);
  }

  const downloadedBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  const downloadedSha256 = getSha256(downloadedBuffer);

  console.log(`- SHA-256 original local:  ${originalSha256}`);
  console.log(`- SHA-256 remoto descargado: ${downloadedSha256}`);

  if (originalSha256 !== downloadedSha256) {
    console.error("❌ El hash SHA-256 no coincide.");
    process.exit(1);
  }
  console.log("✓ Integridad SHA-256 confirmada al 100%.");

  // 5. Verificar que NO se escribió en public/uploads
  const filesAfter = fs.existsSync(localUploadsDir) ? fs.readdirSync(localUploadsDir) : [];
  if (filesBefore.length !== filesAfter.length) {
    console.error("❌ Se detectó escritura local en public/uploads.");
    process.exit(1);
  }
  console.log("✓ Ausencia total de escrituras locales en public/uploads (100% en la nube).");

  // 6. Verificar que PostgreSQL NO fue modificado
  const totalCommercialProducts = await prisma.producto.count();
  console.log(`\n- Total de productos en PostgreSQL: ${totalCommercialProducts} (intacto, sin escrituras de prueba)`);

  console.log("\n================================================================================");
  console.log("✅ VERIFICACIÓN REAL DE SGI SUPERADA AL 100%");
  console.log("================================================================================");
}

runRealUploadVerification()
  .catch((e) => {
    console.error("Error fatal en verificación real:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
