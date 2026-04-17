import { ActionPlanItem, AuditInput, AuditOutput, Listing } from "@/lib/types";

type BuildReportParams = {
  input: AuditInput;
  target: Listing;
  competitors: AuditOutput["competitors"];
  scoring: AuditOutput["scoring"];
};

const formatAction = (
  action: string,
  impact: ActionPlanItem["impact"],
  difficulty: ActionPlanItem["difficulty"],
  priority: ActionPlanItem["priority"],
  confidence: number,
  evidence: string
): ActionPlanItem => ({ action, impact, difficulty, priority, confidence, evidence });

export function buildAuditReport({ input, target, competitors, scoring }: BuildReportParams): AuditOutput {
  const direct = competitors.filter((c) => c.classification === "directo");
  const top3 = direct.slice(0, 3).map((item) => item.listing);
  const scoreAverage = Math.round(scoring.reduce((acc, item) => acc + item.score, 0) / (scoring.length || 1));

  const weaknesses = scoring.filter((item) => item.gap < 0).sort((a, b) => a.gap - b.gap);
  const strengths = scoring.filter((item) => item.gap >= 0).sort((a, b) => b.gap - a.gap);

  const topProblems = weaknesses.slice(0, 3).map((item) => `${item.label} por debajo del benchmark (${item.score} vs ${item.benchmark}).`);
  const topOpportunities = [
    "Refuerzo de señales de categoría y servicios en GBP.",
    "Plan de captación y frescura de reseñas con cadencia semanal.",
    "Optimizar ficha y web local para intención transaccional de la keyword."
  ];

  const quickWins: ActionPlanItem[] = [
    formatAction(
      "Actualizar categorías secundarias y atributos diferenciales.",
      "alto",
      "baja",
      "P1",
      0.85,
      "Gap de completitud frente al top competitivo."
    ),
    formatAction(
      "Publicar 2-3 posts semanales en perfil de negocio con CTA local.",
      "medio",
      "baja",
      "P2",
      0.73,
      "Entorno con alta actividad competitiva y señales de frescura."
    )
  ];

  const midTerm: ActionPlanItem[] = [
    formatAction(
      "Implementar sistema de solicitud de reseñas por WhatsApp/email post-servicio.",
      "alto",
      "media",
      "P1",
      0.81,
      `Top 3 competidores acumulan ${Math.round(
        top3.reduce((acc, cur) => acc + cur.reviewCount, 0) / (top3.length || 1)
      )} reseñas promedio.`
    ),
    formatAction(
      "Crear landing local orientada a \"" + input.primaryKeyword + " " + input.location + "\".",
      "medio",
      "media",
      "P2",
      0.77,
      "Mejora de alineación semántica entre ficha y sitio enlazado."
    )
  ];

  const strategic: ActionPlanItem[] = [
    formatAction(
      "Diseñar roadmap de 90 días con ownership por canal (ficha, reputación, on-page, citaciones).",
      "alto",
      "alta",
      "P1",
      0.7,
      "Necesidad de sostener ganancias de visibilidad tras quick wins."
    )
  ];

  return {
    summary: {
      status: scoreAverage >= 80 ? "competitivo" : scoreAverage >= 65 ? "estable con brechas" : "vulnerable",
      topProblems,
      topOpportunities,
      globalPriority: scoreAverage >= 75 ? "Consolidar y escalar" : "Cerrar brechas críticas en 30 días"
    },
    competitors,
    scoring,
    findings: {
      observedFacts: [
        `Ficha auditada: ${target.businessName} (${target.primaryCategory}).`,
        `Se analizaron ${competitors.length} negocios comparables para la keyword \"${input.primaryKeyword}\" en ${input.location}.`
      ],
      calculatedComparisons: scoring.map((item) => `${item.label}: ${item.score} vs benchmark ${item.benchmark} (gap ${item.gap}).`),
      reasonedInferences: [
        "La falta de señal semántica y volumen de reseñas impacta la probabilidad de entrar en top local.",
        "Competidores directos con mayor consistencia de ficha muestran mejor tracción visible."
      ]
    },
    actionPlan: {
      quickWins,
      midTerm,
      strategic
    },
    technicalReport:
      "Informe técnico: la auditoría aplica reglas de clasificación competitiva, scoring por bloques y evidencias trazables. La IA solo redacta e interpreta a partir de métricas derivadas.",
    commercialReport:
      "Informe comercial: existe oportunidad clara de mejora de visibilidad local en 30-90 días con acciones priorizadas por impacto/dificultad y una hoja de ruta ejecutable."
  };
}
