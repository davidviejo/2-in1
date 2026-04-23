import type {
  GSCDimension,
  GSCDimensionFilterGroup,
  GSCPagedSearchAnalyticsResponse,
  GSCSearchType,
} from '@/types';
import { querySearchAnalyticsPaged } from './googleSearchConsole';

const SESSION_CACHE_TTL_MS = 1000 * 60 * 15;
const PERSISTED_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const PERSISTED_CACHE_PREFIX = 'mediaflow_gsc_dataset_cache_v1:';
const MAX_PERSISTED_ROWS = 2500;

export interface GscLogicalQuery {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: GSCDimension[];
  searchType?: GSCSearchType;
  dimensionFilterGroups?: GSCDimensionFilterGroup[];
  rowLimit?: number;
  startRow?: number;
  maxPages?: number;
  maxRows?: number;
  allowHighCardinality?: boolean;
  enableDateChunking?: boolean;
  dateChunkSizeDays?: number;
}

interface CachedDataset {
  createdAt: number;
  response: GSCPagedSearchAnalyticsResponse;
}

interface DatasetStats {
  logicalRequests: number;
  reusedInFlight: number;
  cacheHits: {
    session: number;
    persistent: number;
  };
  realHttpCalls: number;
}

const inFlight = new Map<string, Promise<GSCPagedSearchAnalyticsResponse>>();
const sessionCache = new Map<string, CachedDataset>();
const stats: DatasetStats = {
  logicalRequests: 0,
  reusedInFlight: 0,
  cacheHits: {
    session: 0,
    persistent: 0,
  },
  realHttpCalls: 0,
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const getDatasetKey = (query: GscLogicalQuery): string => stableStringify(query);

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readPersistentCache = (key: string): CachedDataset | null => {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(`${PERSISTED_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedDataset;
    if (!parsed?.createdAt || !parsed?.response) return null;
    if (Date.now() - parsed.createdAt > PERSISTED_CACHE_TTL_MS) {
      window.localStorage.removeItem(`${PERSISTED_CACHE_PREFIX}${key}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writePersistentCache = (key: string, dataset: CachedDataset) => {
  if (!canUseStorage()) return;
  const rows = dataset.response.rows || [];
  if (rows.length > MAX_PERSISTED_ROWS) return;
  try {
    window.localStorage.setItem(`${PERSISTED_CACHE_PREFIX}${key}`, JSON.stringify(dataset));
  } catch {
    // no-op: almacenamiento lleno o restringido
  }
};

const readSessionCache = (key: string): CachedDataset | null => {
  const cached = sessionCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > SESSION_CACHE_TTL_MS) {
    sessionCache.delete(key);
    return null;
  }
  return cached;
};

const logStats = (event: string, key: string) => {
  console.info('[GSC_DATASET_MANAGER]', {
    event,
    key,
    logicalRequests: stats.logicalRequests,
    realHttpCalls: stats.realHttpCalls,
    inFlightReuse: stats.reusedInFlight,
    sessionHits: stats.cacheHits.session,
    persistentHits: stats.cacheHits.persistent,
  });
};

export const gscDatasetManager = {
  async fetch(accessToken: string, query: GscLogicalQuery): Promise<GSCPagedSearchAnalyticsResponse> {
    const key = getDatasetKey(query);
    stats.logicalRequests += 1;

    const session = readSessionCache(key);
    if (session) {
      stats.cacheHits.session += 1;
      logStats('cache_session_hit', key);
      return session.response;
    }

    const persisted = readPersistentCache(key);
    if (persisted) {
      stats.cacheHits.persistent += 1;
      sessionCache.set(key, persisted);
      logStats('cache_persistent_hit', key);
      return persisted.response;
    }

    const existing = inFlight.get(key);
    if (existing) {
      stats.reusedInFlight += 1;
      logStats('inflight_reuse', key);
      return existing;
    }

    const fetchPromise = querySearchAnalyticsPaged(accessToken, query)
      .then((response) => {
        const dataset = { createdAt: Date.now(), response };
        sessionCache.set(key, dataset);
        writePersistentCache(key, dataset);
        stats.realHttpCalls += response.metadata.pagesFetched || 0;
        logStats('network_fetch', key);
        return response;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, fetchPromise);
    return fetchPromise;
  },

  async fetchBundle(
    accessToken: string,
    requests: Array<{ id: string; query: GscLogicalQuery }>,
  ): Promise<Record<string, GSCPagedSearchAnalyticsResponse>> {
    const planned = new Map<string, { id: string; query: GscLogicalQuery; key: string }>();
    for (const request of requests) {
      const key = getDatasetKey(request.query);
      if (!planned.has(key)) {
        planned.set(key, { ...request, key });
      }
    }

    const entries = Array.from(planned.values());
    const resolved = await Promise.all(
      entries.map(async (entry) => {
        const response = await this.fetch(accessToken, entry.query);
        return [entry.id, response] as const;
      }),
    );

    return Object.fromEntries(resolved);
  },

  getStats(): DatasetStats {
    return {
      logicalRequests: stats.logicalRequests,
      reusedInFlight: stats.reusedInFlight,
      cacheHits: { ...stats.cacheHits },
      realHttpCalls: stats.realHttpCalls,
    };
  },

  clear() {
    inFlight.clear();
    sessionCache.clear();
    stats.logicalRequests = 0;
    stats.reusedInFlight = 0;
    stats.cacheHits.session = 0;
    stats.cacheHits.persistent = 0;
    stats.realHttpCalls = 0;
  },
};
