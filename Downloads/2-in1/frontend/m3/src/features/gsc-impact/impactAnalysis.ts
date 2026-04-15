export type TemporalMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  days: number;
  clicksPerDay: number;
  impressionsPerDay: number;
};

export type TemporalRowLike = {
  key: string;
  label: string;
  preClicks: number;
  rolloutClicks: number;
  postClicks: number;
  preImpressions: number;
  rolloutImpressions: number;
  postImpressions: number;
  prePosition: number;
  rolloutPosition: number;
  postPosition: number;
};

export type DeltaSet = {
  absolute: number;
  pct: number | null;
};

export type NormalizedComparison = {
  pre: TemporalMetrics;
  rollout: TemporalMetrics;
  post: TemporalMetrics;
  postVsPre: {
    clicksPerDay: DeltaSet;
    impressionsPerDay: DeltaSet;
    ctr: DeltaSet;
    position: DeltaSet;
  };
};

export type ScoredImpactRow<TRow extends TemporalRowLike> = TRow & {
  baseClicks: number;
  baseImpressions: number;
  preCtr: number;
  postCtr: number;
  deltaClicks: number;
  deltaCtr: number;
  deltaPosition: number;
  impactScore: number;
  opportunityScore: number;
  ctrDeteriorationScore: number;
};

export type PatternSignal = {
  id: string;
  title: string;
  detail: string;
  confidence: 'alta' | 'media' | 'baja';
  priority: number;
};

export const safeDivide = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : 0);

export const safePct = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return (current - previous) / Math.abs(previous);
};

export const getDaysBetweenInclusive = (start: string, end: string): number => {
  const startTs = new Date(`${start}T00:00:00Z`).getTime();
  const endTs = new Date(`${end}T00:00:00Z`).getTime();
  if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs < startTs) return 0;
  return Math.floor((endTs - startTs) / 86400000) + 1;
};

export const buildTemporalMetrics = (clicks: number, impressions: number, position: number, days: number): TemporalMetrics => {
  const ctr = safeDivide(clicks, impressions);
  return {
    clicks,
    impressions,
    ctr,
    position,
    days,
    clicksPerDay: safeDivide(clicks, days),
    impressionsPerDay: safeDivide(impressions, days),
  };
};

export const summarizeRows = (rows: Pick<TemporalRowLike, 'preClicks' | 'rolloutClicks' | 'postClicks' | 'preImpressions' | 'rolloutImpressions' | 'postImpressions' | 'prePosition' | 'rolloutPosition' | 'postPosition'>[], days: { pre: number; rollout: number; post: number }): NormalizedComparison => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.pre.clicks += row.preClicks;
      acc.pre.impressions += row.preImpressions;
      acc.rollout.clicks += row.rolloutClicks;
      acc.rollout.impressions += row.rolloutImpressions;
      acc.post.clicks += row.postClicks;
      acc.post.impressions += row.postImpressions;
      acc.prePosWeighted += row.prePosition * Math.max(1, row.preImpressions);
      acc.rolloutPosWeighted += row.rolloutPosition * Math.max(1, row.rolloutImpressions);
      acc.postPosWeighted += row.postPosition * Math.max(1, row.postImpressions);
      acc.prePosWeight += Math.max(1, row.preImpressions);
      acc.rolloutPosWeight += Math.max(1, row.rolloutImpressions);
      acc.postPosWeight += Math.max(1, row.postImpressions);
      return acc;
    },
    {
      pre: { clicks: 0, impressions: 0 },
      rollout: { clicks: 0, impressions: 0 },
      post: { clicks: 0, impressions: 0 },
      prePosWeighted: 0,
      rolloutPosWeighted: 0,
      postPosWeighted: 0,
      prePosWeight: 0,
      rolloutPosWeight: 0,
      postPosWeight: 0,
    },
  );

  const pre = buildTemporalMetrics(
    totals.pre.clicks,
    totals.pre.impressions,
    safeDivide(totals.prePosWeighted, totals.prePosWeight),
    days.pre,
  );
  const rollout = buildTemporalMetrics(
    totals.rollout.clicks,
    totals.rollout.impressions,
    safeDivide(totals.rolloutPosWeighted, totals.rolloutPosWeight),
    days.rollout,
  );
  const post = buildTemporalMetrics(
    totals.post.clicks,
    totals.post.impressions,
    safeDivide(totals.postPosWeighted, totals.postPosWeight),
    days.post,
  );

  return {
    pre,
    rollout,
    post,
    postVsPre: {
      clicksPerDay: { absolute: post.clicksPerDay - pre.clicksPerDay, pct: safePct(post.clicksPerDay, pre.clicksPerDay) },
      impressionsPerDay: {
        absolute: post.impressionsPerDay - pre.impressionsPerDay,
        pct: safePct(post.impressionsPerDay, pre.impressionsPerDay),
      },
      ctr: { absolute: post.ctr - pre.ctr, pct: safePct(post.ctr, pre.ctr) },
      position: { absolute: post.position - pre.position, pct: safePct(post.position, pre.position) },
    },
  };
};

export const isBrandQuery = (query: string, brandTerms: string[]) => {
  const normalized = query.toLowerCase();
  return brandTerms.some((term) => term && normalized.includes(term.toLowerCase()));
};

const buildImpactScore = (deltaClicks: number, deltaCtr: number, deltaPosition: number, baseVolume: number, baseClicks: number) => {
  const baseFactor = Math.log10(baseVolume + 10);
  const ctrPenalty = Math.max(0, -deltaCtr * 100);
  const posPenalty = Math.max(0, deltaPosition);
  const clickPenalty = Math.max(0, -deltaClicks);
  // Decisión intencional: ponderamos pérdida de clics con volumen base para priorizar impacto real.
  return Number((clickPenalty * baseFactor + ctrPenalty * baseFactor * 2.5 + posPenalty * baseFactor * 4 + baseClicks * 0.1).toFixed(2));
};

