import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/pasantes_db",
  }),
});

const UPDATES: Record<number, { codigo: string; marca: string }> = {
  7: { codigo: "FRN-HON-CG150DISC290", marca: "Honda" },
  8: { codigo: "ACC-SUZ-RM500GUARD", marca: "Suzuki" },
  9: { codigo: "ELE-HON-YB9AA", marca: "Honda" },
  10: { codigo: "ELE-BAT-YTX14BS", marca: "Genérico" },
  11: { codigo: "ELE-BAT-ETX14BS", marca: "Genérico" },
  12: { codigo: "ELE-BAT-GYZ16H", marca: "Genérico" },
  13: { codigo: "ELE-GEN-CONDFUS", marca: "Genérico" },
};

async function main() {
  const marcas = await prisma.marca.findMany();
  const marcaMap = new Map(marcas.map((m) => [m.nombre, m.id]));

  for (const [idStr, data] of Object.entries(UPDATES)) {
    const id = Number(idStr);
    const marcaId = marcaMap.get(data.marca);
    await prisma.producto.update({
      where: { id },
      data: {
        codigo: data.codigo,
        marca: data.marca,
        marcaId: marcaId ?? null,
      },
    });
    console.log(`Producto ID ${id} actualizado con código "${data.codigo}" y marca "${data.marca}"`);
  }

  // Verificar si queda algún producto sin código
  const remainingWithoutCode = await prisma.producto.count({
    where: {
      OR: [{ codigo: null }, { codigo: "" }],
    },
  });

  console.log(`\nProductos restantes sin código: ${remainingWithoutCode}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
