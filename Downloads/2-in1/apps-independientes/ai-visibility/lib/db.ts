import { PrismaClient } from "@prisma/client";

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return;
  }

  throw new Error(
    "DATABASE_URL is required. Configure a Supabase Postgres connection string in your environment before starting the app."
  );
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

ensureDatabaseUrl();

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
