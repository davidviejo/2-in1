import { GSCRow, InsightFlowTrace, InsightSourceMeta, Task } from '../types';
import { SeoInsight } from '../types/seoInsights';

const normalizeCategory = (category: SeoInsight['category']): 'opportunity' | 'risk' =>
  category === 'risk' ? 'risk' : 'opportunity';

const safePosition = (value: unknown): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : 'N/A';
};

const safeCtr = (value: unknown): string => {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : 'N/A';
};

export const buildInsightFlowTrace = (insight: SeoInsight, row: GSCRow): InsightFlowTrace => ({
  finding: row.keys?.[0] || insight.title,
  insight: {
    id: insight.id,
    title: insight.title,
    summary: insight.summary,
    reason: insight.reason,
  },
  opportunityOrRisk: normalizeCategory(insight.category),
  recommendedAction: insight.action,
  evidence: [
    ...insight.evidence,
    { label: 'Query', value: row.keys?.[0] || 'N/A' },
    { label: 'URL', value: row.keys?.[1] || 'N/A' },
    { label: 'Posición', value: safePosition(row.position) },
    { label: 'CTR', value: safeCtr(row.ctr) },
  ],
  impact: {
    score: insight.score,
    confidence: insight.confidence,
    opportunity: insight.opportunity,
    businessValue: insight.businessValue,
  },
  source: {
    tool: 'seo_dashboard_gsc_insights',
    query: row.keys?.[0],
    url: row.keys?.[1],
  },
  phase: 'phase1',
});

export const buildInsightSourceMeta = (insight: SeoInsight, row: GSCRow): InsightSourceMeta => ({
  insightId: insight.id,
  sourceType: insight.sourceType || 'query',
  sourceLabel: insight.title,
  moduleId: insight.moduleId,
  metricsSnapshot: {
    score: insight.score,
    confidence: insight.confidence,
    opportunity: insight.opportunity,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.ctr,
    position: row.position,
  },
  periodContext: {
    current: insight.periodCurrent
      ? `${insight.periodCurrent.startDate}..${insight.periodCurrent.endDate}`
      : undefined,
    previous: insight.periodPrevious
      ? `${insight.periodPrevious.startDate}..${insight.periodPrevious.endDate}`
      : undefined,
  },
  property: insight.propertyId,
  query: row.keys?.[0],
  url: row.keys?.[1],
  timestamp: Date.now(),
});

export const buildTaskFromInsight = (insight: SeoInsight, row: GSCRow): Partial<Task> => {
  const query = row.keys?.[0] || 'consulta';
  return {
    title: `Optimizar: ${query}`,
    description: [
      `Insight: ${insight.title}`,
      `Resumen: ${insight.summary}`,
      `Motivo: ${insight.reason}`,
      `Acción sugerida: ${insight.action}`,
      `Query: ${row.keys?.[0] || 'N/A'}`,
      `URL: ${row.keys?.[1] || 'N/A'}`,
      `Posición: ${safePosition(row.position)}`,
      `CTR: ${safeCtr(row.ctr)}`,
    ].join('\n'),
    impact: insight.priority === 'high' ? 'High' : insight.priority === 'medium' ? 'Medium' : 'Low',
    category: 'Strategy',
    status: 'pending',
    isCustom: true,
    isInCustomRoadmap: true,
    flow: buildInsightFlowTrace(insight, row),
    insightSourceMeta: buildInsightSourceMeta(insight, row),
  };
};
