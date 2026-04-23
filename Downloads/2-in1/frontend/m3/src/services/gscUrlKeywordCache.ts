import type { GSCRow } from '../types';

const STORAGE_KEY = 'mediaflow_gsc_url_keyword_cache_v1';
const MAX_QUERIES_PER_URL = 20;
const MAX_CACHE_ENTRIES = 5;
const MAX_URLS_PER_SNAPSHOT = 1500;

export interface CachedUrlKeywordQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface CachedUrlKeywordEntry {
  queries: CachedUrlKeywordQuery[];
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    queryCount: number;
  };
}

export interface GscUrlKeywordCacheSnapshot {
  siteUrl: string;
  startDate: string;
  endDate: string;
  capturedAt: number;
  urls: Record<string, CachedUrlKeywordEntry>;
}

const normalizeUrl = (url?: string) => (url || '').trim();

const getUrlVariants = (url: string) => {
  const trimmed = normalizeUrl(url);
  if (!trimmed) return [];
  if (trimmed.endsWith('/')) {
    return [trimmed, trimmed.slice(0, -1)];
  }
  return [trimmed, `${trimmed}/`];
};

const safeParseCache = (): GscUrlKeywordCacheSnapshot[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('No se pudo leer caché de keywords por URL de GSC.', error);
    return [];
  }
};

const saveCache = (snapshots: GscUrlKeywordCacheSnapshot[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots.slice(0, MAX_CACHE_ENTRIES)));
  } catch (error) {
    console.warn('No se pudo guardar caché de keywords por URL de GSC.', error);
  }
};

export const persistGscUrlKeywordCache = (
  siteUrl: string,
  startDate: string,
  endDate: string,
  rows: GSCRow[],
) => {
  if (!siteUrl || !Array.isArray(rows) || rows.length === 0) return;

  const byUrl = new Map<string, Map<string, CachedUrlKeywordQuery>>();

  for (const row of rows) {
    const query = normalizeUrl(row?.keys?.[0]);
    const page = normalizeUrl(row?.keys?.[1]);
    if (!query || !page) continue;

    const pageMap = byUrl.get(page) || new Map<string, CachedUrlKeywordQuery>();
    const existing = pageMap.get(query);

    if (existing) {
      existing.clicks += Number(row.clicks || 0);
      existing.impressions += Number(row.impressions || 0);
      existing.position = Math.min(existing.position, Number(row.position || Number.POSITIVE_INFINITY));
      existing.ctr = existing.impressions > 0 ? existing.clicks / existing.impressions : 0;
      pageMap.set(query, existing);
    } else {
      const clicks = Number(row.clicks || 0);
      const impressions = Number(row.impressions || 0);
      pageMap.set(query, {
        query,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : Number(row.ctr || 0),
        position: Number(row.position || Number.POSITIVE_INFINITY),
      });
    }

    byUrl.set(page, pageMap);
  }

  const urlEntries: Array<[string, CachedUrlKeywordEntry]> = [];
  for (const [url, queryMap] of byUrl.entries()) {
    const sortedQueries = Array.from(queryMap.values())
      .sort((a, b) => {
        if (b.clicks !== a.clicks) return b.clicks - a.clicks;
        if (b.impressions !== a.impressions) return b.impressions - a.impressions;
        return a.position - b.position;
      })
      .slice(0, MAX_QUERIES_PER_URL);

    const totalClicks = sortedQueries.reduce((sum, item) => sum + item.clicks, 0);
    const totalImpressions = sortedQueries.reduce((sum, item) => sum + item.impressions, 0);
    const weightedPositionDenominator = sortedQueries.reduce(
      (sum, item) => sum + (Number.isFinite(item.position) ? item.impressions : 0),
      0,
    );
    const weightedPositionNumerator = sortedQueries.reduce(
      (sum, item) =>
        sum + (Number.isFinite(item.position) ? item.position * item.impressions : 0),
      0,
    );

    urlEntries.push([url, {
      queries: sortedQueries,
      metrics: {
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        position:
          weightedPositionDenominator > 0
            ? weightedPositionNumerator / weightedPositionDenominator
            : 0,
        queryCount: sortedQueries.length,
      },
    }]);
  }

  const urls: Record<string, CachedUrlKeywordEntry> = Object.fromEntries(
    urlEntries
      .sort(([, a], [, b]) => {
        if (b.metrics.clicks !== a.metrics.clicks) return b.metrics.clicks - a.metrics.clicks;
        if (b.metrics.impressions !== a.metrics.impressions) {
          return b.metrics.impressions - a.metrics.impressions;
        }
        return a.metrics.position - b.metrics.position;
      })
      .slice(0, MAX_URLS_PER_SNAPSHOT),
  );

  const snapshot: GscUrlKeywordCacheSnapshot = {
    siteUrl,
    startDate,
    endDate,
    capturedAt: Date.now(),
    urls,
  };

  const current = safeParseCache().filter((item) => item.siteUrl !== siteUrl);
  saveCache([snapshot, ...current]);
};

export const getLatestGscUrlKeywordCache = (siteUrl: string) => {
  if (!siteUrl) return null;
  const snapshots = safeParseCache();
  return snapshots.find((snapshot) => snapshot.siteUrl === siteUrl) || null;
};

export const getCachedUrlKeywordEntry = (
  snapshot: GscUrlKeywordCacheSnapshot | null,
  pageUrl: string,
) => {
  if (!snapshot) return null;
  for (const candidate of getUrlVariants(pageUrl)) {
    if (snapshot.urls[candidate]) {
      return snapshot.urls[candidate];
    }
  }
  return null;
};
