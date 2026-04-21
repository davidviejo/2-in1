import { useEffect, useMemo, useState } from 'react';
import { SeoInsight, SeoInsightLifecycleStatus } from '../types/seoInsights';

const STORAGE_KEY = 'mediaflow-seo-insight-state-v2';

export interface SeoInsightStateEntry {
  insightId: string;
  status: SeoInsightLifecycleStatus;
  updatedAt: number;
}

const isValidStatus = (status: unknown): status is SeoInsightLifecycleStatus =>
  status === 'new' ||
  status === 'triaged' ||
  status === 'planned' ||
  status === 'in_progress' ||
  status === 'done' ||
  status === 'ignored' ||
  status === 'postponed' ||
  status === 'actionable' ||
  status === 'watch' ||
  status === 'investigate' ||
  status === 'ok';

export const useSeoInsightState = (scope: string) => {
  const [entries, setEntries] = useState<Record<string, SeoInsightStateEntry>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, SeoInsightStateEntry>;
      setEntries(parsed || {});
    } catch (error) {
      console.warn('Could not parse SEO insight state', error);
      setEntries({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const getInsightStatus = (insight: SeoInsight): SeoInsightLifecycleStatus => {
    const key = `${scope}:${insight.id}`;
    return entries[key]?.status || insight.status || 'new';
  };

  const setInsightStatus = (insightId: string, status: SeoInsightLifecycleStatus) => {
    if (!isValidStatus(status)) return;
    const key = `${scope}:${insightId}`;
    setEntries((prev) => ({
      ...prev,
      [key]: {
        insightId,
        status,
        updatedAt: Date.now(),
      },
    }));
  };

  const scopedEntries = useMemo(() => {
    const prefix = `${scope}:`;
    return Object.entries(entries)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value);
  }, [entries, scope]);

  return {
    entries: scopedEntries,
    getInsightStatus,
    setInsightStatus,
  };
};
