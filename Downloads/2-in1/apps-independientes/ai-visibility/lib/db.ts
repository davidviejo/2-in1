import { PrismaClient } from "@prisma/client";

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is required in production. Set it in your environment before starting the app."
    );
  }

  const user = process.env.POSTGRES_USER ?? "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? "postgres";
  const database = process.env.POSTGRES_DB ?? "ai_visibility";
  const port = process.env.POSTGRES_PORT ?? "5432";

  process.env.DATABASE_URL = `postgresql://${user}:${password}@localhost:${port}/${database}?schema=public`;

  console.warn(
    `[db] DATABASE_URL was not set. Using local fallback ${process.env.DATABASE_URL}`
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
