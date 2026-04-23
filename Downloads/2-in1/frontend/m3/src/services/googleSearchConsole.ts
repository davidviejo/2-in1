// Servicio para interactuar con la API de Google Search Console
// Requiere un Token de Acceso obtenido vía OAuth 2.0 (Implicit Flow)
import type {
  GSCDimension,
  GSCDimensionFilterGroup,
  GSCPagedSearchAnalyticsResponse,
  GSCResponse,
  GSCRow,
  GSCSearchType,
} from '../types';

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';
const USER_INFO_API = 'https://www.googleapis.com/oauth2/v2/userinfo';
const DEFAULT_PAGED_ROW_LIMIT = 25000;
const DEFAULT_PAGED_SEARCH_TYPE: GSCSearchType = 'web';
const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 10;
const DEFAULT_RETRY_ATTEMPTS = 5;
const DEFAULT_MIN_INTERVAL_MS = 250;
const DEFAULT_CARDINALITY_CHUNK_DAYS = 7;
const DEFAULT_LONG_RANGE_CHUNK_DAYS = 14;
const MAX_REASON_LOG_LENGTH = 180;
const VALID_DIMENSIONS = new Set<GSCDimension>(['date', 'query', 'page', 'country', 'device', 'searchAppearance']);

type CacheEntry = {
  expiresAt: number;
  value: GSCResponse;
};

const requestCache = new Map<string, CacheEntry>();
const rateLimitState = new Map<string, { chain: Promise<void>; lastRunAt: number }>();

const normalizeSiteUrl = (siteUrl: string): string => {
  const trimmed = siteUrl.trim();
  if (trimmed.startsWith('sc-domain:')) {
    return trimmed.toLowerCase();
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

const isValidIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const validateSearchAnalyticsParams = (params: QuerySearchAnalyticsPagedParams) => {
  if (!params.siteUrl || !params.siteUrl.trim()) {
    throw new Error('GSC validation error: siteUrl vacío');
  }
  if (!isValidIsoDate(params.startDate) || !isValidIsoDate(params.endDate)) {
    throw new Error('GSC validation error: fechas inválidas, usa YYYY-MM-DD');
  }
  if (new Date(`${params.startDate}T00:00:00Z`) > new Date(`${params.endDate}T00:00:00Z`)) {
    throw new Error('GSC validation error: startDate debe ser <= endDate');
  }
  if (!Array.isArray(params.dimensions) || params.dimensions.length === 0) {
    throw new Error('GSC validation error: dimensions vacío');
  }
  params.dimensions.forEach((dimension) => {
    if (!VALID_DIMENSIONS.has(dimension)) {
      throw new Error(`GSC validation error: dimensión inválida ${dimension}`);
    }
  });
  params.dimensionFilterGroups?.forEach((group) => {
    group.filters?.forEach((filter) => {
      if (!VALID_DIMENSIONS.has(filter.dimension)) {
        throw new Error(`GSC validation error: filtro con dimensión inválida ${filter.dimension}`);
      }
      if (!filter.operator || !filter.expression) {
        throw new Error('GSC validation error: filtro incompleto');
      }
    });
  });
};

const daysBetweenInclusive = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
};

const buildDateWindows = (startDate: string, endDate: string, chunkDays: number): Array<{ startDate: string; endDate: string }> => {
  const windows: Array<{ startDate: string; endDate: string }> = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const cursor = new Date(start);
  while (cursor <= end) {
    const windowStart = new Date(cursor);
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + Math.max(chunkDays - 1, 0));
    if (windowEnd > end) {
      windowEnd.setTime(end.getTime());
    }
    windows.push({
      startDate: windowStart.toISOString().slice(0, 10),
      endDate: windowEnd.toISOString().slice(0, 10),
    });
    cursor.setUTCDate(windowEnd.getUTCDate() + 1);
  }
  return windows;
};

