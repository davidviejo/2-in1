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
const CACHE_TTL_MS = 1000 * 60 * 30;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;
const HIGH_CARDINALITY_DAILY_WINDOW_DAYS = 1;
const STANDARD_WEEKLY_WINDOW_DAYS = 7;
const ALLOWED_DIMENSIONS = new Set<GSCDimension>(['date', 'query', 'page', 'country', 'device', 'searchAppearance']);
const ALLOWED_FILTER_OPERATORS = new Set(['equals', 'notEquals', 'contains', 'notContains', 'includingRegex', 'excludingRegex']);

interface GSCApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
}

interface ParsedGSCError {
  statusCode?: number;
  reason?: string;
  message: string;
  retriable: boolean;
}

interface GSCRequestPayload {
  startDate: string;
  endDate: string;
  dimensions: GSCDimension[];
  searchType: GSCSearchType;
  dimensionFilterGroups?: GSCDimensionFilterGroup[];
  rowLimit: number;
  startRow: number;
}

interface QueryChunk {
  startDate: string;
  endDate: string;
}

type RateLimiterState = {
  tail: Promise<void>;
  nextAtMs: number;
};

const gscRequestCache = new Map<string, { expiresAt: number; response: GSCResponse }>();
const siteRateLimiter = new Map<string, RateLimiterState>();

const normalizeSiteUrl = (siteUrl: string): string => {
  const normalized = siteUrl.trim();
  if (!normalized) {
    throw new Error('siteUrl es obligatorio.');
  }
  if (normalized.startsWith('sc-domain:')) {
    const domain = normalized.slice('sc-domain:'.length).trim();
    if (!domain || domain.includes(' ')) {
      throw new Error(`siteUrl inválido para propiedad de dominio: ${siteUrl}`);
    }
    return `sc-domain:${domain.toLowerCase()}`;
  }
  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    throw new Error(`siteUrl inválido: ${siteUrl}`);
  }
};

const isIsoDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date);

const daysBetween = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

const addDays = (date: string, delta: number) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
};

const buildCacheKey = (siteUrl: string, payload: GSCRequestPayload) =>
  JSON.stringify({
    siteUrl,
    startDate: payload.startDate,
    endDate: payload.endDate,
    dimensions: payload.dimensions,
    searchType: payload.searchType,
    dimensionFilterGroups: payload.dimensionFilterGroups || [],
    rowLimit: payload.rowLimit,
    startRow: payload.startRow,
  });

