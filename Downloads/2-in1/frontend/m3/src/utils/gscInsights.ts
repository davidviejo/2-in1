import { ProjectType, GSCRow } from '../types';
import {
  INSIGHT_CATEGORY_META,
  SEO_INSIGHT_CATALOG,
  SEO_INSIGHT_PRIORITY_WEIGHTS,
  SEO_INSIGHT_THRESHOLDS,
} from '../config/seoInsights';
import {
  expectedCtrForPosition,
  resolveGscOpportunityThresholds,
} from '../config/gscOpportunityRules';
import {
  SeoInsight,
  SeoInsightBrandType,
  SeoInsightCategory,
  SeoInsightDateRange,
  SeoInsightEngineInput,
  SeoInsightMetricEvidence,
  SeoInsightPriority,
  SeoInsightSeverity,
  SeoInsightSummary,
} from '../types/seoInsights';
import { classifyQueryBrandSegment } from './queryBrandSegment';

export interface InsightResult {
  title: string;
  description: string;
  count: number;
  potentialTraffic?: number;
  items: GSCRow[];
}

interface QueryPageAggregate {
  key: string;
  query: string;
  page: string;
  current: GSCRow;
  previous?: GSCRow;
  deltaClicks: number;
  deltaImpressions: number;
  relativeClickChange: number | null;
}

