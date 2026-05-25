import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Creando usuario administrador");

  const adminRole = await prisma.rol.upsert({
    where: { nombre: "ADMINISTRADOR" },
    update: {},
    create: { nombre: "ADMINISTRADOR" },
  });

  const passwordHash = await bcrypt.hash("1234", 10);

  const admin = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {
      passwordHash,
      rolId: adminRole.id,
    },
    create: {
      username: "admin",
      passwordHash,
      rolId: adminRole.id,
    },
  });

  console.log("✅ Usuario admin creado/actualizado:", admin.username);
}

main()
  .catch((error) => {
    console.error("❌ Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });