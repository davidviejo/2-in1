import { Opportunity } from '@/types/intelligence';

const STORAGE_KEYS = {
  opportunities: 'agenciaseo:intelligence:opportunities',
  contentGap: (projectId: string) => `agenciaseo:content-gap:state:${projectId}`,
};

export interface ContentGapModuleState {
  competitors: Array<Record<string, unknown>>;
  imports: Array<Record<string, unknown>>;
  gaps: Array<Record<string, unknown>>;
}

export const loadPersistedOpportunities = (): Opportunity[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.opportunities);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Opportunity[]) : [];
  } catch {
    return [];
  }
};

export const persistOpportunity = (opportunity: Opportunity): Opportunity[] => {
  const current = loadPersistedOpportunities();
  const next = [opportunity, ...current.filter((item) => item.id !== opportunity.id)];
  localStorage.setItem(STORAGE_KEYS.opportunities, JSON.stringify(next));
  return next;
};

export const loadContentGapState = (projectId: string): ContentGapModuleState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.contentGap(projectId));
    if (!raw) return { competitors: [], imports: [], gaps: [] };
    const parsed = JSON.parse(raw);
    return {
      competitors: Array.isArray(parsed?.competitors) ? parsed.competitors : [],
      imports: Array.isArray(parsed?.imports) ? parsed.imports : [],
      gaps: Array.isArray(parsed?.gaps) ? parsed.gaps : [],
    };
  } catch {
    return { competitors: [], imports: [], gaps: [] };
  }
};

export const persistContentGapState = (projectId: string, state: ContentGapModuleState) => {
  localStorage.setItem(STORAGE_KEYS.contentGap(projectId), JSON.stringify(state));
};
