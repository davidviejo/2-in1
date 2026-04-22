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
  SeoInsightRuleScope,
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
  ruleScope?: SeoInsightRuleScope;
  appliesBecause?: string;
  applicableProjectTypes?: ProjectType[];
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

const normalizeSectorLabel = (sector: string) => sector.trim().toLowerCase();

const getContextReason = (scope: SeoInsightRuleScope, projectType: ProjectType, sector: string): string => {
  if (scope === 'sector') {
    return `Regla sectorial aplicada para ${sector}: prioriza patrones de demanda y conversión propios de este sector.`;
  }
  if (scope === 'project_type') {
    return `Regla específica para ${projectType}: se adapta a la tipología operativa del proyecto activo.`;
  }
  return `Regla genérica GSC: aplicable a cualquier proyecto y usada como baseline común del motor.`;
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
    ruleScope: candidate.ruleScope || 'generic',
    appliesBecause: candidate.appliesBecause || getContextReason(candidate.ruleScope || 'generic', context.projectType, context.sector),
    applicableProjectTypes: candidate.applicableProjectTypes || [context.projectType],
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
  analysisProjectTypes = [],
}: SeoInsightEngineInput): GSCInsightsEngineResult => {
  const activeProjectTypes = Array.from(new Set([projectType, ...analysisProjectTypes]));
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
      relatedRows: quickWins.map((row) => row.current),
      affectedCount: quickWins.length,
      potentialTraffic: Math.round(potentialTraffic),
      brandType: getBrandType(quickWins[0].query, brandTerms),
      findingFamily: 'quick_win',
      traceQuery: quickWins[0].query,
      traceUrl: quickWins[0].page,
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
      relatedRows: lowCtr.map((row) => row.current),
      affectedCount: lowCtr.length,
      potentialTraffic: Math.round(potentialTraffic),
      brandType: getBrandType(lowCtr[0].query, brandTerms),
      findingFamily: 'quick_win',
      traceQuery: lowCtr[0].query,
      traceUrl: lowCtr[0].page,
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
      relatedRows: risingImpressionsFlatClicks.map((row) => row.current),
      affectedCount: risingImpressionsFlatClicks.length,
      brandType: getBrandType(risingImpressionsFlatClicks[0].query, brandTerms),
      findingFamily: 'quick_win',
      traceQuery: risingImpressionsFlatClicks[0].query,
      traceUrl: risingImpressionsFlatClicks[0].page,
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
      relatedRows: declining.map((row) => row.current),
      affectedCount: declining.length,
      potentialTraffic: Math.round(lostClicks),
      brandType: 'mixed',
      findingFamily: 'anomaly',
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
      relatedRows: emergingQueries.map((row) => row.current),
      affectedCount: emergingQueries.length,
      brandType: getBrandType(emergingQueries[0].query, brandTerms),
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
    const supportingRows = expansionUrls.flatMap((item) => item.rows);
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
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
    });
  }

  const cannibalized: GSCRow[] = [];
  byQuery.forEach((rows, query) => {
    const significant = rows.filter((row) => row.impressions >= 80);
    if (significant.length >= 2) {
      const competingUrls = significant
        .map((row) => row.keys?.[1] || '')
        .filter((value) => value.trim().length > 0);
      const compactUrls = competingUrls.slice(0, 5).join(' | ');
      const urlsLabel = compactUrls
        ? `${significant.length} URLs: ${compactUrls}${competingUrls.length > 5 ? ' | ...' : ''}`
        : `${significant.length} URLs`;

      cannibalized.push({ ...significant[0], keys: [query, urlsLabel] });
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
      relatedRows: cannibalized,
      affectedCount: cannibalized.length,
      brandType: 'mixed',
      findingFamily: 'anomaly',
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
      relatedRows: ctrDropRows.map((row) => row.current),
      affectedCount: ctrDropRows.length,
      brandType: 'mixed',
      findingFamily: 'anomaly',
      traceQuery: ctrDropRows[0].query,
      traceUrl: ctrDropRows[0].page,
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
      relatedRows: topLossRows.map((row) => row.current),
      affectedCount: topLossRows.length,
      brandType: getBrandType(topLossRows[0].query, brandTerms),
      findingFamily: 'anomaly',
      traceQuery: topLossRows[0].query,
      traceUrl: topLossRows[0].page,
      ruleScope: 'generic',
      appliesBecause: getContextReason('generic', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
      relatedRows: currentRows,
      affectedCount: currentRows.length,
      brandType: 'mixed',
      findingFamily: 'anomaly',
      ruleScope: 'project_type',
      appliesBecause: getContextReason('project_type', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
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
      relatedRows: dominantUrlSwitchRows,
      affectedCount: dominantUrlSwitchRows.length,
      brandType: 'mixed',
      findingFamily: 'anomaly',
      traceQuery: dominantUrlSwitchRows[0].keys?.[0] || '',
      ruleScope: 'project_type',
      appliesBecause: getContextReason('project_type', projectType, sector),
      applicableProjectTypes: activeProjectTypes,
    });
  }

  const normalizedSector = normalizeSectorLabel(sector);
  const sectorSensitive = ['salud', 'estética', 'legal', 'turismo', 'inmobiliaria', 'saas', 'medios'];
  if (sectorSensitive.some((sectorName) => normalizedSector.includes(sectorName))) {
    const sectorRows = comparableRows.filter((row) => row.current.position <= 12 && row.current.impressions >= 100);
    if (sectorRows.length) {
      candidates.push({
        id: 'sectorIntentOpportunity',
        ruleKey: 'sector_specific_intent_opportunity',
        sourceType: 'query',
        sourceId: sectorRows[0].query || 'sector-intent',
        title: `Oportunidad de intención para sector ${sector}`,
        summary: `${sectorRows.length} filas muestran demanda cualificada para el sector y necesitan priorización editorial/comercial.`,
        reason: `El patrón detectado coincide con oportunidades típicas de ${sector} (intención con visibilidad y captura parcial).`,
        recommendation: 'Priorizar páginas/piezas con intención transaccional o informativa crítica del sector y conectar con tareas del roadmap.',
        category: 'opportunity',
        severity: 'medium',
        priority: 'medium',
        status: 'new',
        opportunity: 73,
        impact: normalize(sectorRows.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 68,
        confidence: 80,
        implementationEase: 72,
        businessValue: 83,
        moduleId: 6,
        effort: 40,
        evidence: sectorRows.slice(0, 3).map((row) => ({
          label: row.query,
          value: `${row.current.impressions} impr. · Pos ${row.current.position.toFixed(1)}`,
          context: row.page,
          metricKey: 'query',
        })),
        relatedRows: sectorRows.map((row) => row.current),
        affectedCount: sectorRows.length,
        brandType: getBrandType(sectorRows[0].query, brandTerms),
        findingFamily: 'insight',
        traceQuery: sectorRows[0].query,
        traceUrl: sectorRows[0].page,
        ruleScope: 'sector',
        appliesBecause: getContextReason('sector', projectType, sector),
        applicableProjectTypes: activeProjectTypes,
      });
    }
  }

  if (projectType === 'MEDIA') {
    const mediaLowCtrTop10 = comparableRows.filter((row) => row.current.position <= 10 && row.current.impressions >= 140 && row.current.ctr <= 0.03);
    if (mediaLowCtrTop10.length) {
      candidates.push({
        id: 'mediaLowCtrTop10',
        ruleKey: 'media_articles_top10_low_ctr',
        sourceType: 'url',
        sourceId: mediaLowCtrTop10[0].page || 'media-top10-low-ctr',
        title: 'MEDIA: artículos en top 10 con CTR bajo',
        summary: `${mediaLowCtrTop10.length} URLs editoriales en top 10 no capturan clic proporcional a su visibilidad.`,
        reason: 'Aplica a MEDIA: titulares y snippets tienen efecto directo en distribución de tráfico editorial.',
        recommendation: 'Reescribe title/meta y refuerza enlazado interno desde piezas del mismo clúster.',
        category: 'ctr',
        severity: 'medium',
        priority: 'high',
        status: 'new',
        opportunity: 81,
        impact: normalize(mediaLowCtrTop10.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 76,
        confidence: 86,
        implementationEase: 82,
        businessValue: 88,
        moduleId: 4,
        effort: 28,
        evidence: mediaLowCtrTop10.slice(0, 3).map((row) => ({ label: row.query, value: `Pos ${row.current.position.toFixed(1)} · ${(row.current.ctr * 100).toFixed(1)}% CTR`, context: row.page, metricKey: 'ctr' })),
        relatedRows: mediaLowCtrTop10.map((row) => row.current),
        affectedCount: mediaLowCtrTop10.length,
        brandType: getBrandType(mediaLowCtrTop10[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: mediaLowCtrTop10[0].query,
        traceUrl: mediaLowCtrTop10[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'MEDIA', sector),
        applicableProjectTypes: ['MEDIA'],
      });
    }

    const mediaCoverageExpansion = comparableRows.filter((row) => row.current.impressions >= 200 && row.current.position > 10 && row.current.position <= 20);
    if (mediaCoverageExpansion.length) {
      candidates.push({
        id: 'mediaCoverageExpansion',
        ruleKey: 'media_topics_expand_coverage',
        sourceType: 'cluster',
        sourceId: mediaCoverageExpansion[0].query || 'media-topics-coverage',
        title: 'MEDIA: temas con potencial de ampliar cobertura',
        summary: `${mediaCoverageExpansion.length} temas con demanda alta están cerca de primera página y piden extensión editorial.`,
        reason: 'Aplica a MEDIA: la cobertura temática incremental acelera crecimiento en Discover y búsqueda informativa.',
        recommendation: 'Crear piezas satélite y FAQs vinculadas al tema principal para ganar profundidad semántica.',
        category: 'content',
        severity: 'medium',
        priority: 'medium',
        status: 'new',
        opportunity: 76,
        impact: normalize(mediaCoverageExpansion.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 70,
        confidence: 80,
        implementationEase: 68,
        businessValue: 84,
        moduleId: 4,
        effort: 44,
        evidence: mediaCoverageExpansion.slice(0, 3).map((row) => ({ label: row.query, value: `${row.current.impressions} impr. · Pos ${row.current.position.toFixed(1)}`, context: row.page, metricKey: 'position' })),
        relatedRows: mediaCoverageExpansion.map((row) => row.current),
        affectedCount: mediaCoverageExpansion.length,
        brandType: getBrandType(mediaCoverageExpansion[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: mediaCoverageExpansion[0].query,
        traceUrl: mediaCoverageExpansion[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'MEDIA', sector),
        applicableProjectTypes: ['MEDIA'],
      });
    }

    const mediaLowDepthRows = comparableRows.filter((row) => row.current.impressions >= 300 && row.current.position <= 12);
    if (mediaLowDepthRows.length) {
      candidates.push({
        id: 'mediaLowClusterDepth',
        ruleKey: 'media_high_impressions_low_cluster_depth',
        sourceType: 'cluster',
        sourceId: mediaLowDepthRows[0].query || 'media-cluster-depth',
        title: 'MEDIA: impresiones altas y baja profundidad de clúster',
        summary: `${mediaLowDepthRows.length} oportunidades con alto alcance no tienen suficiente soporte de páginas relacionadas.`,
        reason: 'Aplica a MEDIA: mayor profundidad de clúster mejora autoridad topical y estabilidad de ranking.',
        recommendation: 'Completar clúster con piezas de apoyo y enlaces contextuales entre artículos relacionados.',
        category: 'coverage',
        severity: 'medium',
        priority: 'medium',
        status: 'new',
        opportunity: 74,
        impact: normalize(mediaLowDepthRows.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 64,
        confidence: 72,
        implementationEase: 73,
        businessValue: 81,
        moduleId: 7,
        effort: 40,
        evidence: mediaLowDepthRows.slice(0, 3).map((row) => ({ label: row.query, value: `${row.current.impressions} impr.`, context: row.page, metricKey: 'impressions' })),
        relatedRows: mediaLowDepthRows.map((row) => row.current),
        affectedCount: mediaLowDepthRows.length,
        brandType: getBrandType(mediaLowDepthRows[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: mediaLowDepthRows[0].query,
        traceUrl: mediaLowDepthRows[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'MEDIA', sector),
        applicableProjectTypes: ['MEDIA'],
      });
    }
  } else if (projectType === 'ECOM') {
    const ecommercePositions = comparableRows.filter((row) => row.current.position >= 4 && row.current.position <= 10 && row.current.impressions >= 100);
    if (ecommercePositions.length) {
      candidates.push({
        id: 'ecomCategoryPositions410',
        ruleKey: 'ecom_categories_products_positions_4_10',
        sourceType: 'url',
        sourceId: ecommercePositions[0].page || 'ecom-positions-4-10',
        title: 'ECOM: categorías o productos en posiciones 4–10',
        summary: `${ecommercePositions.length} PLP/PDP están cerca de top 3 y podrían escalar con cambios tácticos.`,
        reason: 'Aplica a ECOM: mover URLs transaccionales de 4–10 a top 3 impacta ventas de forma directa.',
        recommendation: 'Ajustar copy transaccional, schema de producto y enlaces desde categorías hermanas.',
        category: 'opportunity',
        severity: 'high',
        priority: 'high',
        status: 'new',
        opportunity: 84,
        impact: normalize(ecommercePositions.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 84,
        confidence: 82,
        implementationEase: 64,
        businessValue: 92,
        moduleId: 3,
        effort: 46,
        evidence: ecommercePositions.slice(0, 3).map((row) => ({ label: row.query, value: `Pos ${row.current.position.toFixed(1)}`, context: row.page, metricKey: 'position' })),
        relatedRows: ecommercePositions.map((row) => row.current),
        affectedCount: ecommercePositions.length,
        brandType: getBrandType(ecommercePositions[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: ecommercePositions[0].query,
        traceUrl: ecommercePositions[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'ECOM', sector),
        applicableProjectTypes: ['ECOM'],
      });
    }

    const ecomPlpLowCtr = comparableRows.filter((row) => row.page.toLowerCase().includes('/categoria') || row.page.toLowerCase().includes('/category') || row.page.toLowerCase().includes('/shop'));
    const ecomPlpLowCtrFiltered = ecomPlpLowCtr.filter((row) => row.current.impressions >= 140 && row.current.position <= 12 && row.current.ctr < 0.025);
    if (ecomPlpLowCtrFiltered.length) {
      candidates.push({
        id: 'ecomPlpCtr',
        ruleKey: 'ecom_plp_low_ctr',
        sourceType: 'url',
        sourceId: ecomPlpLowCtrFiltered[0].page || 'ecom-plp-ctr',
        title: 'ECOM: PLPs con CTR mejorable',
        summary: `${ecomPlpLowCtrFiltered.length} páginas de listado tienen visibilidad pero bajo rendimiento de clic.`,
        reason: 'Aplica a ECOM: en PLP el snippet y la propuesta comercial condicionan CTR y sesiones cualificadas.',
        recommendation: 'Optimizar title/meta con atributos de compra (precio, envío, stock) y testear snippets.',
        category: 'ctr',
        severity: 'medium',
        priority: 'high',
        status: 'new',
        opportunity: 79,
        impact: normalize(ecomPlpLowCtrFiltered.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 78,
        confidence: 77,
        implementationEase: 74,
        businessValue: 87,
        moduleId: 6,
        effort: 34,
        evidence: ecomPlpLowCtrFiltered.slice(0, 3).map((row) => ({ label: row.query, value: `${(row.current.ctr * 100).toFixed(1)}% CTR`, context: row.page, metricKey: 'ctr' })),
        relatedRows: ecomPlpLowCtrFiltered.map((row) => row.current),
        affectedCount: ecomPlpLowCtrFiltered.length,
        brandType: getBrandType(ecomPlpLowCtrFiltered[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: ecomPlpLowCtrFiltered[0].query,
        traceUrl: ecomPlpLowCtrFiltered[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'ECOM', sector),
        applicableProjectTypes: ['ECOM'],
      });
    }

    const ecomNoDominantUrl = Array.from(byQuery.entries())
      .map(([query, rows]) => {
        const totalQueryClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
        const topClicks = [...rows].sort((a, b) => b.clicks - a.clicks)[0]?.clicks || 0;
        const dominance = totalQueryClicks > 0 ? topClicks / totalQueryClicks : 0;
        return { query, rows, dominance, totalQueryClicks };
      })
      .filter((item) => item.rows.length >= 2 && item.totalQueryClicks >= 20 && item.dominance < 0.6);
    if (ecomNoDominantUrl.length) {
      const lead = ecomNoDominantUrl[0];
      candidates.push({
        id: 'ecomNoDominantUrl',
        ruleKey: 'ecom_commercial_query_without_dominant_url',
        sourceType: 'query',
        sourceId: lead.query,
        title: 'ECOM: queries comerciales sin URL dominante clara',
        summary: `${ecomNoDominantUrl.length} queries distribuyen clics entre varias URLs y diluyen señal comercial.`,
        reason: 'Aplica a ECOM: una URL dominante por intención mejora conversión y reduce canibalización interna.',
        recommendation: 'Definir URL canónica de intención, consolidar enlazado y alinear títulos para esa página.',
        category: 'position',
        severity: 'medium',
        priority: 'medium',
        status: 'new',
        opportunity: 77,
        impact: normalize(ecomNoDominantUrl.reduce((sum, item) => sum + item.totalQueryClicks, 0), totalClicks || 1),
        urgency: 72,
        confidence: 80,
        implementationEase: 66,
        businessValue: 85,
        moduleId: 3,
        effort: 42,
        evidence: lead.rows.slice(0, 3).map((row) => ({ label: lead.query, value: `${row.clicks} clics`, context: row.keys?.[1] || '', metricKey: 'url' })),
        relatedRows: lead.rows,
        affectedCount: ecomNoDominantUrl.length,
        brandType: getBrandType(lead.query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: lead.query,
        traceUrl: lead.rows[0]?.keys?.[1] || '',
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'ECOM', sector),
        applicableProjectTypes: ['ECOM'],
      });
    }
  } else if (projectType === 'LOCAL') {
    const localServiceCityRows = comparableRows.filter((row) => row.current.position >= 4 && row.current.position <= 10 && /\b([a-záéíóúñ]+)\s+(madrid|barcelona|valencia|sevilla|bilbao|zaragoza|city)\b/i.test(row.query));
    if (localServiceCityRows.length) {
      candidates.push({
        id: 'localServiceCity410',
        ruleKey: 'local_service_city_positions_4_10',
        sourceType: 'query',
        sourceId: localServiceCityRows[0].query || 'local-service-city-410',
        title: 'LOCAL: servicios + ciudad en posiciones 4–10',
        summary: `${localServiceCityRows.length} búsquedas locales de servicio están cerca de capturar demanda de alta intención.`,
        reason: 'Aplica a LOCAL: ganar posiciones en consultas servicio+ciudad suele traducirse en leads directos.',
        recommendation: 'Optimizar landings locales con NAP, reseñas y bloques de confianza por ciudad.',
        category: 'position',
        severity: 'medium',
        priority: 'high',
        status: 'new',
        opportunity: 82,
        impact: normalize(localServiceCityRows.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 85,
        confidence: 78,
        implementationEase: 70,
        businessValue: 89,
        moduleId: 5,
        effort: 38,
        evidence: localServiceCityRows.slice(0, 3).map((row) => ({ label: row.query, value: `Pos ${row.current.position.toFixed(1)}`, context: row.page, metricKey: 'position' })),
        relatedRows: localServiceCityRows.map((row) => row.current),
        affectedCount: localServiceCityRows.length,
        brandType: getBrandType(localServiceCityRows[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: localServiceCityRows[0].query,
        traceUrl: localServiceCityRows[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'LOCAL', sector),
        applicableProjectTypes: ['LOCAL'],
      });
    }

    const localBranded = comparableRows.filter((row) => getBrandType(row.query, brandTerms) === 'brand' && row.current.impressions >= 120);
    const localServiceWeak = comparableRows.filter((row) => getBrandType(row.query, brandTerms) === 'non-brand' && row.current.position > 10 && row.current.impressions >= 80);
    if (localBranded.length && localServiceWeak.length) {
      candidates.push({
        id: 'localBrandedVsServiceGap',
        ruleKey: 'local_branded_strong_service_weak',
        sourceType: 'query',
        sourceId: localServiceWeak[0].query || 'local-gap',
        title: 'LOCAL: branded local fuerte pero servicio local débil',
        summary: `Señal mixta: ${localBranded.length} queries brand fuertes y ${localServiceWeak.length} queries de servicio con captación baja.`,
        reason: 'Aplica a LOCAL: notoriedad de marca sin cobertura de servicio limita crecimiento en captación nueva.',
        recommendation: 'Expandir contenido de servicios y enlazarlo desde páginas de marca y fichas locales.',
        category: 'content',
        severity: 'medium',
        priority: 'medium',
        status: 'new',
        opportunity: 75,
        impact: normalize(localServiceWeak.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 70,
        confidence: 79,
        implementationEase: 72,
        businessValue: 84,
        moduleId: 5,
        effort: 32,
        evidence: localServiceWeak.slice(0, 3).map((row) => ({ label: row.query, value: `${row.current.impressions} impr.`, context: row.page, metricKey: 'impressions' })),
        relatedRows: localServiceWeak.map((row) => row.current),
        affectedCount: localServiceWeak.length,
        brandType: 'mixed',
        findingFamily: 'quick_win',
        traceQuery: localServiceWeak[0].query,
        traceUrl: localServiceWeak[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'LOCAL', sector),
        applicableProjectTypes: ['LOCAL'],
      });
    }

    const localGrowingServicePages = comparableRows.filter((row) => row.previous && row.deltaImpressions > 0 && row.current.impressions >= 100 && /servicio|service|tratamiento|consulta/i.test(row.page));
    if (localGrowingServicePages.length) {
      candidates.push({
        id: 'localGrowingServicePages',
        ruleKey: 'local_service_pages_rising_impressions',
        sourceType: 'url',
        sourceId: localGrowingServicePages[0].page || 'local-growing-pages',
        title: 'LOCAL: páginas de servicio con impresiones crecientes',
        summary: `${localGrowingServicePages.length} páginas de servicio muestran crecimiento de visibilidad y requieren empuje final.`,
        reason: 'Aplica a LOCAL: consolidar páginas con tendencia positiva acelera captación en zonas prioritarias.',
        recommendation: 'Añadir FAQs locales, CTAs por ciudad y enlaces desde páginas de mayor autoridad local.',
        category: 'performance',
        severity: 'low',
        priority: 'medium',
        status: 'new',
        opportunity: 72,
        impact: normalize(localGrowingServicePages.reduce((sum, row) => sum + row.deltaImpressions, 0), totalImpressions || 1),
        urgency: 65,
        confidence: 73,
        implementationEase: 76,
        businessValue: 80,
        moduleId: 7,
        effort: 30,
        evidence: localGrowingServicePages.slice(0, 3).map((row) => ({ label: row.page, value: `+${Math.round(row.deltaImpressions)} impr.`, context: row.query, metricKey: 'impressions' })),
        relatedRows: localGrowingServicePages.map((row) => row.current),
        affectedCount: localGrowingServicePages.length,
        brandType: getBrandType(localGrowingServicePages[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: localGrowingServicePages[0].query,
        traceUrl: localGrowingServicePages[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'LOCAL', sector),
        applicableProjectTypes: ['LOCAL'],
      });
    }
  } else if (projectType === 'NATIONAL') {
    const nationalCtrRows = comparableRows.filter((row) => row.current.impressions >= 160 && row.current.position <= 10 && row.current.ctr < 0.03);
    if (nationalCtrRows.length) {
      candidates.push({
        id: 'nationalStrategicServicesCtr',
        ruleKey: 'national_strategic_services_low_ctr',
        sourceType: 'query',
        sourceId: nationalCtrRows[0].query || 'national-ctr',
        title: 'NATIONAL: servicios estratégicos con CTR mejorable',
        summary: `${nationalCtrRows.length} consultas estratégicas tienen visibilidad nacional con margen claro en snippet.`,
        reason: 'Aplica a NATIONAL: optimizar CTR en términos estratégicos amplifica cuota de mercado nacional.',
        recommendation: 'Reformular mensajes de valor en title/meta para servicio principal y validar rich snippets.',
        category: 'ctr',
        severity: 'medium',
        priority: 'high',
        status: 'new',
        opportunity: 78,
        impact: normalize(nationalCtrRows.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
        urgency: 75,
        confidence: 84,
        implementationEase: 77,
        businessValue: 86,
        moduleId: 2,
        effort: 30,
        evidence: nationalCtrRows.slice(0, 3).map((row) => ({ label: row.query, value: `${(row.current.ctr * 100).toFixed(1)}% CTR`, context: row.page, metricKey: 'ctr' })),
        relatedRows: nationalCtrRows.map((row) => row.current),
        affectedCount: nationalCtrRows.length,
        brandType: getBrandType(nationalCtrRows[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: nationalCtrRows[0].query,
        traceUrl: nationalCtrRows[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'NATIONAL', sector),
        applicableProjectTypes: ['NATIONAL'],
      });
    }

    const nationalHubGrowth = comparableRows.filter((row) => row.previous && row.deltaImpressions > 50 && row.current.position <= 15);
    if (nationalHubGrowth.length) {
      candidates.push({
        id: 'nationalHubsGrowth',
        ruleKey: 'national_thematic_hubs_growth',
        sourceType: 'cluster',
        sourceId: nationalHubGrowth[0].query || 'national-hub-growth',
        title: 'NATIONAL: hubs temáticos con crecimiento',
        summary: `${nationalHubGrowth.length} señales muestran crecimiento sostenido en temas escalables a nivel nacional.`,
        reason: 'Aplica a NATIONAL: crecer por hubs permite capturar demanda amplia sin fragmentar autoridad.',
        recommendation: 'Priorizar hubs con mayor crecimiento y completar satélites de intención secundaria.',
        category: 'content',
        severity: 'low',
        priority: 'medium',
        status: 'new',
        opportunity: 73,
        impact: normalize(nationalHubGrowth.reduce((sum, row) => sum + row.deltaImpressions, 0), totalImpressions || 1),
        urgency: 62,
        confidence: 76,
        implementationEase: 69,
        businessValue: 82,
        moduleId: 4,
        effort: 41,
        evidence: nationalHubGrowth.slice(0, 3).map((row) => ({ label: row.query, value: `+${Math.round(row.deltaImpressions)} impr.`, context: row.page, metricKey: 'impressions' })),
        relatedRows: nationalHubGrowth.map((row) => row.current),
        affectedCount: nationalHubGrowth.length,
        brandType: getBrandType(nationalHubGrowth[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: nationalHubGrowth[0].query,
        traceUrl: nationalHubGrowth[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'NATIONAL', sector),
        applicableProjectTypes: ['NATIONAL'],
      });
    }
  } else if (projectType === 'INTERNATIONAL') {
    const internationalGapRows = comparableRows.filter((row) => row.previous && row.relativeClickChange !== null && row.relativeClickChange < -0.25 && row.current.impressions >= 120);
    if (internationalGapRows.length) {
      candidates.push({
        id: 'internationalWorstRelativeGap',
        ruleKey: 'international_markets_worst_relative_gap',
        sourceType: 'property',
        sourceId: propertyId,
        title: 'INTERNATIONAL: propiedades/mercados con peor gap relativo',
        summary: `${internationalGapRows.length} combinaciones query/URL presentan caída relativa significativa frente al periodo anterior.`,
        reason: 'Aplica a INTERNATIONAL: identificar brechas relativas por mercado permite corregir desalineaciones rápido.',
        recommendation: 'Priorizar mercados con mayor caída relativa y revisar despliegues de contenido/hreflang.',
        category: 'risk',
        severity: 'high',
        priority: 'high',
        status: 'new',
        opportunity: 80,
        impact: normalize(internationalGapRows.reduce((sum, row) => sum + Math.max(0, -row.deltaClicks), 0), totalClicks || 1),
        urgency: 88,
        confidence: 83,
        implementationEase: 58,
        businessValue: 90,
        moduleId: 1,
        effort: 58,
        evidence: internationalGapRows.slice(0, 3).map((row) => ({ label: row.query, value: `${((row.relativeClickChange || 0) * 100).toFixed(1)}% Δclics`, context: row.page, metricKey: 'clicks' })),
        relatedRows: internationalGapRows.map((row) => row.current),
        affectedCount: internationalGapRows.length,
        brandType: getBrandType(internationalGapRows[0].query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: internationalGapRows[0].query,
        traceUrl: internationalGapRows[0].page,
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'INTERNATIONAL', sector),
        applicableProjectTypes: ['INTERNATIONAL'],
      });
    }

    const internationalInconsistencies = Array.from(byQuery.entries())
      .map(([query, rows]) => ({ query, rows, maxPosition: Math.max(...rows.map((row) => row.position)), minPosition: Math.min(...rows.map((row) => row.position)) }))
      .filter((item) => item.rows.length >= 2 && item.maxPosition - item.minPosition >= 8);
    if (internationalInconsistencies.length) {
      const lead = internationalInconsistencies[0];
      candidates.push({
        id: 'internationalPropertyInconsistencies',
        ruleKey: 'international_inconsistencies_between_properties',
        sourceType: 'query',
        sourceId: lead.query,
        title: 'INTERNATIONAL: inconsistencias entre propiedades',
        summary: `${internationalInconsistencies.length} queries muestran variación fuerte de posicionamiento entre URLs/propiedades activas.`,
        reason: 'Aplica a INTERNATIONAL: inconsistencias por mercado/propiedad reducen eficiencia del portfolio global.',
        recommendation: 'Homogeneizar templates, interlinking y señales hreflang entre propiedades equivalentes.',
        category: 'coverage',
        severity: 'medium',
        priority: 'medium',
        status: 'new',
        opportunity: 74,
        impact: normalize(internationalInconsistencies.reduce((sum, item) => sum + item.rows.reduce((rowSum, row) => rowSum + row.impressions, 0), 0), totalImpressions || 1),
        urgency: 72,
        confidence: 78,
        implementationEase: 61,
        businessValue: 85,
        moduleId: 9,
        effort: 52,
        evidence: lead.rows.slice(0, 3).map((row) => ({ label: lead.query, value: `Pos ${row.position.toFixed(1)}`, context: row.keys?.[1] || '', metricKey: 'position' })),
        relatedRows: lead.rows,
        affectedCount: internationalInconsistencies.length,
        brandType: getBrandType(lead.query, brandTerms),
        findingFamily: 'quick_win',
        traceQuery: lead.query,
        traceUrl: lead.rows[0]?.keys?.[1] || '',
        ruleScope: 'project_type',
        appliesBecause: getContextReason('project_type', 'INTERNATIONAL', sector),
        applicableProjectTypes: ['INTERNATIONAL'],
      });
    }
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
      items: [...currentRows].sort((a, b) => b.clicks - a.clicks),
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