const aggregateRowsByKeys = (rows: GSCRow[]): GSCRow[] => {
  const byKey = new Map<string, GSCRow>();
  rows.forEach((row) => {
    const keys = row.keys || [];
    const serializedKey = keys.join('||');
    const previous = byKey.get(serializedKey);
    if (!previous) {
      byKey.set(serializedKey, { ...row, keys: [...keys] });
      return;
    }
    const impressions = Number(previous.impressions || 0) + Number(row.impressions || 0);
    const clicks = Number(previous.clicks || 0) + Number(row.clicks || 0);
    byKey.set(serializedKey, {
      ...previous,
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      position:
        impressions > 0
          ? ((Number(previous.position || 0) * Number(previous.impressions || 0)) + (Number(row.position || 0) * Number(row.impressions || 0))) / impressions
          : 0,
    });
  });
  return Array.from(byKey.values());
};


const buildPageUrlVariants = (pageUrl: string) => {
  const trimmed = pageUrl.trim();
  if (!trimmed) return [];

  const variants = new Set([trimmed]);
  if (trimmed.endsWith('/')) {
    variants.add(trimmed.slice(0, -1));
  } else {
    variants.add(`${trimmed}/`);
  }
  return Array.from(variants);
};

const queryPageAnalytics = async (
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>,
  errorMessage: string,
) => {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const cacheKey = JSON.stringify({
    siteUrl: normalizedSiteUrl,
    body,
  });
  const cached = requestCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const scheduleKey = normalizedSiteUrl;
  const state = rateLimitState.get(scheduleKey) || { chain: Promise.resolve(), lastRunAt: 0 };
  let resolveGate: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });

  state.chain = state.chain.then(async () => {
    const elapsed = Date.now() - state.lastRunAt;
    const waitMs = Math.max(0, DEFAULT_MIN_INTERVAL_MS - elapsed);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    state.lastRunAt = Date.now();
    resolveGate?.();
  });
  rateLimitState.set(scheduleKey, state);
  await gate;

  const encodedSiteUrl = encodeURIComponent(normalizedSiteUrl);
  for (let attempt = 0; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${GSC_API_BASE}/sites/${encodedSiteUrl}/searchAnalytics/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data: GSCResponse = await response.json();
      requestCache.set(cacheKey, {
        value: data,
        expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
      });
      return data;
    }

    const err = await response.json().catch(() => ({}));
    const reason = String(err?.error?.errors?.[0]?.reason || 'unknown_reason');
    const shouldRetry =
      response.status === 429 ||
      response.status >= 500 ||
      ['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'backendError', 'internalError'].includes(reason);

    console.warn('[GSC][searchAnalytics.query] error', {
      reason: reason.slice(0, MAX_REASON_LOG_LENGTH),
      status: response.status,
      siteUrl: normalizedSiteUrl,
      dimensions: body.dimensions,
      filters: body.dimensionFilterGroups,
      startDate: body.startDate,
      endDate: body.endDate,
      attempt,
    });

    if (!shouldRetry || attempt >= DEFAULT_RETRY_ATTEMPTS) {
      throw new Error(err.error?.message || `${errorMessage} (${reason})`);
    }

    const backoffMs = Math.min(12000, 500 * 2 ** attempt);
    const jitterMs = Math.round(Math.random() * 250);
    await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
  }

  throw new Error(errorMessage);
};

export interface QuerySearchAnalyticsPagedParams {
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
  chunkDays?: number;
}

