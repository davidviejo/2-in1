import { GSCRow } from '../types';
import {
  INSIGHT_CATEGORY_META,
  SEO_INSIGHT_CATALOG,
  SEO_INSIGHT_PRIORITY_WEIGHTS,
  SEO_INSIGHT_THRESHOLDS,
} from '../config/seoInsights';
import {
  SeoInsight,
  SeoInsightCategory,
  SeoInsightEngineInput,
  SeoInsightEvidence,
  SeoInsightPriority,
  SeoInsightSeverity,
  SeoInsightStatus,
  SeoInsightSummary,
} from '../types/seoInsights';

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
  deltaCtr: number;
  deltaPosition: number;
  relativeClickChange: number | null;
  relativeImpressionChange: number | null;
  relativeCtrChange: number | null;
}

interface InsightCandidate {
  id: string;
  title: string;
  summary: string;
  reason: string;
  recommendation: string;
  category: SeoInsightCategory;
  severity: SeoInsightSeverity;
  status: SeoInsightStatus;
  priority: SeoInsightPriority;
  opportunity: number;
  impact: number;
  urgency: number;
  confidence: number;
  implementationEase: number;
  businessValue: number;
  score: number;
  evidence: SeoInsightEvidence[];
  relatedRows: GSCRow[];
  affectedCount: number;
  potentialTraffic?: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const normalize = (value: number, max: number) => clamp((value / Math.max(max, 1)) * 100);

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const formatMetric = (metric: string, value: number) => {
  if (metric === 'ctr') return `${(value * 100).toFixed(1)}%`;
  if (metric === 'position') return value.toFixed(1);
  return Math.round(value).toLocaleString('es-ES');
};

const buildEvidence = (
  label: string,
  rows: QueryPageAggregate[],
  metric: keyof QueryPageAggregate | 'ctr' | 'position',
  maxItems = 3,
): SeoInsightEvidence[] =>
  rows.slice(0, maxItems).map((row) => ({
    label: `${label}: ${row.query}`,
    value:
      metric === 'ctr'
        ? formatMetric('ctr', row.current.ctr)
        : metric === 'position'
          ? formatMetric('position', row.current.position)
          : formatMetric(String(metric), Number(row[metric] || 0)),
    context: row.page || 'Sin URL asociada',
  }));

const buildAggregateMaps = (rows: GSCRow[]) => {
  const byKey = new Map<string, GSCRow>();
  const byQuery = new Map<string, GSCRow[]>();
  const byPage = new Map<string, GSCRow[]>();

  rows.forEach((row) => {
    const query = row.keys[0] || '';
    const page = row.keys[1] || '';
    byKey.set(`${query}||${page}`, row);

    if (!byQuery.has(query)) byQuery.set(query, []);
    byQuery.get(query)!.push(row);

    if (page) {
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page)!.push(row);
    }
  });

  return { byKey, byQuery, byPage };
};

const buildComparableRows = (currentRows: GSCRow[], previousRows: GSCRow[]) => {
  const { byKey: previousByKey } = buildAggregateMaps(previousRows);

  return currentRows.map((current) => {
    const query = current.keys[0] || '';
    const page = current.keys[1] || '';
    const previous = previousByKey.get(`${query}||${page}`);
    const deltaClicks = current.clicks - (previous?.clicks || 0);
    const deltaImpressions = current.impressions - (previous?.impressions || 0);
    const deltaCtr = current.ctr - (previous?.ctr || 0);
    const deltaPosition = current.position - (previous?.position || current.position);

    return {
      key: `${query}||${page}`,
      query,
      page,
      current,
      previous,
      deltaClicks,
      deltaImpressions,
      deltaCtr,
      deltaPosition,
      relativeClickChange:
        previous && previous.clicks > 0 ? deltaClicks / previous.clicks : previous ? 0 : null,
      relativeImpressionChange:
        previous && previous.impressions > 0
          ? deltaImpressions / previous.impressions
          : previous
            ? 0
            : null,
      relativeCtrChange: previous && previous.ctr > 0 ? deltaCtr / previous.ctr : previous ? 0 : null,
    } satisfies QueryPageAggregate;
  });
};

