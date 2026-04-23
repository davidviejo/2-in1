import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        app: "up",
        db: "up",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        app: "up",
        db: "down",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 503 }
    );
  }
}
