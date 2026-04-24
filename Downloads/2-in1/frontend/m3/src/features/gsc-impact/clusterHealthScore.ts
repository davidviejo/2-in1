import { summarizeRows, TemporalRowLike } from '@/features/gsc-impact/impactAnalysis';

export type ClusterHealthRow = {
  cluster: string;
  urlCount: number;
  visibilityScore: number;
  ctrGapScore: number;
  volatilityScore: number;
  dropRiskScore: number;
  healthScore: number;
  preClicksPerDay: number;
  postClicksPerDay: number;
  rolloutClicksPerDay: number;
  deltaClicksPerDay: number;
  deltaCtrPp: number;
  deltaPosition: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const toScore = (value: number) => Number((clamp01(value) * 100).toFixed(1));

const safePct = (current: number, previous: number): number => {
  if (previous <= 0) {
    if (current <= 0) return 0;
    return 1;
  }
  return (current - previous) / previous;
};

const getClusterFromUrl = (urlLike: string) => {
  try {
    const url = new URL(urlLike);
    const first = url.pathname.split('/').filter(Boolean)[0];
    return first ? `/${first}/` : '/';
  } catch {
    if (!urlLike.startsWith('/')) return 'Sin dato';
    const first = urlLike.split('/').filter(Boolean)[0];
    return first ? `/${first}/` : '/';
  }
};

export const buildClusterHealthScores = <TRow extends TemporalRowLike>(
  rows: TRow[],
  days: { pre: number; rollout: number; post: number },
): ClusterHealthRow[] => {
  const grouped = new Map<string, TRow[]>();

  rows.forEach((row) => {
    const cluster = getClusterFromUrl(row.key);
    const bucket = grouped.get(cluster) || [];
    bucket.push(row);
    grouped.set(cluster, bucket);
  });

  return Array.from(grouped.entries())
    .map(([cluster, bucket]) => {
      const summary = summarizeRows(bucket, days);
      const preCtr = summary.pre.ctr;
      const postCtr = summary.post.ctr;
      const ctrDropPp = Math.max(0, (preCtr - postCtr) * 100);

      const clicksDeltaPct = safePct(summary.post.clicksPerDay, summary.pre.clicksPerDay);
      const impressionsDeltaPct = safePct(summary.post.impressionsPerDay, summary.pre.impressionsPerDay);
      const rolloutExpected = (summary.pre.clicksPerDay + summary.post.clicksPerDay) / 2;
      const rolloutDeviation = Math.abs(summary.rollout.clicksPerDay - rolloutExpected) / Math.max(1, rolloutExpected);

      const visibilityNorm = clamp01(0.5 + clicksDeltaPct * 0.7 + impressionsDeltaPct * 0.3);
      const ctrGapRisk = clamp01(Math.max(0, impressionsDeltaPct) * 0.35 + ctrDropPp / 10);
      const volatilityNorm = clamp01(1 - rolloutDeviation / 0.8);
      const dropRisk = clamp01(Math.max(0, -clicksDeltaPct) * 0.65 + Math.max(0, summary.postVsPre.position.absolute) / 4);

      const visibilityScore = toScore(visibilityNorm);
      const ctrGapScore = toScore(1 - ctrGapRisk);
      const volatilityScore = toScore(volatilityNorm);
      const dropRiskScore = toScore(1 - dropRisk);

      const healthScore = Number((
        visibilityScore * 0.35 +
        ctrGapScore * 0.25 +
        volatilityScore * 0.2 +
        dropRiskScore * 0.2
      ).toFixed(1));

      return {
        cluster,
        urlCount: bucket.length,
        visibilityScore,
        ctrGapScore,
        volatilityScore,
        dropRiskScore,
        healthScore,
        preClicksPerDay: summary.pre.clicksPerDay,
        postClicksPerDay: summary.post.clicksPerDay,
        rolloutClicksPerDay: summary.rollout.clicksPerDay,
        deltaClicksPerDay: summary.postVsPre.clicksPerDay.absolute,
        deltaCtrPp: summary.postVsPre.ctr.absolute * 100,
        deltaPosition: summary.postVsPre.position.absolute,
      };
    })
    .sort((a, b) => a.healthScore - b.healthScore);
};