interface InsightCandidate {
  id: string;
  title: string;
  summary: string;
  reason: string;
  recommendation: string;
  category: SeoInsightCategory;
  severity: SeoInsightSeverity;
  priority: SeoInsightPriority;
  status: SeoInsight['status'];
  ruleKey: string;
  sourceType: SeoInsight['sourceType'];
  sourceId: string;
  opportunity: number;
  impact: number;
  urgency: number;
  confidence: number;
  implementationEase: number;
  businessValue: number;
  effort?: number;
  moduleId?: number;
  evidence: SeoInsightMetricEvidence[];
  relatedRows: GSCRow[];
  affectedCount: number;
  potentialTraffic?: number;
  brandType: SeoInsightBrandType;
  findingFamily?: 'quick_win' | 'anomaly' | 'insight';
  traceQuery?: string;
  traceUrl?: string;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const normalize = (value: number, max: number) => clamp((value / Math.max(max, 1)) * 100);
const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const buildAggregateMaps = (rows: GSCRow[]) => {
  const byKey = new Map<string, GSCRow>();
  const byQuery = new Map<string, GSCRow[]>();
  const byPage = new Map<string, GSCRow[]>();

  rows.forEach((row) => {
    const query = row.keys?.[0] || '';
    const page = row.keys?.[1] || '';
    byKey.set(`${query}||${page}`, row);
    byQuery.set(query, [...(byQuery.get(query) || []), row]);
    if (page) byPage.set(page, [...(byPage.get(page) || []), row]);
  });

  return { byKey, byQuery, byPage };
};

const buildComparableRows = (currentRows: GSCRow[], previousRows: GSCRow[]) => {
  const { byKey: previousByKey } = buildAggregateMaps(previousRows);

  return currentRows.map((current) => {
    const query = current.keys?.[0] || '';
    const page = current.keys?.[1] || '';
    const previous = previousByKey.get(`${query}||${page}`);
    const deltaClicks = current.clicks - (previous?.clicks || 0);
    const deltaImpressions = current.impressions - (previous?.impressions || 0);

    return {
      key: `${query}||${page}`,
      query,
      page,
      current,
      previous,
      deltaClicks,
      deltaImpressions,
      relativeClickChange: previous && previous.clicks > 0 ? deltaClicks / previous.clicks : null,
    } satisfies QueryPageAggregate;
  });
};

const scoreInsight = (input: Pick<InsightCandidate, 'businessValue' | 'impact' | 'urgency' | 'confidence' | 'implementationEase'>) => {
  const weights = SEO_INSIGHT_PRIORITY_WEIGHTS;
  return Math.round(
    input.businessValue * weights.businessValue +
      input.impact * weights.impact +
      input.urgency * weights.urgency +
      input.confidence * weights.confidence +
      input.implementationEase * weights.implementationEase,
  );
};

const getBrandType = (query: string, brandTerms: string[] = []): SeoInsightBrandType => {
  const classification = classifyQueryBrandSegment(query, brandTerms);
  return classification.segment;
};

const toInsight = (
  candidate: InsightCandidate,
  context: {
    propertyId: string;
    periodCurrent: SeoInsightDateRange;
    periodPrevious?: SeoInsightDateRange;
    projectType: ProjectType;
    sector: string;
    geoScope: string;
  },
): SeoInsight => {
  const config = SEO_INSIGHT_CATALOG[candidate.id] || { icon: 'Lightbulb', tone: 'blue' };
  const now = Date.now();

  return {
    id: `${candidate.id}-${candidate.sourceId}`,
    sourceType: candidate.sourceType,
    sourceId: candidate.sourceId,
    propertyId: context.propertyId,
    category: candidate.category,
    ruleKey: candidate.ruleKey,
    title: candidate.title,
    description: candidate.summary,
    priority: candidate.priority,
    severity: candidate.severity,
    score: scoreInsight(candidate),
    opportunity: candidate.opportunity,
    confidence: candidate.confidence,
    effort: candidate.effort,
    moduleId: candidate.moduleId,
    suggestedAction: candidate.recommendation,
    status: candidate.status,
    periodCurrent: context.periodCurrent,
    periodPrevious: context.periodPrevious,
    evidence: candidate.evidence,
    metricsSupport: candidate.relatedRows.map((row) => ({
      query: row.keys?.[0] || '',
      url: row.keys?.[1] || '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    })),
    brandType: candidate.brandType,
    projectType: context.projectType,
    sector: context.sector,
    geoScope: context.geoScope,
    firstDetectedAt: now,
    updatedAt: now,
    createdAt: now,
    findingFamily: candidate.findingFamily || 'insight',
    trace: {
      source: 'gsc',
      family: candidate.findingFamily || 'insight',
      propertyId: context.propertyId,
      periodCurrent: context.periodCurrent,
      periodPrevious: context.periodPrevious,
      query: candidate.traceQuery,
      url: candidate.traceUrl,
      moduleId: candidate.moduleId,
      timestamp: now,
    },

    summary: candidate.summary,
    reason: candidate.reason,
    action: candidate.recommendation,
    visualContext: {
      icon: config.icon,
      tone: config.tone,
      categoryLabel: INSIGHT_CATEGORY_META[candidate.category].label,
    },
    affectedCount: candidate.affectedCount,
    businessValue: candidate.businessValue,
    implementationEase: candidate.implementationEase,
    impact: candidate.impact,
    urgency: candidate.urgency,
    ease: candidate.implementationEase,
    relatedRows: candidate.relatedRows,
    metrics: {
      potentialTraffic: candidate.potentialTraffic,
    },
  };
};

const summarizeGroup = (category: SeoInsightCategory, insights: SeoInsight[]): SeoInsightSummary => ({
  category,
  label: INSIGHT_CATEGORY_META[category].label,
  description: INSIGHT_CATEGORY_META[category].description,
  count: insights.length,
  topPriority: insights[0]?.priority || 'low',
  insights,
});

const legacyCard = (insight: SeoInsight | undefined, fallbackTitle: string): InsightResult => ({
  title: insight?.title || fallbackTitle,
  description: insight?.summary || 'Sin señales suficientes para este insight.',
  count: insight?.affectedCount || 0,
  potentialTraffic: insight?.metrics.potentialTraffic,
  items: insight?.relatedRows || [],
});

export interface GSCInsightsEngineResult {
  insights: SeoInsight[];
  groupedInsights: SeoInsightSummary[];
  topOpportunities: SeoInsight[];
  topRisks: SeoInsight[];
  quickWinsLayer: SeoInsight[];
  anomaliesLayer: SeoInsight[];
  quickWins: InsightResult;
  strikingDistance: InsightResult;
  lowCtr: InsightResult;
  topQueries: InsightResult;
  cannibalization: InsightResult;
  zeroClicks: InsightResult;
  featuredSnippets: InsightResult;
  stagnantTraffic: InsightResult;
  seasonality: InsightResult;
  stableUrls: InsightResult;
  internalRedirects: InsightResult;
}

export const analyzeGSCInsights = ({
  currentRows,
  previousRows = [],
  propertyId = 'sc-property',
  periodCurrent = { startDate: '', endDate: '' },
  periodPrevious,
  brandTerms = [],
  projectType = 'MEDIA',
  sector = 'Generico',
  geoScope = 'global',
}: SeoInsightEngineInput): GSCInsightsEngineResult => {
  const comparableRows = buildComparableRows(currentRows, previousRows).filter((row) => row.current.impressions > 0);
  const { byQuery, byPage } = buildAggregateMaps(currentRows);

  const totalImpressions = currentRows.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = currentRows.reduce((sum, row) => sum + row.clicks, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const thresholds = SEO_INSIGHT_THRESHOLDS;
  const opportunityThresholds = resolveGscOpportunityThresholds(projectType, sector);

  const candidates: InsightCandidate[] = [];

  const quickWins = comparableRows.filter(({ current }) => current.position >= opportunityThresholds.quickWinPositionMin && current.position <= opportunityThresholds.quickWinPositionMax && current.impressions >= opportunityThresholds.quickWinMinImpressions);
  if (quickWins.length) {
    const potentialTraffic = quickWins.reduce((sum, row) => sum + Math.max(0, row.current.impressions * 0.1 - row.current.clicks), 0);
    candidates.push({
      id: 'quickWins',
      ruleKey: 'positions_4_10_high_impressions',
      sourceType: 'query',
      sourceId: quickWins[0].query || 'quickwins',
      title: 'Posiciones 4–10 con impresiones suficientes',
      summary: `${quickWins.length} combinaciones query/URL están listas para escalar con optimizaciones de snippet y on-page.`,
      reason: 'Hay demanda y visibilidad: pequeños cambios pueden mover estas queries al top 3.',
      recommendation: 'Optimiza title/meta, enlazado interno y enriquecimiento semántico para capturar más clics.',
      category: 'opportunity',
      severity: 'medium',
      priority: potentialTraffic > 150 ? 'high' : 'medium',
      status: 'new',
      opportunity: clamp(Math.round(potentialTraffic)),
      impact: normalize(potentialTraffic, totalImpressions || 1),
      urgency: 74,
      confidence: 88,
      implementationEase: 82,
      businessValue: 84,
      moduleId: 3,
      effort: 30,
      evidence: quickWins.slice(0, 3).map((row) => ({
        label: row.query,
        value: `Pos ${row.current.position.toFixed(1)} · ${(row.current.ctr * 100).toFixed(1)}% CTR`,
        context: row.page,
        metricKey: 'position',
      })),
      relatedRows: quickWins.map((row) => row.current).slice(0, 50),
      affectedCount: quickWins.length,
      potentialTraffic: Math.round(potentialTraffic),
      brandType: getBrandType(quickWins[0].query, brandTerms),
      findingFamily: 'quick_win',
      traceQuery: quickWins[0].query,
      traceUrl: quickWins[0].page,
    });
  }

  const lowCtr = comparableRows.filter(({ current }) => current.position <= thresholds.lowCtr.maxPosition && current.impressions >= opportunityThresholds.lowCtrMinImpressions && current.ctr < expectedCtrForPosition(current.position) - opportunityThresholds.lowCtrDeltaFromExpected);
  if (lowCtr.length) {
    const potentialTraffic = lowCtr.reduce((sum, row) => sum + Math.max(0, row.current.impressions * Math.max(avgCtr, 0.04) - row.current.clicks), 0);
    candidates.push({
      id: 'lowCtr',
      ruleKey: 'low_ctr_for_position',
      sourceType: 'query',
      sourceId: lowCtr[0].query || 'low-ctr',
      title: 'CTR bajo para la posición actual',
      summary: `${lowCtr.length} resultados tienen visibilidad pero su snippet no está capturando clics.`,
      reason: 'La brecha entre posición e interés indica mejora rápida con copy y rich snippets.',
      recommendation: 'Ejecuta test de title/meta y valida rich results en queries con más impresiones.',
      category: 'ctr',
      severity: 'high',
      priority: potentialTraffic > 120 ? 'high' : 'medium',
      status: 'new',
      opportunity: clamp(Math.round(potentialTraffic)),
      impact: normalize(potentialTraffic, totalImpressions || 1),
      urgency: 80,
      confidence: 90,
      implementationEase: 84,
      businessValue: 88,
      moduleId: 3,
      effort: 20,
      evidence: lowCtr.slice(0, 3).map((row) => ({ label: row.query, value: `${(row.current.ctr * 100).toFixed(1)}% CTR`, context: row.page, metricKey: 'ctr' })),
      relatedRows: lowCtr.map((row) => row.current).slice(0, 50),
      affectedCount: lowCtr.length,
      potentialTraffic: Math.round(potentialTraffic),
      brandType: getBrandType(lowCtr[0].query, brandTerms),
      findingFamily: 'quick_win',
      traceQuery: lowCtr[0].query,
      traceUrl: lowCtr[0].page,
    });
  }

  const risingImpressionsFlatClicks = comparableRows.filter(({ current, previous, deltaImpressions, deltaClicks }) => !!previous && deltaImpressions > previous.impressions * opportunityThresholds.impressionsGrowthNoClicksMinGrowthRatio && deltaClicks <= 0 && current.impressions >= opportunityThresholds.impressionsGrowthNoClicksMinImpressions);
  if (risingImpressionsFlatClicks.length) {
    candidates.push({
      id: 'stagnantTraffic',
      ruleKey: 'impressions_growth_without_clicks_growth',
      sourceType: 'url',
      sourceId: risingImpressionsFlatClicks[0].page || 'flat-clicks',
      title: 'Crecen impresiones sin crecer clics',
      summary: `${risingImpressionsFlatClicks.length} filas muestran demanda creciente sin tracción en clics.`,
      reason: 'Se incrementa exposición pero no mejora el atractivo o encaje del resultado.',
      recommendation: 'Prioriza ajuste de intención y snippet en URLs con mayor crecimiento de impresiones.',
      category: 'performance',
      severity: 'medium',
      priority: 'medium',
      status: 'new',
      opportunity: 72,
      impact: normalize(risingImpressionsFlatClicks.reduce((acc, item) => acc + item.deltaImpressions, 0), totalImpressions || 1),
      urgency: 70,
      confidence: 84,
      implementationEase: 72,
      businessValue: 76,
      moduleId: 4,
      effort: 35,
      evidence: risingImpressionsFlatClicks.slice(0, 3).map((row) => ({ label: row.query, value: `+${Math.round(row.deltaImpressions)} impr. / ${row.deltaClicks} clics`, context: row.page, metricKey: 'impressions' })),
      relatedRows: risingImpressionsFlatClicks.map((row) => row.current).slice(0, 50),
      affectedCount: risingImpressionsFlatClicks.length,
      brandType: getBrandType(risingImpressionsFlatClicks[0].query, brandTerms),
      findingFamily: 'quick_win',
      traceQuery: risingImpressionsFlatClicks[0].query,
      traceUrl: risingImpressionsFlatClicks[0].page,
    });
  }

  const declining = comparableRows.filter(({ previous, current, relativeClickChange }) => !!previous && current.impressions >= thresholds.decline.minImpressions && (relativeClickChange || 0) <= -0.25);
  if (declining.length) {
    const lostClicks = declining.reduce((sum, row) => sum + Math.max(0, -row.deltaClicks), 0);
    candidates.push({
      id: 'decliningPages',
      ruleKey: 'click_drop_vs_previous_period',
      sourceType: 'property',
      sourceId: propertyId,
      title: 'Caída de clics vs periodo anterior',
      summary: `${declining.length} combinaciones caen de forma significativa en clics.`,
      reason: 'La tendencia apunta a pérdida competitiva o desalineación con la intención de búsqueda.',
      recommendation: 'Audita cambios recientes, cobertura y canibalización para recuperar demanda.',
      category: 'risk',
      severity: 'critical',
      priority: 'high',
      status: 'new',
      opportunity: clamp(Math.round(lostClicks * 10)),
      impact: normalize(lostClicks, totalClicks || 1),
      urgency: 96,
      confidence: 92,
      implementationEase: 48,
      businessValue: 95,
      moduleId: 1,
      effort: 70,
      evidence: declining.slice(0, 3).map((row) => ({ label: row.query, value: `${Math.round(Math.abs(row.deltaClicks))} clics perdidos`, context: row.page, metricKey: 'clicks' })),
      relatedRows: declining.map((row) => row.current).slice(0, 50),
      affectedCount: declining.length,
      potentialTraffic: Math.round(lostClicks),
      brandType: 'mixed',
      findingFamily: 'anomaly',
    });
  }

  const emergingQueries = comparableRows.filter(({ previous, current }) => !previous && current.impressions >= 120 && current.clicks >= 5);
  if (emergingQueries.length) {
    candidates.push({
      id: 'featuredSnippets',
      ruleKey: 'emerging_queries',
      sourceType: 'query',
      sourceId: emergingQueries[0].query || 'emerging',
      title: 'Query emergente detectada',
      summary: `${emergingQueries.length} queries nuevas empiezan a traccionar y requieren validación editorial.`,
      reason: 'Nuevas intenciones aparecen en GSC y pueden convertirse en clústeres de crecimiento.',
      recommendation: 'Crear/ajustar contenidos y enlazado interno para consolidar la demanda emergente.',
      category: 'opportunity',
      severity: 'medium',
      priority: 'medium',
      status: 'new',
      opportunity: 68,
      impact: normalize(emergingQueries.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
      urgency: 66,
      confidence: 78,
      implementationEase: 74,
      businessValue: 82,
      moduleId: 6,
      effort: 45,
      evidence: emergingQueries.slice(0, 3).map((row) => ({ label: row.query, value: `${row.current.clicks} clics · ${row.current.impressions} impr.`, context: row.page, metricKey: 'query' })),
      relatedRows: emergingQueries.map((row) => row.current).slice(0, 50),
      affectedCount: emergingQueries.length,
      brandType: getBrandType(emergingQueries[0].query, brandTerms),
    });
  }

  const expansionUrls = Array.from(byPage.entries())
    .map(([url, rows]) => ({
      url,
      rows,
      queryCount: rows.length,
      impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
      ctr: rows.reduce((sum, row) => sum + row.ctr, 0) / Math.max(rows.length, 1),
    }))
.filter((row) => row.queryCount >= opportunityThresholds.urlCoverageMinQueries && row.impressions >= opportunityThresholds.urlCoverageMinImpressions && row.ctr <= opportunityThresholds.urlCoverageMaxCtr);
  if (expansionUrls.length) {
    const supportingRows = expansionUrls.flatMap((item) => item.rows).slice(0, 50);
    candidates.push({
      id: 'contentExpansion',
      ruleKey: 'url_many_queries_low_capture',
      sourceType: 'url',
      sourceId: expansionUrls[0].url,
      title: 'URL con muchas queries y baja captura',
      summary: `${expansionUrls.length} URLs cubren muchas consultas, pero capturan poco clic relativo.`,
      reason: 'Es una señal clara de oportunidad de optimización de contenido y arquitectura.',
      recommendation: 'Consolidar intención principal, mejorar bloques de respuesta y enlazado contextual.',
      category: 'content',
      severity: 'medium',
      priority: 'medium',
      status: 'new',
      opportunity: clamp(Math.round(average(expansionUrls.map((item) => item.impressions / 10)))),
      impact: normalize(expansionUrls.reduce((sum, row) => sum + row.impressions, 0), totalImpressions || 1),
      urgency: 64,
      confidence: 85,
      implementationEase: 66,
      businessValue: 81,
      moduleId: 6,
      effort: 50,
      evidence: expansionUrls.slice(0, 3).map((row) => ({ label: row.url, value: `${row.queryCount} queries`, context: `${Math.round(row.impressions)} impr.`, metricKey: 'url' })),
      relatedRows: supportingRows,
      affectedCount: expansionUrls.length,
      brandType: 'mixed',
      findingFamily: 'quick_win',
      traceUrl: expansionUrls[0].url,
    });
  }

  const cannibalized: GSCRow[] = [];
  byQuery.forEach((rows, query) => {
    const significant = rows.filter((row) => row.impressions >= 80);
    if (significant.length >= 2) {
      cannibalized.push({ ...significant[0], keys: [query, `${significant.length} URLs`] });
    }
  });
  if (cannibalized.length) {
    candidates.push({
      id: 'cannibalization',
      ruleKey: 'basic_cannibalization',
      sourceType: 'query',
      sourceId: cannibalized[0].keys?.[0] || 'cannibalization',
      title: 'Posible canibalización básica',
      summary: `${cannibalized.length} queries con múltiples URLs compitiendo en paralelo.`,
      reason: 'La autoridad se reparte entre URLs y reduce estabilidad del ranking.',
      recommendation: 'Definir URL canónica por intención y consolidar señales internas.',
      category: 'risk',
      severity: 'high',
      priority: cannibalized.length >= 5 ? 'high' : 'medium',
      status: 'new',
      opportunity: clamp(cannibalized.reduce((sum, row) => sum + row.impressions, 0) / 10),
      impact: normalize(cannibalized.reduce((sum, row) => sum + row.impressions, 0), totalImpressions || 1),
      urgency: 82,
      confidence: 84,
      implementationEase: 42,
      businessValue: 88,
      moduleId: 2,
      effort: 75,
      evidence: cannibalized.slice(0, 3).map((row) => ({ label: row.keys?.[0] || '', value: row.keys?.[1] || '', context: `${row.impressions} impr.`, metricKey: 'query' })),
      relatedRows: cannibalized.slice(0, 50),
      affectedCount: cannibalized.length,
      brandType: 'mixed',
      findingFamily: 'anomaly',
    });
  }


  const ctrDropRows = comparableRows.filter(({ previous, current }) =>
    !!previous &&
    previous.ctr > 0 &&
    current.impressions >= opportunityThresholds.lowCtrMinImpressions &&
    (previous.ctr - current.ctr) / previous.ctr >= opportunityThresholds.abruptCtrDropMinRatio,
  );
  if (ctrDropRows.length) {
    candidates.push({
      id: 'ctrDropAnomaly',
      ruleKey: 'abrupt_ctr_drop_vs_previous_period',
      sourceType: 'query',
      sourceId: ctrDropRows[0].query || 'ctr-drop',
      title: 'Caída brusca de CTR',
      summary: `${ctrDropRows.length} combinaciones query/URL pierden CTR frente al periodo anterior.`,
      reason: 'Cambios de snippet o nuevas SERP features están afectando la captación.',
      recommendation: 'Revisar snippets, rich results y encaje de intención en URLs críticas.',
      category: 'risk',
      severity: 'high',
      priority: 'high',
      status: 'new',
      opportunity: 84,
      impact: normalize(ctrDropRows.reduce((sum, row) => sum + (row.previous?.impressions || 0), 0), totalImpressions || 1),
      urgency: 92,
      confidence: 86,
      implementationEase: 60,
      businessValue: 90,
      moduleId: 3,
      effort: 45,
      evidence: ctrDropRows.slice(0, 3).map((row) => ({
        label: row.query,
        value: `${((row.previous?.ctr || 0) * 100).toFixed(1)}% → ${(row.current.ctr * 100).toFixed(1)}%`,
        context: row.page,
        metricKey: 'ctr',
      })),
      relatedRows: ctrDropRows.map((row) => row.current).slice(0, 50),
      affectedCount: ctrDropRows.length,
      brandType: 'mixed',
      findingFamily: 'anomaly',
      traceQuery: ctrDropRows[0].query,
      traceUrl: ctrDropRows[0].page,
    });
  }

  const topLossRows = comparableRows.filter(({ previous, current }) =>
    !!previous &&
    previous.position <= 10 &&
    current.position - previous.position >= opportunityThresholds.topLossMinPositionShift &&
    current.impressions >= opportunityThresholds.quickWinMinImpressions,
  );
  if (topLossRows.length) {
    candidates.push({
      id: 'topPositionLossAnomaly',
      ruleKey: 'top3_top10_position_loss',
      sourceType: 'query',
      sourceId: topLossRows[0].query || 'top-loss',
      title: 'Pérdida de posiciones Top 3 / Top 10',
      summary: `${topLossRows.length} filas han perdido posiciones clave en rankings competitivos.`,
      reason: 'La pérdida de estabilidad en top rankings reduce tráfico incremental de forma inmediata.',
      recommendation: 'Priorizar recuperación de URLs afectadas con refuerzo interno y ajuste semántico.',
      category: 'risk',
      severity: 'critical',
      priority: 'high',
      status: 'new',
      opportunity: 90,
      impact: normalize(topLossRows.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
      urgency: 95,
      confidence: 88,
      implementationEase: 46,
      businessValue: 94,
      moduleId: 1,
      effort: 70,
      evidence: topLossRows.slice(0, 3).map((row) => ({
        label: row.query,
        value: `Pos ${row.previous?.position.toFixed(1)} → ${row.current.position.toFixed(1)}`,
        context: row.page,
        metricKey: 'position',
      })),
      relatedRows: topLossRows.map((row) => row.current).slice(0, 50),
      affectedCount: topLossRows.length,
      brandType: getBrandType(topLossRows[0].query, brandTerms),
      findingFamily: 'anomaly',
      traceQuery: topLossRows[0].query,
      traceUrl: topLossRows[0].page,
    });
  }

  const previousTotalClicks = previousRows.reduce((sum, row) => sum + row.clicks, 0);
  const propertyDropRatio = previousTotalClicks > 0 ? (previousTotalClicks - totalClicks) / previousTotalClicks : 0;
  if (previousTotalClicks > 0 && propertyDropRatio >= opportunityThresholds.propertyDropMinRatio) {
    candidates.push({
      id: 'propertyDropAnomaly',
      ruleKey: 'property_significant_drop_vs_previous_period',
      sourceType: 'property',
      sourceId: propertyId,
      title: 'Caída significativa de la propiedad',
      summary: `La propiedad cae ${Math.round(propertyDropRatio * 100)}% en clics respecto al periodo anterior.`,
      reason: 'El deterioro agregado requiere revisión transversal por propiedad y portfolio.',
      recommendation: 'Abrir revisión prioritaria en roadmap: cobertura, snippets, clusters y cambios técnicos recientes.',
      category: 'risk',
      severity: 'critical',
      priority: 'high',
      status: 'new',
      opportunity: clamp(Math.round(propertyDropRatio * 100)),
      impact: normalize(previousTotalClicks - totalClicks, previousTotalClicks || 1),
      urgency: 98,
      confidence: 94,
      implementationEase: 40,
      businessValue: 97,
      moduleId: 1,
      effort: 80,
      evidence: [{
        label: propertyId,
        value: `${previousTotalClicks.toLocaleString()} clics → ${totalClicks.toLocaleString()} clics`,
        context: 'Comparativa de propiedad',
        metricKey: 'clicks',
      }],
      relatedRows: currentRows.slice(0, 50),
      affectedCount: currentRows.length,
      brandType: 'mixed',
      findingFamily: 'anomaly',
    });
  }

  const previousByQuery = buildAggregateMaps(previousRows).byQuery;
  const dominantUrlSwitchRows: GSCRow[] = [];
  previousByQuery.forEach((previousQueryRows, query) => {
    const currentQueryRows = byQuery.get(query);
    if (!currentQueryRows || currentQueryRows.length < 2 || previousQueryRows.length < 2) return;

    const prevSorted = [...previousQueryRows].sort((a, b) => b.clicks - a.clicks);
    const currSorted = [...currentQueryRows].sort((a, b) => b.clicks - a.clicks);
    const prevTop = prevSorted[0];
    const currTop = currSorted[0];
    if (!prevTop || !currTop || prevTop.keys?.[1] === currTop.keys?.[1]) return;
    if (currTop.impressions < opportunityThresholds.dominantUrlSwitchMinImpressions) return;
    const prevShare = prevTop.clicks / Math.max(1, previousQueryRows.reduce((s, row) => s + row.clicks, 0));
    const currShare = currTop.clicks / Math.max(1, currentQueryRows.reduce((s, row) => s + row.clicks, 0));
    if (currShare - prevShare < opportunityThresholds.dominantUrlSwitchMinShareChange) return;

    dominantUrlSwitchRows.push({ ...currTop, keys: [query, `${prevTop.keys?.[1] || ''} → ${currTop.keys?.[1] || ''}`] });
  });

  if (dominantUrlSwitchRows.length) {
    candidates.push({
      id: 'dominantUrlSwitchAnomaly',
      ruleKey: 'important_query_dominant_url_switch',
      sourceType: 'query',
      sourceId: dominantUrlSwitchRows[0].keys?.[0] || 'dominant-url-switch',
      title: 'Query importante cambia de URL dominante',
      summary: `${dominantUrlSwitchRows.length} queries han cambiado su URL dominante respecto al periodo previo.`,
      reason: 'Puede indicar canibalización o desalineación de intención sobre la URL objetivo.',
      recommendation: 'Validar URL objetivo por query y consolidar señales para estabilizar la página correcta.',
      category: 'risk',
      severity: 'high',
      priority: 'high',
      status: 'new',
      opportunity: 82,
      impact: normalize(dominantUrlSwitchRows.reduce((sum, row) => sum + row.impressions, 0), totalImpressions || 1),
      urgency: 88,
      confidence: 84,
      implementationEase: 52,
      businessValue: 89,
      moduleId: 2,
      effort: 60,
      evidence: dominantUrlSwitchRows.slice(0, 3).map((row) => ({
        label: row.keys?.[0] || '',
        value: row.keys?.[1] || '',
        context: `${row.impressions} impr.`,
        metricKey: 'url',
      })),
      relatedRows: dominantUrlSwitchRows.slice(0, 50),
      affectedCount: dominantUrlSwitchRows.length,
      brandType: 'mixed',
      findingFamily: 'anomaly',
      traceQuery: dominantUrlSwitchRows[0].keys?.[0] || '',
    });
  }

  const sortedInsights = candidates
    .map((candidate) =>
      toInsight(candidate, { propertyId, periodCurrent, periodPrevious, projectType, sector, geoScope }),
    )
    .sort((a, b) => b.score - a.score);

  const groupedInsights = (Object.keys(INSIGHT_CATEGORY_META) as SeoInsightCategory[])
    .map((category) => summarizeGroup(category, sortedInsights.filter((insight) => insight.category === category)))
    .filter((group) => group.count > 0);

  return {
    insights: sortedInsights,
    groupedInsights,
    topOpportunities: sortedInsights.filter((insight) => insight.category === 'opportunity').slice(0, 3),
    topRisks: sortedInsights.filter((insight) => insight.category === 'risk').slice(0, 3),
    quickWinsLayer: sortedInsights.filter((insight) => insight.findingFamily === 'quick_win'),
    anomaliesLayer: sortedInsights.filter((insight) => insight.findingFamily === 'anomaly'),
    quickWins: legacyCard(sortedInsights.find((insight) => insight.id.startsWith('quickWins')), 'Quick wins de primera página'),
    strikingDistance: legacyCard(sortedInsights.find((insight) => insight.id.startsWith('strikingDistance')), 'Consultas al borde de primera página'),
    lowCtr: legacyCard(sortedInsights.find((insight) => insight.id.startsWith('lowCtr')), 'CTR bajo para la posición actual'),
    topQueries: {
      title: 'Top consultas',
      description: 'Consultas con más clics en el periodo actual.',
      count: currentRows.length,
      items: [...currentRows].sort((a, b) => b.clicks - a.clicks).slice(0, 50),
    },
    cannibalization: legacyCard(sortedInsights.find((insight) => insight.id.startsWith('cannibalization')), 'Posible canibalización'),
    zeroClicks: legacyCard(sortedInsights.find((insight) => insight.id.startsWith('zeroClicks')), 'Impresiones sin captación'),
    featuredSnippets: legacyCard(sortedInsights.find((insight) => insight.id.startsWith('featuredSnippets')), 'Query emergente detectada'),
    stagnantTraffic: legacyCard(sortedInsights.find((insight) => insight.id.startsWith('stagnantTraffic')), 'Crecen impresiones sin crecer clics'),
    seasonality: { title: 'Estacionalidad', description: 'Sin señal suficiente.', count: 0, items: [] },
    stableUrls: { title: 'URLs estables', description: 'Sin señal suficiente.', count: 0, items: [] },
    internalRedirects: legacyCard(sortedInsights.find((insight) => insight.id.startsWith('internalRedirects')), 'URLs con señales de limpieza técnica'),
  };
};

export const analyzeQuickWins = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).quickWins;
export const analyzeStrikingDistance = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).strikingDistance;
export const analyzeLowCtr = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).lowCtr;
export const getTopPerforming = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).topQueries;
export const analyzeCannibalization = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).cannibalization;
export const analyzeZeroClickQueries = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).zeroClicks;
export const analyzeFeaturedSnippets = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).featuredSnippets;
export const analyzeStagnantTraffic = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).stagnantTraffic;
export const analyzeSeasonality = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).seasonality;
export const analyzeStableUrls = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).stableUrls;
export const analyzeInternalRedirects = (rows: GSCRow[]): InsightResult => analyzeGSCInsights({ currentRows: rows }).internalRedirects;
