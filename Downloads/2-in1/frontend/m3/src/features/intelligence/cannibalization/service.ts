import { analyzeCannibalization } from '@/utils/gscInsights';
import { GSCRow } from '@/types';
import { CannibalizationIssue, CannibalizationRecommendationType } from './types';

const issueKey = (projectId: string) => `agenciaseo:cannibalization:issues:${projectId}`;

const recommendationLabel: Record<CannibalizationRecommendationType, string> = {
  merge_content: 'Fusionar contenidos.', differentiate_intent: 'Diferenciar intención.', canonicalize: 'Canonicalizar.',
  redirect: 'Redirigir.', improve_internal_linking: 'Mejorar enlazado interno.', change_target_keyword: 'Cambiar keyword objetivo.',
  update_title_h1: 'Actualizar title/H1.', create_hub_page: 'Crear página hub.', split_content: 'Separar contenido.',
  no_action: 'No actuar.', investigate: 'Investigar manualmente.',
};

const calcScore = (trafficRiskScore: number, overlapStrengthScore: number, businessValueScore: number, fixEaseScore: number, confidenceScore: number, urgencyScore: number) =>
  Math.round(trafficRiskScore * 0.25 + overlapStrengthScore * 0.25 + businessValueScore * 0.2 + fixEaseScore * 0.15 + confidenceScore * 0.1 + urgencyScore * 0.05);

export const getCannibalizationIssues = (projectId: string, rows: GSCRow[] = []): CannibalizationIssue[] => {
  const base = analyzeCannibalization(rows);
  if (!base.items.length) return [];
  return base.items.reduce<CannibalizationIssue[]>((acc, item, index) => {
    const query = item.query;
    const itemUrl = item.url;
    if (!query || !itemUrl) return acc;
    const existing = acc.find((i) => i.query === query);
    if (existing) {
      existing.affectedUrls.push({ url: itemUrl, clicks: item.clicks, impressions: item.impressions, ctr: item.ctr, position: item.position });
      existing.urlCount = existing.affectedUrls.length;
      return acc;
    }
    const trafficRiskScore = item.impressions > 1000 ? 90 : 60;
    const overlapStrengthScore = 75;
    const businessValueScore = 60;
    const fixEaseScore = 70;
    const confidenceScore = 85;
    const urgencyScore = 70;
    const score = calcScore(trafficRiskScore, overlapStrengthScore, businessValueScore, fixEaseScore, confidenceScore, urgencyScore);
    const recommendationType: CannibalizationRecommendationType = score >= 75 ? 'differentiate_intent' : 'investigate';
    acc.push({
      id: `cann-${query}-${index}`.replace(/\s+/g, '-').toLowerCase(),
      projectId,
      type: 'query_overlap',
      title: `Solapamiento por query: ${query}`,
      query,
      affectedUrls: [{ url: itemUrl, clicks: item.clicks, impressions: item.impressions, ctr: item.ctr, position: item.position, isWinning: true }],
      winningUrl: itemUrl,
      recommendedPrimaryUrl: itemUrl,
      urlCount: 1,
      severity: score >= 85 ? 'critical' : score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low',
      recommendationType,
      score,
      scoreBreakdown: { trafficRiskScore, overlapStrengthScore, businessValueScore, fixEaseScore, confidenceScore, urgencyScore },
      recommendation: recommendationLabel[recommendationType],
      reason: 'Detectado en GSC: múltiples URLs para la misma query.',
      evidence: [`Query: ${query}`, `Impresiones: ${item.impressions}`, `Clicks: ${item.clicks}`],
      status: 'new',
      sourceModule: 'gsc',
      dataMode: 'real',
      confidence: confidenceScore,
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return acc;
  }, []);
};

export const loadPersistedCannibalizationIssues = (projectId: string): CannibalizationIssue[] => {
  const raw = localStorage.getItem(issueKey(projectId));
  if (!raw) return [];
  try { return JSON.parse(raw) as CannibalizationIssue[]; } catch { return []; }
};

export const persistCannibalizationIssues = (projectId: string, issues: CannibalizationIssue[]) => {
  localStorage.setItem(issueKey(projectId), JSON.stringify(issues));
};

export const createOpportunityFromCannibalization = (issue: CannibalizationIssue) => ({
  // TODO: conectar a API real de opportunities/createOpportunity cuando esté disponible.
  id: `opp-${issue.id}`,
  title: `[Cannibalization] ${issue.title}`,
  type: 'cannibalization',
  sourceModule: 'cannibalization',
  sourceId: issue.id,
  score: issue.score,
});
