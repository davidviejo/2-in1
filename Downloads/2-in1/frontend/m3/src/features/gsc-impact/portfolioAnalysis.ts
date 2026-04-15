import { NormalizedComparison, safeDivide, safePct } from '@/features/gsc-impact/impactAnalysis';

export type PortfolioStatus = 'mejora' | 'estable' | 'atención' | 'riesgo' | 'urgente';
export type DataQualityFlag = 'ok' | 'baja_confianza' | 'volumen_insuficiente' | 'comparativa_no_concluyente';

export type PortfolioPropertyRow = {
  property: string;
  preClicks: number;
  rolloutClicks: number;
  postClicks: number;
  preClicksPerDay: number;
  postClicksPerDay: number;
  deltaClicks: number;
  deltaClicksPct: number | null;
  preImpressions: number;
  postImpressions: number;
  preImpressionsPerDay: number;
  postImpressionsPerDay: number;
  preCtr: number;
  postCtr: number;
  deltaCtr: number;
  prePosition: number;
  postPosition: number;
  deltaPosition: number;
  brandDeltaClicksPerDay: number;
  nonBrandDeltaClicksPerDay: number;
  riskScore: number;
  status: PortfolioStatus;
  quality: DataQualityFlag;
  qualityReason: string;
  volumeAffected: number;
  consistencyScore: number;
};

export type PortfolioSortKey = 'risk' | 'delta_clicks_day' | 'delta_non_brand' | 'delta_ctr' | 'volume_affected';

