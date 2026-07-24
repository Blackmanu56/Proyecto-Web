import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaLogLevels: ("query" | "info" | "warn" | "error")[] =
  process.env.NODE_ENV === "production"
    ? ["error"]
    : process.env.PRISMA_LOG_QUERIES === "true"
      ? ["query", "warn", "error"]
      : ["warn", "error"];

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: prismaLogLevels,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