const scoreInsight = (input: Omit<InsightCandidate, 'score'>) => {
  const weights = SEO_INSIGHT_PRIORITY_WEIGHTS;
  return Math.round(
    input.businessValue * weights.businessValue +
      input.impact * weights.impact +
      input.urgency * weights.urgency +
      input.confidence * weights.confidence +
      input.implementationEase * weights.implementationEase,
  );
};

const toInsight = (candidate: InsightCandidate): SeoInsight => {
  const config = SEO_INSIGHT_CATALOG[candidate.id];

  return {
    id: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    reason: candidate.reason,
    evidence: candidate.evidence,
    priority: candidate.priority,
    severity: candidate.severity,
    opportunity: candidate.opportunity,
    action: candidate.recommendation,
    status: candidate.status,
    visualContext: {
      icon: config.icon,
      tone: config.tone,
      categoryLabel: INSIGHT_CATEGORY_META[candidate.category].label,
    },
    category: candidate.category,
    score: candidate.score,
    affectedCount: candidate.affectedCount,
    confidence: candidate.confidence,
    businessValue: candidate.businessValue,
    implementationEase: candidate.implementationEase,
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
}: SeoInsightEngineInput): GSCInsightsEngineResult => {
  const comparableRows = buildComparableRows(currentRows, previousRows).filter(
    (row) => row.current.impressions > 0,
  );

  const { byQuery, byPage } = buildAggregateMaps(currentRows);
  const totalImpressions = currentRows.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = currentRows.reduce((sum, row) => sum + row.clicks, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  const candidates: InsightCandidate[] = [];
  const thresholds = SEO_INSIGHT_THRESHOLDS;

  const quickWins = comparableRows.filter(
    ({ current }) =>
      current.position >= thresholds.quickWins.positionMin &&
      current.position <= thresholds.quickWins.positionMax &&
      current.impressions >= thresholds.quickWins.minImpressions,
  );
  if (quickWins.length > 0) {
    const potentialTraffic = quickWins.reduce(
      (sum, row) => sum + Math.max(0, row.current.impressions * thresholds.quickWins.targetCtr - row.current.clicks),
      0,
    );
    const impact = normalize(potentialTraffic, totalImpressions || 1);
    const candidate = {
      id: 'quickWins',
      title: 'Quick wins de primera página',
      summary: `${quickWins.length} combinaciones query/URL están entre posiciones 4 y 10 con demanda suficiente para capturar más clics.`,
      reason: 'Ya existe visibilidad relevante; un ajuste de snippet, intención y refuerzo interno puede empujarlas a Top 3.',
      recommendation: 'Prioriza estas URLs en refresh editorial, enlazado interno y pruebas de title/meta para capturar más clics sin crear contenido nuevo.',
      category: 'opportunity' as const,
      severity: 'medium' as const,
      status: 'actionable' as const,
      priority: potentialTraffic > 150 ? 'high' as const : 'medium' as const,
      opportunity: clamp(Math.round(potentialTraffic)),
      impact,
      urgency: 72,
      confidence: 88,
      implementationEase: 82,
      businessValue: 85,
      score: 0,
      evidence: buildEvidence('Quick win', quickWins.sort((a, b) => b.current.impressions - a.current.impressions), 'position'),
      relatedRows: quickWins.sort((a, b) => b.current.impressions - a.current.impressions).map((row) => row.current).slice(0, 50),
      affectedCount: quickWins.length,
      potentialTraffic: Math.round(potentialTraffic),
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const strikingDistance = comparableRows.filter(
    ({ current }) =>
      current.position >= thresholds.strikingDistance.positionMin &&
      current.position <= thresholds.strikingDistance.positionMax &&
      current.impressions >= thresholds.strikingDistance.minImpressions,
  );
  if (strikingDistance.length > 0) {
    const potentialTraffic = strikingDistance.reduce(
      (sum, row) => sum + Math.max(0, row.current.impressions * thresholds.strikingDistance.targetCtr - row.current.clicks),
      0,
    );
    const candidate = {
      id: 'strikingDistance',
      title: 'Consultas al borde de primera página',
      summary: `${strikingDistance.length} keywords están entre posiciones 11 y 20 y pueden entrar en página 1 con refuerzo focalizado.`,
      reason: 'La visibilidad ya existe pero aún no alcanza el tramo donde se concentran los clics.',
      recommendation: 'Refuerza matching de intención, semántica secundaria y enlaces internos hacia estas URLs antes de abrir nuevas piezas.',
      category: 'position' as const,
      severity: 'medium' as const,
      status: 'watch' as const,
      priority: potentialTraffic > 120 ? 'high' as const : 'medium' as const,
      opportunity: clamp(Math.round(potentialTraffic)),
      impact: normalize(potentialTraffic, totalImpressions || 1),
      urgency: 68,
      confidence: 86,
      implementationEase: 70,
      businessValue: 80,
      score: 0,
      evidence: buildEvidence('Striking distance', strikingDistance.sort((a, b) => b.current.impressions - a.current.impressions), 'position'),
      relatedRows: strikingDistance.sort((a, b) => b.current.impressions - a.current.impressions).map((row) => row.current).slice(0, 50),
      affectedCount: strikingDistance.length,
      potentialTraffic: Math.round(potentialTraffic),
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const lowCtr = comparableRows.filter(
    ({ current }) =>
      current.position <= thresholds.lowCtr.maxPosition &&
      current.impressions >= thresholds.lowCtr.minImpressions &&
      current.ctr < thresholds.lowCtr.maxCtr,
  );
  if (lowCtr.length > 0) {
    const potentialTraffic = lowCtr.reduce(
      (sum, row) => sum + Math.max(0, row.current.impressions * Math.max(avgCtr, thresholds.lowCtr.targetCtr) - row.current.clicks),
      0,
    );
    const candidate = {
      id: 'lowCtr',
      title: 'CTR bajo para la posición actual',
      summary: `${lowCtr.length} resultados ya rankean bien pero están desaprovechando impresiones por snippet poco competitivo.`,
      reason: 'La discrepancia entre posición y CTR sugiere problema de mensaje, rich results o alineación de intención.',
      recommendation: 'Reescribe title/meta, revisa schema y valida si el snippet responde mejor a la expectativa de la query.',
      category: 'ctr' as const,
      severity: 'high' as const,
      status: 'actionable' as const,
      priority: potentialTraffic > 120 ? 'high' as const : 'medium' as const,
      opportunity: clamp(Math.round(potentialTraffic)),
      impact: normalize(potentialTraffic, totalImpressions || 1),
      urgency: 78,
      confidence: 90,
      implementationEase: 84,
      businessValue: 88,
      score: 0,
      evidence: buildEvidence('CTR bajo', lowCtr.sort((a, b) => b.current.impressions - a.current.impressions), 'ctr'),
      relatedRows: lowCtr.sort((a, b) => b.current.impressions - a.current.impressions).map((row) => row.current).slice(0, 50),
      affectedCount: lowCtr.length,
      potentialTraffic: Math.round(potentialTraffic),
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const zeroClicks = comparableRows.filter(
    ({ current }) =>
      current.clicks === 0 && current.impressions >= thresholds.zeroClicks.minImpressions,
  );
  if (zeroClicks.length > 0) {
    const candidate = {
      id: 'zeroClicks',
      title: 'Impresiones sin captación',
      summary: `${zeroClicks.length} combinaciones tienen impresiones significativas pero no captan clics.`,
      reason: 'Puede haber búsqueda resuelta en SERP, snippet irrelevante o una promesa poco clara frente al competidor.',
      recommendation: 'Revisa intención real, formato del snippet y si conviene reforzar rich results o atacar otra variante de la query.',
      category: 'performance' as const,
      severity: 'high' as const,
      status: 'investigate' as const,
      priority: zeroClicks.length >= 10 ? 'high' as const : 'medium' as const,
      opportunity: clamp(Math.round(average(zeroClicks.map((row) => row.current.impressions)))),
      impact: normalize(zeroClicks.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
      urgency: 74,
      confidence: 83,
      implementationEase: 65,
      businessValue: 72,
      score: 0,
      evidence: buildEvidence('Sin clics', zeroClicks.sort((a, b) => b.current.impressions - a.current.impressions), 'impressions'),
      relatedRows: zeroClicks.sort((a, b) => b.current.impressions - a.current.impressions).map((row) => row.current).slice(0, 50),
      affectedCount: zeroClicks.length,
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const featuredSnippets = comparableRows.filter(({ current, query }) => {
    const normalized = query.toLowerCase();
    return (
      thresholds.featuredSnippets.questionPrefixes.some((prefix) => normalized.startsWith(`${prefix} `)) &&
      current.position >= thresholds.featuredSnippets.positionMin &&
      current.position <= thresholds.featuredSnippets.positionMax &&
      current.impressions >= thresholds.featuredSnippets.minImpressions
    );
  });
  if (featuredSnippets.length > 0) {
    const candidate = {
      id: 'featuredSnippets',
      title: 'Consultas con opción a fragmento destacado',
      summary: `${featuredSnippets.length} preguntas ya rankean en primera página y son candidatas a capturar posición 0.`,
      reason: 'La query ya muestra fit informacional; estructurar mejor la respuesta puede abrir la puerta al snippet destacado.',
      recommendation: 'Añade respuestas directas, listas o tablas breves al inicio y refuerza la semántica de pregunta/respuesta.',
      category: 'content' as const,
      severity: 'medium' as const,
      status: 'watch' as const,
      priority: 'medium' as const,
      opportunity: clamp(Math.round(average(featuredSnippets.map((row) => row.current.impressions)))),
      impact: normalize(featuredSnippets.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
      urgency: 60,
      confidence: 75,
      implementationEase: 72,
      businessValue: 68,
      score: 0,
      evidence: buildEvidence('Snippet', featuredSnippets.sort((a, b) => b.current.impressions - a.current.impressions), 'position'),
      relatedRows: featuredSnippets.sort((a, b) => b.current.impressions - a.current.impressions).map((row) => row.current).slice(0, 50),
      affectedCount: featuredSnippets.length,
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const stagnantTraffic = comparableRows.filter(
    ({ current, previous, relativeClickChange, deltaPosition }) =>
      current.impressions >= thresholds.stagnantTraffic.minImpressions &&
      current.position >= thresholds.stagnantTraffic.positionMin &&
      current.position <= thresholds.stagnantTraffic.positionMax &&
      current.ctr <= thresholds.stagnantTraffic.maxCtr &&
      (previous ? Math.abs(relativeClickChange || 0) <= thresholds.stagnantTraffic.maxRelativeDelta : true) &&
      Math.abs(deltaPosition) <= thresholds.stagnantTraffic.maxPositionDelta,
  );
  if (stagnantTraffic.length > 0) {
    const candidate = {
      id: 'stagnantTraffic',
      title: 'Rendimiento estancado',
      summary: `${stagnantTraffic.length} URLs mantienen visibilidad media pero sin señal clara de mejora.`,
      reason: 'Se observa demanda sostenida con CTR/posición insuficientes para crecer; probablemente necesitan refresh o refuerzo temático.',
      recommendation: 'Analiza intención, frescura y cobertura semántica; prioriza refresh y apoyo interno antes de publicar nuevo contenido similar.',
      category: 'performance' as const,
      severity: 'medium' as const,
      status: 'investigate' as const,
      priority: 'medium' as const,
      opportunity: clamp(Math.round(average(stagnantTraffic.map((row) => row.current.impressions)))),
      impact: normalize(stagnantTraffic.reduce((sum, row) => sum + row.current.impressions, 0), totalImpressions || 1),
      urgency: 63,
      confidence: previousRows.length > 0 ? 80 : 58,
      implementationEase: 58,
      businessValue: 70,
      score: 0,
      evidence: buildEvidence('Estancado', stagnantTraffic.sort((a, b) => b.current.impressions - a.current.impressions), 'impressions'),
      relatedRows: stagnantTraffic.sort((a, b) => b.current.impressions - a.current.impressions).map((row) => row.current).slice(0, 50),
      affectedCount: stagnantTraffic.length,
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const declining = comparableRows.filter(
    ({ previous, current, relativeClickChange, deltaPosition }) =>
      !!previous &&
      current.impressions >= thresholds.decline.minImpressions &&
      (relativeClickChange || 0) <= -thresholds.decline.minRelativeClickDrop &&
      deltaPosition >= thresholds.decline.minPositionLoss,
  );
  if (declining.length > 0) {
    const trafficLoss = declining.reduce((sum, row) => sum + Math.abs(row.deltaClicks), 0);
    const candidate = {
      id: 'decliningPages',
      title: 'Pérdidas de tráfico y posición',
      summary: `${declining.length} combinaciones han empeorado frente al periodo anterior y requieren revisión prioritaria.`,
      reason: 'La caída simultánea en clics y posición indica deterioro competitivo, pérdida de relevancia o conflicto interno.',
      recommendation: 'Audita cambios recientes, intención SERP, enlazado y canibalización antes de que la caída se consolide.',
      category: 'risk' as const,
      severity: 'critical' as const,
      status: 'actionable' as const,
      priority: 'high' as const,
      opportunity: clamp(Math.round(trafficLoss * 10)),
      impact: normalize(trafficLoss, totalClicks || 1),
      urgency: 96,
      confidence: 92,
      implementationEase: 52,
      businessValue: 94,
      score: 0,
      evidence: declining
        .sort((a, b) => a.deltaClicks - b.deltaClicks)
        .slice(0, 3)
        .map((row) => ({
          label: `Caída: ${row.query}`,
          value: `${Math.abs(row.deltaClicks).toLocaleString('es-ES')} clics menos`,
          context: row.page || 'Sin URL asociada',
        })),
      relatedRows: declining.sort((a, b) => a.deltaClicks - b.deltaClicks).map((row) => row.current).slice(0, 50),
      affectedCount: declining.length,
      potentialTraffic: trafficLoss,
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const improved = comparableRows.filter(
    ({ previous, current, relativeClickChange, deltaPosition }) =>
      !!previous &&
      current.impressions >= thresholds.improvement.minImpressions &&
      (relativeClickChange || 0) >= thresholds.improvement.minRelativeClickGrowth &&
      deltaPosition <= -thresholds.improvement.minPositionGain,
  );
  if (improved.length > 0) {
    const candidate = {
      id: 'improvingPages',
      title: 'Patrones de mejora a consolidar',
      summary: `${improved.length} combinaciones están creciendo frente al periodo anterior y conviene reforzarlas antes de que se frenen.`,
      reason: 'Las señales positivas indican que la URL está ganando relevancia y puede escalar aún más con soporte adicional.',
      recommendation: 'Replica el patrón ganador: refuerza enlazado, actualiza contenido relacionado y protege la intención que está funcionando.',
      category: 'opportunity' as const,
      severity: 'low' as const,
      status: 'watch' as const,
      priority: 'medium' as const,
      opportunity: clamp(Math.round(improved.reduce((sum, row) => sum + row.deltaClicks, 0) * 5)),
      impact: normalize(improved.reduce((sum, row) => sum + row.deltaClicks, 0), totalClicks || 1),
      urgency: 55,
      confidence: 88,
      implementationEase: 76,
      businessValue: 78,
      score: 0,
      evidence: improved
        .sort((a, b) => b.deltaClicks - a.deltaClicks)
        .slice(0, 3)
        .map((row) => ({
          label: `Mejora: ${row.query}`,
          value: `${row.deltaClicks.toLocaleString('es-ES')} clics más`,
          context: row.page || 'Sin URL asociada',
        })),
      relatedRows: improved.sort((a, b) => b.deltaClicks - a.deltaClicks).map((row) => row.current).slice(0, 50),
      affectedCount: improved.length,
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const cannibalized: GSCRow[] = [];
  byQuery.forEach((queryRows, query) => {
    const significant = queryRows.filter((row) => row.impressions >= thresholds.cannibalization.minImpressionsPerUrl);
    if (significant.length < 2) return;
    const sorted = [...significant].sort((a, b) => a.position - b.position);
    if (Math.abs(sorted[0].position - sorted[1].position) <= thresholds.cannibalization.maxPositionGap) {
      cannibalized.push({ ...sorted[0], keys: [query, `${significant.length} URLs compiten`] });
    }
  });
  if (cannibalized.length > 0) {
    const candidate = {
      id: 'cannibalization',
      title: 'Posible canibalización',
      summary: `${cannibalized.length} queries muestran varias URLs compitiendo con señales similares.`,
      reason: 'Cuando varias páginas capturan la misma intención, la autoridad se dispersa y la estabilidad del ranking se resiente.',
      recommendation: 'Define una URL principal por intención, revisa enlazado/anclas y consolida contenidos si procede.',
      category: 'risk' as const,
      severity: 'high' as const,
      status: 'investigate' as const,
      priority: cannibalized.length >= 5 ? 'high' as const : 'medium' as const,
      opportunity: clamp(cannibalized.reduce((sum, row) => sum + row.impressions, 0) / 10),
      impact: normalize(cannibalized.reduce((sum, row) => sum + row.impressions, 0), totalImpressions || 1),
      urgency: 82,
      confidence: 84,
      implementationEase: 48,
      businessValue: 86,
      score: 0,
      evidence: cannibalized.slice(0, 3).map((row) => ({
        label: `Query: ${row.keys[0]}`,
        value: row.keys[1],
        context: `${row.impressions.toLocaleString('es-ES')} impresiones`,
      })),
      relatedRows: cannibalized.slice(0, 50),
      affectedCount: cannibalized.length,
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const dirtyUrls = Array.from(byPage.entries())
    .filter(([page, rows]) =>
      rows.reduce((sum, row) => sum + row.impressions, 0) >= thresholds.internalRedirects.minPageImpressions &&
      (page.includes('?') || page.includes('.php') || page.includes('.html') || page.includes('index')),
    )
    .map(([, rows]) => rows[0]);
  if (dirtyUrls.length > 0) {
    const candidate = {
      id: 'internalRedirects',
      title: 'URLs con señales de limpieza técnica',
      summary: `${dirtyUrls.length} URLs con impresiones contienen patrones que suelen derivar en duplicidad, redirecciones o versión no canónica.`,
      reason: 'Parámetros, extensiones o rutas índice visibles en GSC suelen indicar deuda técnica y dispersión de señales.',
      recommendation: 'Revisa canonicals, redirecciones internas y enlazado hacia la versión preferida de cada URL.',
      category: 'coverage' as const,
      severity: 'medium' as const,
      status: 'investigate' as const,
      priority: 'medium' as const,
      opportunity: clamp(dirtyUrls.reduce((sum, row) => sum + row.impressions, 0) / 20),
      impact: normalize(dirtyUrls.reduce((sum, row) => sum + row.impressions, 0), totalImpressions || 1),
      urgency: 64,
      confidence: 69,
      implementationEase: 62,
      businessValue: 66,
      score: 0,
      evidence: dirtyUrls.slice(0, 3).map((row) => ({
        label: row.keys[1] || 'URL sin página',
        value: `${row.impressions.toLocaleString('es-ES')} impresiones`,
        context: row.keys[0],
      })),
      relatedRows: dirtyUrls.slice(0, 50),
      affectedCount: dirtyUrls.length,
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const contentExpansion = Array.from(byPage.entries())
    .map(([page, rows]) => ({
      page,
      rows,
      queryCount: rows.length,
      impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
      clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
      avgPosition: average(rows.map((row) => row.position)),
    }))
    .filter(
      (page) =>
        page.impressions >= thresholds.contentExpansion.minImpressions &&
        page.queryCount >= thresholds.contentExpansion.minQueries &&
        page.avgPosition >= thresholds.contentExpansion.positionMin &&
        page.avgPosition <= thresholds.contentExpansion.positionMax,
    )
    .sort((a, b) => b.impressions - a.impressions);
  if (contentExpansion.length > 0) {
    const rows = contentExpansion.flatMap((page) => page.rows).slice(0, 50);
    const candidate = {
      id: 'contentExpansion',
      title: 'URLs con cobertura ampliable',
      summary: `${contentExpansion.length} páginas ya captan varias queries pero aún están en zona media de ranking.`,
      reason: 'Esto suele indicar que la página tiene autoridad temática suficiente para ampliar subtemas y capturar más demanda.',
      recommendation: 'Amplía secciones, FAQs y entidades relacionadas en estas URLs antes de crear nuevas piezas satélite.',
      category: 'content' as const,
      severity: 'medium' as const,
      status: 'actionable' as const,
      priority: 'medium' as const,
      opportunity: clamp(contentExpansion.reduce((sum, page) => sum + page.impressions, 0) / 20),
      impact: normalize(contentExpansion.reduce((sum, page) => sum + page.impressions, 0), totalImpressions || 1),
      urgency: 58,
      confidence: 82,
      implementationEase: 66,
      businessValue: 79,
      score: 0,
      evidence: contentExpansion.slice(0, 3).map((page) => ({
        label: page.page,
        value: `${page.queryCount} queries`,
        context: `Posición media ${page.avgPosition.toFixed(1)}`,
      })),
      relatedRows: rows,
      affectedCount: contentExpansion.length,
    };
    candidate.score = scoreInsight(candidate);
    candidates.push(candidate);
  }

  const sortedInsights = candidates
    .map((candidate) => toInsight({ ...candidate, score: candidate.score || scoreInsight(candidate) }))
    .sort((a, b) => b.score - a.score);

  const groupedInsights = (Object.keys(INSIGHT_CATEGORY_META) as SeoInsightCategory[])
    .map((category) => summarizeGroup(category, sortedInsights.filter((insight) => insight.category === category)))
    .filter((group) => group.count > 0);

  return {
    insights: sortedInsights,
    groupedInsights,
    topOpportunities: sortedInsights.filter((insight) => insight.category === 'opportunity').slice(0, 3),
    topRisks: sortedInsights.filter((insight) => insight.category === 'risk').slice(0, 3),
    quickWins: legacyCard(sortedInsights.find((insight) => insight.id === 'quickWins'), 'Quick wins de primera página'),
    strikingDistance: legacyCard(sortedInsights.find((insight) => insight.id === 'strikingDistance'), 'Consultas al borde de primera página'),
    lowCtr: legacyCard(sortedInsights.find((insight) => insight.id === 'lowCtr'), 'CTR bajo para la posición actual'),
    topQueries: {
      title: 'Top consultas',
      description: 'Consultas con más clics en el periodo actual.',
      count: currentRows.length,
      items: [...currentRows].sort((a, b) => b.clicks - a.clicks).slice(0, 50),
    },
    cannibalization: legacyCard(sortedInsights.find((insight) => insight.id === 'cannibalization'), 'Posible canibalización'),
    zeroClicks: legacyCard(sortedInsights.find((insight) => insight.id === 'zeroClicks'), 'Impresiones sin captación'),
    featuredSnippets: legacyCard(sortedInsights.find((insight) => insight.id === 'featuredSnippets'), 'Consultas con opción a fragmento destacado'),
    stagnantTraffic: legacyCard(sortedInsights.find((insight) => insight.id === 'stagnantTraffic'), 'Rendimiento estancado'),
    seasonality: {
      title: 'Estacionalidad',
      description: 'No se detecta un insight específico de estacionalidad con trazabilidad suficiente en la nueva capa.',
      count: 0,
      items: [],
    },
    stableUrls: {
      title: 'URLs estables',
      description: 'Consulta los patrones de mejora y los top queries para detectar estabilidad relativa.',
      count: 0,
      items: [],
    },
    internalRedirects: legacyCard(sortedInsights.find((insight) => insight.id === 'internalRedirects'), 'URLs con señales de limpieza técnica'),
  };
};

export const analyzeQuickWins = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).quickWins;
export const analyzeStrikingDistance = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).strikingDistance;
export const analyzeLowCtr = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).lowCtr;
export const getTopPerforming = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).topQueries;
export const analyzeCannibalization = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).cannibalization;
export const analyzeZeroClickQueries = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).zeroClicks;
export const analyzeFeaturedSnippets = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).featuredSnippets;
export const analyzeStagnantTraffic = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).stagnantTraffic;
export const analyzeSeasonality = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).seasonality;
export const analyzeStableUrls = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).stableUrls;
export const analyzeInternalRedirects = (rows: GSCRow[]): InsightResult =>
  analyzeGSCInsights({ currentRows: rows }).internalRedirects;
