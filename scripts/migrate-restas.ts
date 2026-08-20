/**
 * One-time data migration: extracts old [RESTAR STOCK] entries from
 * HistorialEstado into MovimientoProducto.
 *
 * Run AFTER schema migration (npx prisma migrate deploy).
 * Safe to re-run: skips products that already have MovimientoProducto
 * entries for the same timestamp.
 *
 * Usage: npx tsx scripts/migrate-restas.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const restas = await prisma.$queryRaw<
    Array<{
      id: number;
      producto_id: number;
      usuario_id: number;
      observacion: string;
      fecha: Date;
    }>
  >`
    SELECT id, producto_id, usuario_id, observacion, fecha
    FROM historial_estado_producto
    WHERE estado_anterior = 'ACTIVO'
      AND estado_nuevo = 'ACTIVO'
      AND observacion LIKE '[RESTAR STOCK]%'
  `;

  console.log(`Found ${restas.length} old [RESTAR STOCK] entries to migrate`);

  if (restas.length === 0) {
    console.log("Nothing to migrate. Done.");
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const resta of restas) {
    // Parse observacion string:
    // [RESTAR STOCK] Motivo: {motivo}. Cantidad descontada: {qty}. Stock anterior: {prev}. Stock nuevo: {next}[. Observación: {obs}]
    const motivoMatch = resta.observacion.match(
      /^\[RESTAR STOCK\] Motivo: (.*?)\./
    );
    const cantidadMatch = resta.observacion.match(
      /Cantidad descontada: (\d+)/
    );
    const anteriorMatch = resta.observacion.match(/Stock anterior: (\d+)/);
    const nuevoMatch = resta.observacion.match(/Stock nuevo: (\d+)/);

    if (!motivoMatch || !cantidadMatch || !anteriorMatch || !nuevoMatch) {
      console.warn(
        `Skipping resta #${resta.id}: failed to parse observacion`
      );
      skipped++;
      continue;
    }

    const motivo = motivoMatch[1];
    const cantidadAnterior = parseInt(anteriorMatch[1], 10);
    const cantidadNueva = parseInt(nuevoMatch[1], 10);

    // Check for duplicate: same product, same timestamp, RESTA_MANUAL type
    const existing = await prisma.movimientoProducto.findFirst({
      where: {
        productoId: resta.producto_id,
        tipo: "RESTA_MANUAL",
        createdAt: resta.fecha,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.movimientoProducto.create({
      data: {
        productoId: resta.producto_id,
        usuarioId: resta.usuario_id,
        tipo: "RESTA_MANUAL",
        cantidadAnterior,
        cantidadNueva,
        motivo,
        observacion: resta.observacion,
        createdAt: resta.fecha,
      },
    });

    migrated++;
  }

  console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