export const querySearchAnalyticsPaged = async (
  accessToken: string,
  params: QuerySearchAnalyticsPagedParams,
): Promise<GSCPagedSearchAnalyticsResponse> => {
  validateSearchAnalyticsParams(params);
  const {
    siteUrl: rawSiteUrl,
    startDate,
    endDate,
    dimensions: requestedDimensions,
    searchType = DEFAULT_PAGED_SEARCH_TYPE,
    dimensionFilterGroups,
    rowLimit = DEFAULT_PAGED_ROW_LIMIT,
    startRow = 0,
    maxPages,
    maxRows,
    allowHighCardinality = false,
    chunkDays,
  } = params;
  const siteUrl = normalizeSiteUrl(rawSiteUrl);
  const isHighCardinality = requestedDimensions.includes('page') && requestedDimensions.includes('query');
  const dimensions = isHighCardinality && !allowHighCardinality ? (['page'] as GSCDimension[]) : requestedDimensions;
  const totalDays = daysBetweenInclusive(startDate, endDate);
  const resolvedChunkDays = chunkDays
    || (isHighCardinality ? DEFAULT_CARDINALITY_CHUNK_DAYS : totalDays > 90 ? DEFAULT_LONG_RANGE_CHUNK_DAYS : totalDays);
  const windows = buildDateWindows(startDate, endDate, resolvedChunkDays);

  const allRows: GSCRow[] = [];
  let pagesFetched = 0;
  let currentStartRow = startRow;
  let truncatedReason: GSCPagedSearchAnalyticsResponse['metadata']['truncatedReason'];

  for (const window of windows) {
    currentStartRow = startRow;
    while ((typeof maxPages !== 'number' || pagesFetched < maxPages) && (typeof maxRows !== 'number' || allRows.length < maxRows)) {
      const data: GSCResponse = await queryPageAnalytics(
        accessToken,
        siteUrl,
        {
          startDate: window.startDate,
          endDate: window.endDate,
          dimensions,
          searchType,
          dimensionFilterGroups,
          rowLimit,
          startRow: currentStartRow,
        },
        'Error fetching paged analytics',
      );

      const pageRows = data.rows || [];
      pagesFetched += 1;

      if (pageRows.length === 0) {
        break;
      }

      if (typeof maxRows === 'number') {
        const remaining = maxRows - allRows.length;
        if (pageRows.length > remaining) {
          allRows.push(...pageRows.slice(0, remaining));
          truncatedReason = 'max_rows_reached';
          break;
        }
      }

      allRows.push(...pageRows);
      currentStartRow += pageRows.length;

      if (pageRows.length < rowLimit) {
        break;
      }
    }

    if (truncatedReason === 'max_rows_reached') break;
    if (typeof maxPages === 'number' && pagesFetched >= maxPages) {
      truncatedReason = 'max_pages_reached';
      break;
    }
  }

  if (!truncatedReason && typeof maxPages === 'number' && pagesFetched >= maxPages && allRows.length > 0) {
    truncatedReason = 'max_pages_reached';
  } else if (!truncatedReason && typeof maxRows === 'number' && allRows.length >= maxRows) {
    truncatedReason = 'max_rows_reached';
  }

  const mergedRows =
    windows.length > 1 && !dimensions.includes('date')
      ? aggregateRowsByKeys(allRows)
      : allRows;

  if (isHighCardinality && !allowHighCardinality) {
    console.info('[GSC][searchAnalytics.query] fallback aplicado: page+query => page', {
      siteUrl,
      startDate,
      endDate,
      requestedDimensions,
      resolvedDimensions: dimensions,
      chunkDays: resolvedChunkDays,
    });
  }

  return {
    rows: mergedRows,
    metadata: {
      isPartial: Boolean(truncatedReason),
      pagesFetched,
      rowsFetched: mergedRows.length,
      truncatedReason,
    },
  };
};

/**
 * Obtiene la información del usuario autenticado de Google.
 *
 * @param {string} accessToken - El token de acceso OAuth 2.0.
 * @returns {Promise<any>} Objeto con la información del usuario (nombre, email, foto, etc.).
 * @throws {Error} Si la petición falla.
 */
export const getUserInfo = async (accessToken: string) => {
  try {
    const response = await fetch(USER_INFO_API, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) throw new Error('Error fetching user info');

    return await response.json();
  } catch (error) {
    console.error('User Info Error:', error);
    throw error;
  }
};

/**
 * Lista los sitios verificados en Google Search Console del usuario.
 *
 * @param {string} accessToken - El token de acceso OAuth 2.0.
 * @returns {Promise<Array<{siteUrl: string, permissionLevel: string}>>} Lista de sitios.
 * @throws {Error} Si la petición falla.
 */
export const listSites = async (accessToken: string) => {
  try {
    const response = await fetch(`${GSC_API_BASE}/sites`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error('Error fetching sites');

    const data = await response.json();
    return (data.siteEntry || []).filter(
      (site: { siteUrl?: unknown }) => typeof site.siteUrl === 'string' && site.siteUrl.length > 0,
    );
  } catch (error) {
    console.error('GSC API Error:', error);
    throw error;
  }
};

/**
 * Obtiene analíticas de búsqueda para un sitio específico.
 *
 * @param {string} accessToken - El token de acceso OAuth 2.0.
 * @param {string} siteUrl - La URL del sitio (ej: 'sc-domain:example.com' o 'https://example.com/').
 * @param {string} startDate - Fecha de inicio en formato 'YYYY-MM-DD'.
 * @param {string} endDate - Fecha de fin en formato 'YYYY-MM-DD'.
 * @returns {Promise<Array<{keys: string[], clicks: number, impressions: number, ctr: number, position: number}>>} Filas de datos de analítica.
 * @throws {Error} Si la petición falla.
 */
export const getSearchAnalytics = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
) => {
  try {
    const result = await querySearchAnalyticsPaged(accessToken, {
      siteUrl,
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: 30,
    });
    return result.rows || [];
  } catch (error) {
    console.error('GSC Analytics Error:', error);
    throw error;
  }
};