const buildOpportunityScore = (deltaClicks: number, deltaCtr: number, deltaPosition: number, baseVolume: number) => {
  const baseFactor = Math.log10(baseVolume + 10);
  const clickUpside = Math.max(0, deltaClicks);
  const ctrUpside = Math.max(0, deltaCtr * 100);
  const posUpside = Math.max(0, -deltaPosition);
  return Number((clickUpside * baseFactor + ctrUpside * baseFactor * 2 + posUpside * baseFactor * 3).toFixed(2));
};

export const scoreImpactRows = <TRow extends TemporalRowLike>(
  rows: TRow[],
  input: { minImpressions: number; minClicks: number },
): ScoredImpactRow<TRow>[] =>
  rows
    .map((row) => {
      const preCtr = safeDivide(row.preClicks, row.preImpressions);
      const postCtr = safeDivide(row.postClicks, row.postImpressions);
      const deltaClicks = row.postClicks - row.preClicks;
      const deltaCtr = postCtr - preCtr;
      const deltaPosition = row.postPosition - row.prePosition;
      const baseImpressions = row.preImpressions;
      const baseClicks = row.preClicks;
      const baseVolume = Math.max(baseImpressions, row.postImpressions);

      return {
        ...row,
        baseImpressions,
        baseClicks,
        preCtr,
        postCtr,
        deltaClicks,
        deltaCtr,
        deltaPosition,
        impactScore: buildImpactScore(deltaClicks, deltaCtr, deltaPosition, baseVolume, baseClicks),
        opportunityScore: buildOpportunityScore(deltaClicks, deltaCtr, deltaPosition, baseVolume),
        ctrDeteriorationScore: Number((Math.max(0, -deltaCtr * 100) * Math.log10(baseVolume + 10)).toFixed(2)),
      };
    })
    .filter((row) => row.baseImpressions >= input.minImpressions && row.baseClicks >= input.minClicks);

export const detectPatternSignals = (input: {
  global: NormalizedComparison;
  brand: NormalizedComparison;
  nonBrand: NormalizedComparison;
  rolloutVolatility: number;
  topNegativeDirectory?: string;
  topNegativeCountry?: string;
  topNegativeDevice?: string;
}): PatternSignal[] => {
  const signals: PatternSignal[] = [];

  if (input.global.postVsPre.impressionsPerDay.absolute > 0 && input.global.postVsPre.clicksPerDay.absolute < 0) {
    signals.push({
      id: 'impressions_up_clicks_down',
      title: 'Más visibilidad con menos clics',
      detail: 'Las impresiones/día suben mientras los clics/día caen: señal de deterioro de CTR o cambio en mix de queries.',
      confidence: 'alta',
      priority: 95,
    });
  }

  if (input.brand.postVsPre.clicksPerDay.absolute < 0 && Math.abs(input.brand.postVsPre.clicksPerDay.absolute) > Math.abs(input.nonBrand.postVsPre.clicksPerDay.absolute) * 1.4) {
    signals.push({
      id: 'brand_drop',
      title: 'Caída concentrada en brand',
      detail: 'El segmento brand pierde más clics/día que non-brand; revisar branded SERP y home.',
      confidence: 'alta',
      priority: 92,
    });
  }

  if (input.rolloutVolatility > 0.35 && input.global.postVsPre.clicksPerDay.absolute > input.global.rollout.clicksPerDay - input.global.pre.clicksPerDay) {
    signals.push({
      id: 'rollout_volatility',
      title: 'Volatilidad alta en rollout con estabilización parcial',
      detail: 'El comportamiento durante rollout fue volátil y el post no replica el peor punto, posible efecto temporal del despliegue.',
      confidence: 'media',
      priority: 78,
    });
  }

  if (input.topNegativeDirectory) {
    signals.push({
      id: 'directory_clustered',
      title: 'Caída clusterizada por directorio/prefijo',
      detail: `La mayor pérdida se concentra en ${input.topNegativeDirectory}; impacto no necesariamente global.`,
      confidence: 'media',
      priority: 74,
    });
  }

  if (input.topNegativeDevice) {
    signals.push({
      id: 'device_clustered',
      title: 'Caída por dispositivo',
      detail: `La pérdida neta se concentra en ${input.topNegativeDevice}; revisar UX/snippets por device.`,
      confidence: 'media',
      priority: 68,
    });
  }

  if (input.topNegativeCountry) {
    signals.push({
      id: 'country_clustered',
      title: 'Caída por país',
      detail: `El país con peor delta es ${input.topNegativeCountry}; validar intención local y cobertura geográfica.`,
      confidence: 'media',
      priority: 66,
    });
  }

  return signals.sort((a, b) => b.priority - a.priority);
};

export const inferLanguagePrefix = (url: string): string => {
  const match = url.match(/\/([a-z]{2})(?:\/|$)/i);
  return match ? `/${match[1].toLowerCase()}/` : 'default';
};

export const inferPageType = (url: string): string => {
  if (/\/blog\//i.test(url)) return 'blog';
  if (/\/product|\/pricing|\/plans/i.test(url)) return 'money';
  if (/\/help|\/docs|\/faq/i.test(url)) return 'support';
  if (/\/$/.test(url) || /\/home/i.test(url)) return 'home';
  return 'other';
};