export const PORTFOLIO_THRESHOLDS = {
  minimumReliableBaseClicksPerDay: 3,
  minimumReliableBaseImpressionsPerDay: 80,
  minimumUrgentBaseClicksPerDay: 15,
  stableBandClicksDay: 0.75,
  stableBandCtrPp: 0.35,
  stableBandPosition: 0.4,
  urgentRiskScore: 80,
  riskRiskScore: 58,
  attentionRiskScore: 35,
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export const buildRiskScore = (input: {
  summary: NormalizedComparison;
  brandDeltaClicksPerDay: number;
  nonBrandDeltaClicksPerDay: number;
}): number => {
  const { summary, brandDeltaClicksPerDay, nonBrandDeltaClicksPerDay } = input;

  const deltaClicksAbs = summary.postVsPre.clicksPerDay.absolute;
  const deltaClicksPct = summary.postVsPre.clicksPerDay.pct ?? 0;
  const deltaCtrPp = summary.postVsPre.ctr.absolute * 100;
  const deltaPosition = summary.postVsPre.position.absolute;
  const baseVolume = summary.pre.clicksPerDay;

  const absoluteImpact = clamp(Math.max(0, -deltaClicksAbs) * 1.8);
  const relativeImpact = clamp(Math.max(0, -deltaClicksPct) * 100 * 0.9);
  const ctrImpact = clamp(Math.max(0, -deltaCtrPp) * 6);
  const positionImpact = clamp(Math.max(0, deltaPosition) * 11);
  const nonBrandImpact = clamp(Math.max(0, -nonBrandDeltaClicksPerDay) * 2.3);
  const volumeWeight = clamp(Math.log10(baseVolume + 1) * 24);

  // Fórmula explícita para priorización multi-site:
  // 1) prioriza impacto absoluto y relativo en clicks/day,
  // 2) penaliza caída de CTR/posición,
  // 3) amplifica deterioro non-brand,
  // 4) añade peso por volumen base para que propiedades grandes no queden ocultas.
  const rawScore =
    absoluteImpact * 0.26 +
    relativeImpact * 0.16 +
    ctrImpact * 0.14 +
    positionImpact * 0.12 +
    nonBrandImpact * 0.2 +
    volumeWeight * 0.12;

  const consistencyBoost =
    (deltaClicksAbs < 0 ? 1 : 0) +
    (deltaCtrPp < 0 ? 1 : 0) +
    (deltaPosition > 0 ? 1 : 0) +
    (nonBrandDeltaClicksPerDay < 0 ? 1 : 0) +
    (brandDeltaClicksPerDay < 0 ? 1 : 0);

  return Number(clamp(rawScore + consistencyBoost * 1.6).toFixed(2));
};

export const classifyPortfolioStatus = (input: {
  summary: NormalizedComparison;
  nonBrandDeltaClicksPerDay: number;
  riskScore: number;
}) => {
  const { summary, nonBrandDeltaClicksPerDay, riskScore } = input;
  const deltaClicks = summary.postVsPre.clicksPerDay.absolute;
  const deltaCtrPp = summary.postVsPre.ctr.absolute * 100;
  const deltaPosition = summary.postVsPre.position.absolute;
  const baseClicksPerDay = summary.pre.clicksPerDay;

  // Heurística centralizada y ajustable: primero detecta mejoras robustas,
  // después evalúa urgencia/riesgo/atención según deterioro combinado y volumen.
  if (
    deltaClicks > PORTFOLIO_THRESHOLDS.stableBandClicksDay &&
    deltaCtrPp > PORTFOLIO_THRESHOLDS.stableBandCtrPp &&
    deltaPosition < 0
  ) {
    return 'mejora' as const;
  }

  const stableByBands =
    Math.abs(deltaClicks) <= PORTFOLIO_THRESHOLDS.stableBandClicksDay &&
    Math.abs(deltaCtrPp) <= PORTFOLIO_THRESHOLDS.stableBandCtrPp &&
    Math.abs(deltaPosition) <= PORTFOLIO_THRESHOLDS.stableBandPosition;

  if (stableByBands) return 'estable' as const;

  if (
    riskScore >= PORTFOLIO_THRESHOLDS.urgentRiskScore &&
    baseClicksPerDay >= PORTFOLIO_THRESHOLDS.minimumUrgentBaseClicksPerDay &&
    deltaClicks < -2 &&
    nonBrandDeltaClicksPerDay < -1 &&
    (deltaCtrPp < -0.4 || deltaPosition > 0.7)
  ) {
    return 'urgente' as const;
  }

  if (riskScore >= PORTFOLIO_THRESHOLDS.riskRiskScore && deltaClicks < -1.2) return 'riesgo' as const;
  if (riskScore >= PORTFOLIO_THRESHOLDS.attentionRiskScore || deltaClicks < 0) return 'atención' as const;

  return 'estable' as const;
};

export const getDataQuality = (summary: NormalizedComparison): { quality: DataQualityFlag; qualityReason: string } => {
  if (summary.pre.days === 0 || summary.post.days === 0) {
    return { quality: 'comparativa_no_concluyente', qualityReason: 'Ventanas pre/post inválidas.' };
  }

  if (
    summary.pre.clicksPerDay < PORTFOLIO_THRESHOLDS.minimumReliableBaseClicksPerDay &&
    summary.pre.impressionsPerDay < PORTFOLIO_THRESHOLDS.minimumReliableBaseImpressionsPerDay
  ) {
    return {
      quality: 'volumen_insuficiente',
      qualityReason: 'Volumen base bajo: cambios porcentuales poco estables.',
    };
  }

  if (summary.pre.clicks === 0 || summary.pre.impressions === 0) {
    return {
      quality: 'baja_confianza',
      qualityReason: 'Sin base sólida en pre-update para una lectura robusta.',
    };
  }

  return { quality: 'ok', qualityReason: 'Comparativa consistente.' };
};

export const buildPortfolioPropertyRow = (input: {
  property: string;
  total: NormalizedComparison;
  brand: NormalizedComparison;
  nonBrand: NormalizedComparison;
}): PortfolioPropertyRow => {
  const { property, total, brand, nonBrand } = input;
  const riskScore = buildRiskScore({
    summary: total,
    brandDeltaClicksPerDay: brand.postVsPre.clicksPerDay.absolute,
    nonBrandDeltaClicksPerDay: nonBrand.postVsPre.clicksPerDay.absolute,
  });
  const status = classifyPortfolioStatus({
    summary: total,
    nonBrandDeltaClicksPerDay: nonBrand.postVsPre.clicksPerDay.absolute,
    riskScore,
  });
  const quality = getDataQuality(total);

  const consistencyScore = [
    total.postVsPre.clicksPerDay.absolute < 0,
    total.postVsPre.ctr.absolute < 0,
    total.postVsPre.position.absolute > 0,
    nonBrand.postVsPre.clicksPerDay.absolute < 0,
  ].filter(Boolean).length;

  return {
    property,
    preClicks: total.pre.clicks,
    rolloutClicks: total.rollout.clicks,
    postClicks: total.post.clicks,
    preClicksPerDay: total.pre.clicksPerDay,
    postClicksPerDay: total.post.clicksPerDay,
    deltaClicks: total.post.clicks - total.pre.clicks,
    deltaClicksPct: safePct(total.post.clicks, total.pre.clicks),
    preImpressions: total.pre.impressions,
    postImpressions: total.post.impressions,
    preImpressionsPerDay: total.pre.impressionsPerDay,
    postImpressionsPerDay: total.post.impressionsPerDay,
    preCtr: total.pre.ctr,
    postCtr: total.post.ctr,
    deltaCtr: total.postVsPre.ctr.absolute,
    prePosition: total.pre.position,
    postPosition: total.post.position,
    deltaPosition: total.postVsPre.position.absolute,
    brandDeltaClicksPerDay: brand.postVsPre.clicksPerDay.absolute,
    nonBrandDeltaClicksPerDay: nonBrand.postVsPre.clicksPerDay.absolute,
    riskScore,
    status,
    quality: quality.quality,
    qualityReason: quality.qualityReason,
    volumeAffected: Math.abs(total.postVsPre.clicksPerDay.absolute) * Math.max(1, total.pre.days),
    consistencyScore,
  };
};

export const sortPortfolioRows = (rows: PortfolioPropertyRow[], sortBy: PortfolioSortKey) => {
  const copy = [...rows];
  if (sortBy === 'delta_clicks_day') {
    return copy.sort((a, b) => a.postClicksPerDay - b.postClicksPerDay);
  }
  if (sortBy === 'delta_non_brand') {
    return copy.sort((a, b) => a.nonBrandDeltaClicksPerDay - b.nonBrandDeltaClicksPerDay);
  }
  if (sortBy === 'delta_ctr') {
    return copy.sort((a, b) => a.deltaCtr - b.deltaCtr);
  }
  if (sortBy === 'volume_affected') {
    return copy.sort((a, b) => b.volumeAffected - a.volumeAffected);
  }
  return copy.sort((a, b) => b.riskScore - a.riskScore);
};

export const buildPortfolioExecutiveSummaryText = (rows: PortfolioPropertyRow[]) => {
  const counts = rows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { mejora: 0, estable: 0, atención: 0, riesgo: 0, urgente: 0 },
  );

  const totalSites = rows.length;
  const urgentRows = rows.filter((row) => row.status === 'urgente').length;
  const netClicksDayDelta = rows.reduce((sum, row) => sum + (row.postClicksPerDay - row.preClicksPerDay), 0);
  const ctrWorse = rows.filter((row) => row.deltaCtr < 0).length;
  const nonBrandWorse = rows.filter((row) => row.nonBrandDeltaClicksPerDay < 0).length;

  return [
    `De ${totalSites} propiedades analizadas, ${counts.mejora} mejoran, ${counts.estable} están estables y ${counts.atención + counts.riesgo + counts.urgente} presentan deterioro.`,
    urgentRows > 0
      ? `${urgentRows} requieren revisión urgente por caída combinada de clicks/day, non-brand y señales de CTR/posición.`
      : 'No hay propiedades en estado urgente con los umbrales actuales.',
    `Balance portfolio: Δ neto clicks/día ${netClicksDayDelta.toFixed(1)}; ${ctrWorse} propiedades empeoran CTR y ${nonBrandWorse} empeoran non-brand.`,
  ];
};

