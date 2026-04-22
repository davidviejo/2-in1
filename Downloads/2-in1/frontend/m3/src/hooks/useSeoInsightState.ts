import { useEffect, useMemo, useState } from 'react';
import { SeoInsight, SeoInsightLifecycleStatus } from '../types/seoInsights';

const STORAGE_KEY = 'mediaflow-seo-insight-state-v2';
const FINGERPRINT_PREFIX = 'fingerprint';

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

const normalizeToken = (value?: string | number | null) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const buildInsightFingerprint = (insight: SeoInsight) => {
  const stableRule = normalizeToken(insight.ruleKey || insight.title);
  const property = normalizeToken(insight.propertyId || insight.trace?.propertyId);
  const moduleId = normalizeToken(insight.moduleId ?? insight.trace?.moduleId);
  const sourceType = normalizeToken(insight.sourceType);
  const action = normalizeToken(insight.suggestedAction || insight.action);

  return [stableRule, property, moduleId, sourceType, action].join('|');
};

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
    const byIdKey = `${scope}:${insight.id}`;
    const byFingerprintKey = `${scope}:${FINGERPRINT_PREFIX}:${buildInsightFingerprint(insight)}`;

    return entries[byIdKey]?.status || entries[byFingerprintKey]?.status || insight.status || 'new';
  };

  const setInsightStatus = (insightOrId: string | SeoInsight, status: SeoInsightLifecycleStatus) => {
    if (!isValidStatus(status)) return;
    const updatedAt = Date.now();

    if (typeof insightOrId === 'string') {
      const key = `${scope}:${insightOrId}`;
      setEntries((prev) => ({
        ...prev,
        [key]: {
          insightId: insightOrId,
          status,
          updatedAt,
        },
      }));
      return;
    }

    const fingerprintKey = `${scope}:${FINGERPRINT_PREFIX}:${buildInsightFingerprint(insightOrId)}`;
    const idKey = `${scope}:${insightOrId.id}`;

    setEntries((prev) => ({
      ...prev,
      [idKey]: {
        insightId: insightOrId.id,
        status,
        updatedAt,
      },
      [fingerprintKey]: {
        insightId: insightOrId.id,
        status,
        updatedAt,
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