/**
 * Obtiene analíticas de búsqueda agrupadas por CONSULTA (Query).
 *
 * @param {string} accessToken - El token de acceso OAuth 2.0.
 * @param {string} siteUrl - La URL del sitio.
 * @param {string} startDate - Fecha de inicio.
 * @param {string} endDate - Fecha de fin.
 * @param {number} rowLimit - Límite de filas (default 500).
 * @returns {Promise<Array<{keys: string[], clicks: number, impressions: number, ctr: number, position: number}>>}
 */
export const getGSCQueryData = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number = 500,
  options?: {
    searchType?: GSCSearchType;
    dimensionFilterGroups?: GSCDimensionFilterGroup[];
    maxPages?: number;
    maxRows?: number;
    chunkDays?: number;
  },
) => {
  try {
    const result = await querySearchAnalyticsPaged(accessToken, {
      siteUrl,
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit,
      searchType: options?.searchType,
      dimensionFilterGroups: options?.dimensionFilterGroups,
      maxPages: options?.maxPages,
      maxRows: options?.maxRows,
      chunkDays: options?.chunkDays,
    });
    return result.rows || [];
  } catch (error) {
    console.error('GSC Query Analytics Error:', error);
    throw error;
  }
};

/**
 * Obtiene analíticas de búsqueda agrupadas por CONSULTA y PÁGINA.
 * Útil para detectar canibalización y oportunidades específicas de URL.
 *
 * @param {string} accessToken - El token de acceso OAuth 2.0.
 * @param {string} siteUrl - La URL del sitio.
 * @param {string} startDate - Fecha de inicio.
 * @param {string} endDate - Fecha de fin.
 * @param {number} rowLimit - Límite de filas (default 1000).
 * @returns {Promise<Array<{keys: string[], clicks: number, impressions: number, ctr: number, position: number}>>}
 */
export const getGSCQueryPageData = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number = 1000,
  options?: {
    searchType?: GSCSearchType;
    dimensionFilterGroups?: GSCDimensionFilterGroup[];
    maxPages?: number;
    maxRows?: number;
    allowHighCardinality?: boolean;
    chunkDays?: number;
  },
) => {
  try {
    const result = await querySearchAnalyticsPaged(accessToken, {
      siteUrl,
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit,
      searchType: options?.searchType,
      dimensionFilterGroups: options?.dimensionFilterGroups,
      maxPages: options?.maxPages ?? 4,
      maxRows: options?.maxRows ?? 100000,
      allowHighCardinality: options?.allowHighCardinality ?? false,
      chunkDays: options?.chunkDays ?? DEFAULT_CARDINALITY_CHUNK_DAYS,
    });
    return result.rows || [];
  } catch (error) {
    console.error('GSC Query/Page Analytics Error:', error);
    throw error;
  }
};

/**
 * Obtiene analíticas de búsqueda filtradas por una PÁGINA específica.
 *
 * @param {string} accessToken - El token de acceso OAuth 2.0.
 * @param {string} siteUrl - La URL del sitio.
 * @param {string} pageUrl - La URL de la página a filtrar.
 * @param {string} startDate - Fecha de inicio.
 * @param {string} endDate - Fecha de fin.
 * @param {number} rowLimit - Tamaño de página por petición (default 25000).
 * @returns {Promise<Array<{keys: string[], clicks: number, impressions: number, ctr: number, position: number}>>}
 */