export type PortfolioPatternSignal = {
  id: string;
  title: string;
  detail: string;
  confidence: 'alta' | 'media' | 'baja';
  priority: number;
};

export const detectPortfolioPatterns = (rows: PortfolioPropertyRow[]): PortfolioPatternSignal[] => {
  if (rows.length === 0) return [];
  const signals: PortfolioPatternSignal[] = [];

  const ctrDownImpUp = rows.filter((row) => row.deltaCtr < 0 && row.postImpressionsPerDay > row.preImpressionsPerDay).length;
  if (ctrDownImpUp >= Math.max(2, Math.ceil(rows.length * 0.25))) {
    signals.push({
      id: 'ctr_down_impressions_up',
      title: 'Caída de CTR con impresiones al alza',
      detail: `${ctrDownImpUp} propiedades aumentan impresiones/día pero pierden CTR, patrón de menor atractivo en SERP o cambio de mix de queries.`,
      confidence: 'alta',
      priority: 92,
    });
  }

  const nonBrandDrops = rows.filter((row) => row.nonBrandDeltaClicksPerDay < -0.8).length;
  if (nonBrandDrops >= Math.max(2, Math.ceil(rows.length * 0.2))) {
    signals.push({
      id: 'non_brand_cluster',
      title: 'Deterioro concentrado en non-brand',
      detail: `${nonBrandDrops} propiedades muestran caída non-brand relevante; revisar cobertura informacional y transaccional fuera de marca.`,
      confidence: 'alta',
      priority: 88,
    });
  }

  const volatileRows = rows.filter((row) => Math.abs(row.rolloutClicks - row.preClicks) > Math.abs(row.postClicks - row.preClicks) * 1.2).length;
  if (volatileRows >= Math.max(2, Math.ceil(rows.length * 0.2))) {
    signals.push({
      id: 'rollout_volatility_portfolio',
      title: 'Volatilidad alta en rollout con recuperación parcial',
      detail: `${volatileRows} propiedades tuvieron peor tramo en rollout y recuperación parcial post; posible impacto temporal no homogéneo.`,
      confidence: 'media',
      priority: 72,
    });
  }

  const lowConfidenceRows = rows.filter((row) => row.quality !== 'ok').length;
  if (lowConfidenceRows > 0) {
    signals.push({
      id: 'data_quality_watch',
      title: 'Comparativas con confianza limitada',
      detail: `${lowConfidenceRows} propiedades tienen volumen insuficiente o comparativa no concluyente; conviene validar con más ventana temporal.`,
      confidence: 'media',
      priority: 60,
    });
  }

  return signals.sort((a, b) => b.priority - a.priority);
};

export const getPortfolioStatusBadgeVariant = (status: PortfolioStatus): 'success' | 'neutral' | 'warning' | 'danger' => {
  if (status === 'mejora') return 'success';
  if (status === 'estable') return 'neutral';
  if (status === 'atención') return 'warning';
  return 'danger';
};

export const summarizePortfolioStatusCounts = (rows: PortfolioPropertyRow[]) =>
  rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] += 1;
      return acc;
    },
    { total: 0, mejora: 0, estable: 0, atención: 0, riesgo: 0, urgente: 0 },
  );

export const getPortfolioVolumeWeight = (row: PortfolioPropertyRow) => safeDivide(row.preClicksPerDay + row.postClicksPerDay, 2);
