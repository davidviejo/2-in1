import { useState, useCallback, useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import {
  SeoPage,
  ChecklistKey,
  ChecklistItem,
  ChecklistStatus,
  CHECKLIST_POINTS,
  normalizeChecklistStatus,
} from '../types/seoChecklist';
import { isBrandTermMatch } from '../utils/brandTerms';
import { useSeoChecklistSettings } from './useSeoChecklistSettings';

const normalizeKeyword = (keyword?: string) => (keyword || '').trim().toLowerCase();
const isUsableKeyword = (keyword?: string) => {
  const normalized = normalizeKeyword(keyword);
  return Boolean(normalized) && normalized !== '-';
};

const getKeywordCandidate = (page: SeoPage) => {
  if (isUsableKeyword(page.kwPrincipal)) {
    return page.kwPrincipal.trim();
  }

  if (isUsableKeyword(page.originalKwPrincipal)) {
    return page.originalKwPrincipal!.trim();
  }

  return '';
};

const getPagePerformanceScore = (page: SeoPage) => {
  const clicks = page.gscMetrics?.clicks || 0;
  const impressions = page.gscMetrics?.impressions || 0;
  const position = page.gscMetrics?.position ?? Number.POSITIVE_INFINITY;

  return { clicks, impressions, position };
};

const shouldKeepKeywordOver = (candidate: SeoPage, currentWinner: SeoPage) => {
  const candidateScore = getPagePerformanceScore(candidate);
  const winnerScore = getPagePerformanceScore(currentWinner);

  if (candidateScore.clicks !== winnerScore.clicks) {
    return candidateScore.clicks > winnerScore.clicks;
  }

  if (candidateScore.impressions !== winnerScore.impressions) {
    return candidateScore.impressions > winnerScore.impressions;
  }

  if (candidateScore.position !== winnerScore.position) {
    return candidateScore.position < winnerScore.position;
  }

  return candidate.id < currentWinner.id;
};

const buildFallbackChecklistItem = (key: ChecklistKey): ChecklistItem => {
  const point = CHECKLIST_POINTS.find((item) => item.key === key);
  return {
    key,
    label: point?.label || key,
    status_manual: 'NA',
    notes_manual: '',
  };
};

const normalizeChecklist = (checklist?: Partial<Record<ChecklistKey, ChecklistItem>>) => {
  return CHECKLIST_POINTS.reduce(
    (acc, point) => {
      const existing = checklist?.[point.key];
      acc[point.key] = existing
        ? {
            ...buildFallbackChecklistItem(point.key),
            ...existing,
            status_manual: normalizeChecklistStatus(existing.status_manual),
          }
        : buildFallbackChecklistItem(point.key);
      return acc;
    },
    {} as Record<ChecklistKey, ChecklistItem>,
  );
};

const normalizeSeoPage = (page: SeoPage): SeoPage => ({
  ...page,
  checklist: normalizeChecklist(page.checklist),
});

const normalizeSeoPages = (pages: SeoPage[]) => pages.map(normalizeSeoPage);

const AI_DRIVEN_STATUSES = new Set<ChecklistStatus>(['SI_IA', 'ERROR_CLARO_IA']);

const isProtectedManualSiOverwrite = (
  currentStatus: ChecklistItem['status_manual'],
  nextStatus?: ChecklistItem['status_manual'],
) => currentStatus === 'SI' && Boolean(nextStatus) && AI_DRIVEN_STATUSES.has(nextStatus!);

export const mergeChecklistItemWithBusinessRules = (
  currentItem: ChecklistItem,
  incomingUpdates: Partial<ChecklistItem>,
): ChecklistItem => {
  if (!isProtectedManualSiOverwrite(currentItem.status_manual, incomingUpdates.status_manual)) {
    return { ...currentItem, ...incomingUpdates };
  }

  const { status_manual: _statusManual, notes_manual: _notesManual, ...rest } = incomingUpdates;
  return { ...currentItem, ...rest };
};

const mergeChecklistWithBusinessRules = (
  currentChecklist: Record<ChecklistKey, ChecklistItem>,
  incomingChecklist?: Partial<Record<ChecklistKey, ChecklistItem>>,
) => {
  if (!incomingChecklist) return currentChecklist;

  return CHECKLIST_POINTS.reduce(
    (acc, point) => {
      const currentItem = currentChecklist[point.key] || buildFallbackChecklistItem(point.key);
      const incomingItem = incomingChecklist[point.key];
      acc[point.key] = incomingItem
        ? mergeChecklistItemWithBusinessRules(currentItem, incomingItem)
        : currentItem;
      return acc;
    },
    {} as Record<ChecklistKey, ChecklistItem>,
  );
};

export const enforceUniquePrimaryKeywords = (pages: SeoPage[], brandTerms: string[] = []) => {
  const winners = new Map<string, string>();

  pages.forEach((page) => {
    const keywordCandidate = getKeywordCandidate(page);
    const isBrandKeywordCandidate = isBrandTermMatch(keywordCandidate, brandTerms);
    const isBrandPage = Boolean(page.isBrandKeyword || isBrandKeywordCandidate);

    if (isBrandPage) return;

    const normalizedKeyword = normalizeKeyword(keywordCandidate);
    if (!isUsableKeyword(keywordCandidate)) return;

    const currentWinnerId = winners.get(normalizedKeyword);
    if (!currentWinnerId) {
      winners.set(normalizedKeyword, page.id);
      return;
    }

    const currentWinner = pages.find((candidate) => candidate.id === currentWinnerId);
    if (!currentWinner || shouldKeepKeywordOver(page, currentWinner)) {
      winners.set(normalizedKeyword, page.id);
    }
  });

  return pages.map((page) => {
    const keywordCandidate = getKeywordCandidate(page);
    const isBrandKeywordCandidate = isBrandTermMatch(keywordCandidate, brandTerms);
    const isBrandPage = Boolean(page.isBrandKeyword || isBrandKeywordCandidate);
    const normalizedKeyword = normalizeKeyword(keywordCandidate);
    const nextOriginalKeyword = isUsableKeyword(keywordCandidate) ? keywordCandidate : undefined;

    if (isBrandPage) {
      return {
        ...page,
        kwPrincipal: '',
        originalKwPrincipal: nextOriginalKeyword,
        isBrandKeyword: true,
      };
    }

    if (!isUsableKeyword(keywordCandidate)) {
      return {
        ...page,
        originalKwPrincipal: nextOriginalKeyword,
      };
    }

    if (winners.get(normalizedKeyword) === page.id) {
      return {
        ...page,
        kwPrincipal: keywordCandidate,
        originalKwPrincipal: keywordCandidate,
      };
    }

    return {
      ...page,
      kwPrincipal: '',
      originalKwPrincipal: keywordCandidate,
    };
  });
};

export const useSeoChecklist = () => {
  const { currentClientId } = useProject();
  const { settings } = useSeoChecklistSettings();
  const activeBrandTerms = useMemo(() => settings.brandTerms || [], [settings.brandTerms]);
  const storageKey = `mediaflow_seo_checklist_${currentClientId}`;
  const [pages, setPages] = useState<SeoPage[]>(() => {
    if (!currentClientId) return [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return [];

      const parsed = JSON.parse(saved) as SeoPage[];
      const normalized = normalizeSeoPages(parsed);
      if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
        localStorage.setItem(storageKey, JSON.stringify(normalized));
      }

      return normalized;
    } catch (e) {
      console.error('Failed to parse SEO Checklist data', e);
      return [];
    }
  });

  const addPages = useCallback(
    (newPages: SeoPage[]) => {
      setPages((prev) => {
        const updated = enforceUniquePrimaryKeywords(
          normalizeSeoPages([...prev, ...newPages]),
          activeBrandTerms,
        );
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [activeBrandTerms, storageKey],
  );

  const updatePage = useCallback(
    (id: string, updates: Partial<SeoPage>) => {
      setPages((prev) => {
        const updated = enforceUniquePrimaryKeywords(
          normalizeSeoPages(prev.map((p) => (p.id === id ? { ...p, ...updates } : p))),
          activeBrandTerms,
        );
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [activeBrandTerms, storageKey],
  );

  const bulkUpdatePages = useCallback(
    (updates: { id: string; changes: Partial<SeoPage> }[]) => {
      setPages((prev) => {
        const updated = enforceUniquePrimaryKeywords(
          normalizeSeoPages(
            prev.map((p) => {
              const update = updates.find((u) => u.id === p.id);
              if (!update) return p;
              const mergedChecklist = update.changes.checklist
                ? mergeChecklistWithBusinessRules(p.checklist, update.changes.checklist)
                : p.checklist;
              return { ...p, ...update.changes, checklist: mergedChecklist };
            }),
          ),
          activeBrandTerms,
        );
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [activeBrandTerms, storageKey],
  );

  const updateChecklistItem = useCallback(
    (pageId: string, key: ChecklistKey, updates: Partial<ChecklistItem>) => {
      setPages((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== pageId) return p;
          const currentItem = p.checklist[key];
          return {
            ...p,
            checklist: {
              ...p.checklist,
              [key]: mergeChecklistItemWithBusinessRules(
                currentItem || buildFallbackChecklistItem(key),
                updates,
              ),
            },
          };
        });
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [storageKey],
  );

  const deletePage = useCallback(
    (id: string) => {
      setPages((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [storageKey],
  );

  const bulkDeletePages = useCallback(
    (ids: string[]) => {
      setPages((prev) => {
        const updated = prev.filter((p) => !ids.includes(p.id));
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [storageKey],
  );

  return {
    pages,
    addPages,
    updatePage,
    bulkUpdatePages,
    updateChecklistItem,
    deletePage,
    bulkDeletePages,
  };
};