const parseGSCError = (statusCode: number | undefined, body: GSCApiErrorPayload | null, fallbackMessage: string): ParsedGSCError => {
  const reason = body?.error?.errors?.[0]?.reason;
  const message = body?.error?.message || body?.error?.errors?.[0]?.message || fallbackMessage;
  const retriableReason = reason ? ['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'backendError', 'internalError'].includes(reason) : false;
  const retriable = statusCode === 429 || (typeof statusCode === 'number' && statusCode >= 500) || retriableReason;
  return { statusCode, reason, message, retriable };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const withJitter = (base: number) => Math.min(MAX_BACKOFF_MS, base + Math.round(Math.random() * 0.3 * base));

const executeWithRateLimit = async (scope: string, fn: () => Promise<GSCResponse>) => {
  const now = Date.now();
  const existing = siteRateLimiter.get(scope) || { tail: Promise.resolve(), nextAtMs: now };

  let result: GSCResponse | undefined;
  const run = async () => {
    const waitMs = Math.max(0, existing.nextAtMs - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    existing.nextAtMs = Date.now() + 250;
    result = await fn();
  };

  const execution = existing.tail.then(run, run);
  existing.tail = execution.then(() => undefined, () => undefined);
  siteRateLimiter.set(scope, existing);
  await execution;
  return result as GSCResponse;
};

const buildDateChunks = (startDate: string, endDate: string, windowDays: number): QueryChunk[] => {
  const chunks: QueryChunk[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const chunkEnd = addDays(cursor, windowDays - 1);
    chunks.push({
      startDate: cursor,
      endDate: chunkEnd > endDate ? endDate : chunkEnd,
    });
    cursor = addDays(chunkEnd > endDate ? endDate : chunkEnd, 1);
  }
  return chunks;
};

const validateQueryInput = (
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: GSCDimension[],
  dimensionFilterGroups?: GSCDimensionFilterGroup[],
) => {
  normalizeSiteUrl(siteUrl);
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new Error(`Formato de fecha inválido. Se esperaba YYYY-MM-DD. startDate=${startDate}, endDate=${endDate}`);
  }
  if (startDate > endDate) {
    throw new Error(`Rango de fecha inválido: startDate (${startDate}) > endDate (${endDate}).`);
  }
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    throw new Error('Debes enviar al menos una dimensión válida.');
  }
  if (!dimensions.every((dimension) => ALLOWED_DIMENSIONS.has(dimension))) {
    throw new Error(`Dimensiones inválidas: ${dimensions.join(', ')}`);
  }
  if (!dimensionFilterGroups) return;
  dimensionFilterGroups.forEach((group, groupIndex) => {
    if (!Array.isArray(group.filters) || group.filters.length === 0) {
      throw new Error(`dimensionFilterGroups[${groupIndex}] debe incluir al menos un filtro.`);
    }
    group.filters.forEach((filter, filterIndex) => {
      if (!ALLOWED_DIMENSIONS.has(filter.dimension)) {
        throw new Error(`Filtro inválido en group ${groupIndex}, posición ${filterIndex}: dimensión "${filter.dimension}"`);
      }
      if (!ALLOWED_FILTER_OPERATORS.has(filter.operator)) {
        throw new Error(`Operador inválido en group ${groupIndex}, posición ${filterIndex}: "${filter.operator}"`);
      }
      if (!filter.expression || !filter.expression.trim()) {
        throw new Error(`Expresión vacía en group ${groupIndex}, posición ${filterIndex}.`);
      }
    });
  });
};

const logGSCStructuredError = (parsedError: ParsedGSCError, context: Record<string, unknown>) => {
  console.error('GSC_QUERY_FAILED', {
    reason: parsedError.reason || 'unknown',
    statusCode: parsedError.statusCode,
    retriable: parsedError.retriable,
    ...context,
  });
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
  body: GSCRequestPayload,
  errorMessage: string,
) => {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const cacheKey = buildCacheKey(normalizedSiteUrl, body);
  const cached = gscRequestCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }

  let attempt = 0;
  let lastError: ParsedGSCError | undefined;

  while (attempt <= MAX_RETRIES) {
    attempt += 1;
    const encodedSiteUrl = encodeURIComponent(normalizedSiteUrl);
    const response = await fetch(`${GSC_API_BASE}/sites/${encodedSiteUrl}/searchAnalytics/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    let responseBody: GSCApiErrorPayload | GSCResponse | null = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    if (response.ok) {
      const data = (responseBody as GSCResponse) || {};
      gscRequestCache.set(cacheKey, { response: data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    }

    lastError = parseGSCError(response.status, responseBody as GSCApiErrorPayload, errorMessage);
    if (!lastError.retriable || attempt > MAX_RETRIES) {
      logGSCStructuredError(lastError, {
        siteUrl: normalizedSiteUrl,
        dimensions: body.dimensions,
        filters: body.dimensionFilterGroups ? body.dimensionFilterGroups.length : 0,
        dateRange: `${body.startDate}..${body.endDate}`,
        payloadSummary: {
          rowLimit: body.rowLimit,
          startRow: body.startRow,
          searchType: body.searchType,
        },
      });
      throw new Error(lastError.message);
    }

    const backoff = withJitter(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    await sleep(backoff);
  }

  throw new Error(lastError?.message || errorMessage);
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
  enableDateChunking?: boolean;
  dateChunkSizeDays?: number;
}

export const querySearchAnalyticsPaged = async (
  accessToken: string,
  params: QuerySearchAnalyticsPagedParams,
): Promise<GSCPagedSearchAnalyticsResponse> => {
  const {
    siteUrl,
    startDate,
    endDate,
    dimensions,
    searchType = DEFAULT_PAGED_SEARCH_TYPE,
    dimensionFilterGroups,
    rowLimit = DEFAULT_PAGED_ROW_LIMIT,
    startRow = 0,
    maxPages,
    maxRows,
    allowHighCardinality = false,
    enableDateChunking = true,
    dateChunkSizeDays,
  } = params;

  validateQueryInput(siteUrl, startDate, endDate, dimensions, dimensionFilterGroups);
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const allRows: GSCRow[] = [];
  let pagesFetched = 0;
  let currentStartRow = startRow;
  let truncatedReason: GSCPagedSearchAnalyticsResponse['metadata']['truncatedReason'];
  let activeDimensions = [...dimensions];
  let activeStartDate = startDate;
  let activeEndDate = endDate;

  const hasPage = dimensions.includes('page');
  const hasQuery = dimensions.includes('query');
  const dateRangeDays = daysBetween(startDate, endDate);
  const shouldChunkDates = enableDateChunking && dateRangeDays > 1;

  if (hasPage && hasQuery && !allowHighCardinality) {
    activeDimensions = dimensions.filter((dimension) => dimension !== 'query');
    truncatedReason = 'safety_stop';
    console.warn('GSC_FALLBACK_APPLIED', {
      reason: 'query_page_cross_join_disabled_by_default',
      siteUrl: normalizedSiteUrl,
      originalDimensions: dimensions,
      fallbackDimensions: activeDimensions,
      dateRange: `${startDate}..${endDate}`,
    });
  }

  const chunkWindowDays = dateChunkSizeDays
    || ((activeDimensions.includes('page') || activeDimensions.includes('query')) ? HIGH_CARDINALITY_DAILY_WINDOW_DAYS : STANDARD_WEEKLY_WINDOW_DAYS);
  const chunks = shouldChunkDates ? buildDateChunks(activeStartDate, activeEndDate, chunkWindowDays) : [{ startDate: activeStartDate, endDate: activeEndDate }];

  for (const chunk of chunks) {
    currentStartRow = startRow;
    while ((typeof maxPages !== 'number' || pagesFetched < maxPages) && (typeof maxRows !== 'number' || allRows.length < maxRows)) {
      const payload: GSCRequestPayload = {
        startDate: chunk.startDate,
        endDate: chunk.endDate,
        dimensions: activeDimensions,
        searchType,
        dimensionFilterGroups,
        rowLimit,
        startRow: currentStartRow,
      };
      const data: GSCResponse = await executeWithRateLimit(normalizedSiteUrl, () =>
        queryPageAnalytics(
          accessToken,
          normalizedSiteUrl,
          payload,
          'Error fetching paged analytics',
        ));
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

    if (truncatedReason === 'max_rows_reached') {
      break;
    }
  }

  if (!truncatedReason && typeof maxPages === 'number' && pagesFetched >= maxPages && allRows.length > 0) {
    truncatedReason = 'max_pages_reached';
  } else if (!truncatedReason && typeof maxRows === 'number' && allRows.length >= maxRows) {
    truncatedReason = 'max_rows_reached';
  }

  return {
    rows: allRows,
    metadata: {
      isPartial: Boolean(truncatedReason),
      pagesFetched,
      rowsFetched: allRows.length,
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
      maxPages: options?.maxPages,
      maxRows: options?.maxRows,
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

// Exportar función vacía para mantener compatibilidad si se importa pero ya no se usa
export const clearGSCRequestCache = () => {
  // No-op, cache is managed by React Query now
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
          searchType: DEFAULT_PAGED_SEARCH_TYPE,
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
          startRow: 0,
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
    dimensionFilterGroups?: GSCDimensionFilterGroup[];
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
    dimensionFilterGroups: options?.dimensionFilterGroups,
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