export const getPageQueries = async (
  accessToken: string,
  siteUrl: string,
  pageUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number = DEFAULT_PAGED_ROW_LIMIT,
  options?: {
    searchType?: GSCSearchType;
    maxPages?: number;
    maxRows?: number;
  },
) => {
  try {
    for (const variant of buildPageUrlVariants(pageUrl)) {
      const data = await querySearchAnalyticsPaged(
        accessToken,
        {
          siteUrl,
          startDate,
          endDate,
          dimensions: ['query'],
          dimensionFilterGroups: [
            {
              groupType: 'and',
              filters: [
                {
                  dimension: 'page',
                  operator: 'equals',
                  expression: variant,
                },
              ],
            },
          ],
          rowLimit,
          searchType: options?.searchType,
          maxPages: options?.maxPages,
          maxRows: options?.maxRows,
        },
      );

      if (data.rows.length) {
        return data.rows;
      }
    }

    return [];
  } catch (error) {
    console.error('GSC Page Query Error:', error);
    throw error;
  }
};

export const clearGSCRequestCache = () => {
  requestCache.clear();
};

export const getPageMetrics = async (
  accessToken: string,
  siteUrl: string,
  pageUrl: string,
  startDate: string,
  endDate: string,
) => {
  try {
    for (const variant of buildPageUrlVariants(pageUrl)) {
      const data = await queryPageAnalytics(
        accessToken,
        siteUrl,
        {
          startDate,
          endDate,
          dimensions: ['page'],
          dimensionFilterGroups: [
            {
              groupType: 'and',
              filters: [
                {
                  dimension: 'page',
                  operator: 'equals',
                  expression: variant,
                },
              ],
            },
          ],
          rowLimit: 1,
        },
        'Error fetching page metrics',
      );

      if (data.rows?.[0]) {
        return data.rows[0];
      }
    }

    return null;
  } catch (error) {
    console.error('GSC Page Metrics Error:', error);
    throw error;
  }
};

export const getGSCTimeSeriesData = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number = 1000,
  searchType: GSCSearchType = 'web',
) =>
  querySearchAnalyticsPaged(accessToken, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ['date'],
    rowLimit,
    searchType,
  });

export const getGSCPageWinnersLosersData = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number = 1000,
  searchType: GSCSearchType = 'web',
) =>
  querySearchAnalyticsPaged(accessToken, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ['page'],
    rowLimit,
    searchType,
  });

export const getGSCPageDateData = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number = 25000,
  searchType: GSCSearchType = 'web',
  options?: {
    maxPages?: number;
    maxRows?: number;
  },
) =>
  querySearchAnalyticsPaged(accessToken, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ['page', 'date'],
    rowLimit,
    searchType,
    maxPages: options?.maxPages,
    maxRows: options?.maxRows,
  });

export const getGSCAggregateMetrics = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  filters?: {
    query?: string;
    url?: string;
  },
) => {
  const dimensionFilters = [
    filters?.query
      ? {
          dimension: 'query' as const,
          operator: 'equals' as const,
          expression: filters.query,
        }
      : null,
    filters?.url
      ? {
          dimension: 'page' as const,
          operator: 'equals' as const,
          expression: filters.url,
        }
      : null,
  ].filter(Boolean);

  const response = await querySearchAnalyticsPaged(accessToken, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ['query', 'page'],
    rowLimit: 5000,
    maxPages: 5,
    dimensionFilterGroups:
      dimensionFilters.length > 0
        ? [
            {
              groupType: 'and',
              filters: dimensionFilters,
            },
          ]
        : undefined,
  });

  const rows = response.rows || [];
  const totals = rows.reduce(
    (acc, row) => {
      const impressions = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      acc.clicks += clicks;
      acc.impressions += impressions;
      acc.weightedPosition += Number(row.position || 0) * impressions;
      return acc;
    },
    { clicks: 0, impressions: 0, weightedPosition: 0 },
  );

  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const position = totals.impressions > 0 ? totals.weightedPosition / totals.impressions : 0;

  return {
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr,
    position,
    rowsFetched: rows.length,
  };
};

export const getGSCQueryWinnersLosersData = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number = 1000,
  searchType: GSCSearchType = 'web',
) =>
  querySearchAnalyticsPaged(accessToken, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit,
    searchType,
  });

export const getGSCSegmentationData = async (
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimension: 'country' | 'device' | 'searchAppearance',
  rowLimit: number = 1000,
  searchType: GSCSearchType = 'web',
) =>
  querySearchAnalyticsPaged(accessToken, {
    siteUrl,
    startDate,
    endDate,
    dimensions: [dimension],
    rowLimit,
    searchType,
  });
