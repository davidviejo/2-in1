import { NextResponse } from "next/server";
import { classifyCompetitors } from "@/lib/competitors";
import { MOCK_LISTINGS } from "@/lib/mockData";
import { buildAuditReport } from "@/lib/report";
import { calculateScoring } from "@/lib/scoring";
import { AuditInput } from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json()) as AuditInput;

  if (!input.businessName || !input.primaryKeyword || !input.location) {
    return NextResponse.json({ error: "Faltan campos obligatorios: negocio, keyword principal, ubicación." }, { status: 400 });
  }

  const normalizedName = input.businessName.toLowerCase();
  const target =
    MOCK_LISTINGS.find((entry) => entry.businessName.toLowerCase().includes(normalizedName)) ??
    MOCK_LISTINGS[0];

  const competitors = classifyCompetitors(input, target, MOCK_LISTINGS).filter((item) => item.classification !== "irrelevante");

  const benchmarkListings = competitors.slice(0, 5).map((item) => item.listing);
  const scoring = calculateScoring(target, benchmarkListings);
  const report = buildAuditReport({ input, target, competitors, scoring });

  return NextResponse.json({
    auditId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    dataPolicy:
      "PoC sin scraping de Google Maps. Datos simulados + modelo de análisis para auditorías puntuales. Si se usa Places real, aplicar FieldMask y atribución.",
    report
  });
}
