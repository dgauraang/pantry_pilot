import { PrismaClient } from "@prisma/client";

function normalizeDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("sqlite:/")) {
    process.env.DATABASE_URL = `file:${url.slice("sqlite:".length)}`;
  }
}

normalizeDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
