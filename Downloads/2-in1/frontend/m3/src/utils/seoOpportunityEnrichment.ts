import { CHECKLIST_POINTS, ChecklistItem, SeoPage } from '@/types/seoChecklist';
import { buildSeoUrlCanonicalKey } from '@/utils/seoUrlNormalizer';

export type OpportunityTypeLabel = 'Quick win' | 'Requiere base' | 'Monitorizar' | 'Baja prioridad';

export interface PriorityInput {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  checklistProgressPercent: number;
  trendDelta?: number;
  pendingChecklistBlocks: string[];
  opportunityKind?: string;
}

export const calculateSeoOpportunityPriority = (input: PriorityInput) => {
  const volumeScore = Math.min(35, Math.log10(Math.max(input.impressions, 1)) * 10);
  const ctrScore = Math.min(25, Math.max(0, (0.08 - input.ctr) * 300));
  const positionScore = input.position >= 3 && input.position <= 15 ? 20 : input.position < 3 ? 8 : 12;
  const trendScore = Math.min(10, Math.max(-5, (input.trendDelta ?? 0) * 10));
  const pendingPenalty = Math.min(8, input.pendingChecklistBlocks.length);
  const score = Math.max(0, Math.min(100, Math.round(volumeScore + ctrScore + positionScore + trendScore - pendingPenalty)));
  const highPotential = score >= 60;
  let opportunityTypeLabel: OpportunityTypeLabel = 'Baja prioridad';
  if (highPotential && input.checklistProgressPercent >= 70) opportunityTypeLabel = 'Quick win';
  else if (highPotential) opportunityTypeLabel = 'Requiere base';
  else if (score >= 35 || input.ctr < 0.02 || (input.trendDelta ?? 0) < -0.1) opportunityTypeLabel = 'Monitorizar';

  return { seoPriorityScore: score, seoPriorityLabel: `${score}/100`, opportunityTypeLabel };
};

export const enrichGscOpportunitiesWithUrlChecklist = <T extends { key?: string; label?: string; postClicks?: number; postImpressions?: number; postCtr?: number; postPosition?: number; deltaClicks?: number }>(
  opportunities: T[],
  pages: SeoPage[],
) => {
  const pagesByKey = new Map(pages.map((page) => [buildSeoUrlCanonicalKey(page.url), page]));
  const pagesByPath = new Map(
    pages.map((page) => {
      const canonical = buildSeoUrlCanonicalKey(page.url);
      const firstSlash = canonical.indexOf('/');
      const pathOnly = firstSlash >= 0 ? canonical.slice(firstSlash) : canonical;
      return [pathOnly, page] as const;
    }),
  );

  return opportunities.map((opportunity) => {
    const rawUrl = opportunity.key || opportunity.label || '';
    const canonical = buildSeoUrlCanonicalKey(rawUrl);
    const firstSlash = canonical.indexOf('/');
    const pathOnly = firstSlash >= 0 ? canonical.slice(firstSlash) : canonical;
    const page = pagesByKey.get(canonical) || pagesByPath.get(pathOnly);
    if (!page) {
      return {
        ...opportunity,
        checklistProgressPercent: null,
        checklistCompletedCount: 0,
        checklistTotalCount: CHECKLIST_POINTS.length,
        pendingChecklistBlocks: [],
        targetKeyword: null,
        cluster: null,
        urlType: null,
        seoPriorityScore: 0,
        seoPriorityLabel: 'No disponible',
        opportunityTypeLabel: 'No disponible',
      };
    }

    const items = Object.values(page.checklist || {}) as ChecklistItem[];
    const completed = items.filter((item) => item.status_manual === 'SI' || item.status_manual === 'SI_IA').length;
    const total = items.length || CHECKLIST_POINTS.length;
    const progress = Math.round((completed / Math.max(total, 1)) * 100);
    const pendingChecklistBlocks = items.filter((item) => !['SI', 'SI_IA', 'NA'].includes(item.status_manual)).map((item) => item.label);
    const priority = calculateSeoOpportunityPriority({
      clicks: opportunity.postClicks ?? 0,
      impressions: opportunity.postImpressions ?? 0,
      ctr: opportunity.postCtr ?? 0,
      position: opportunity.postPosition ?? 0,
      checklistProgressPercent: progress,
      trendDelta: opportunity.deltaClicks,
      pendingChecklistBlocks,
    });

    return {
      ...opportunity,
      checklistProgressPercent: progress,
      checklistCompletedCount: completed,
      checklistTotalCount: total,
      pendingChecklistBlocks,
      targetKeyword: page.kwPrincipal || null,
      cluster: page.cluster || null,
      urlType: page.pageType || null,
      ...priority,
    };
  });
};
