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
const DEFAULT_PAGED_MAX_PAGES = 20;
const DEFAULT_PAGED_MAX_ROWS = 250000;
const DEFAULT_PAGED_SEARCH_TYPE: GSCSearchType = 'web';


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
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const response = await fetch(`${GSC_API_BASE}/sites/${encodedSiteUrl}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || errorMessage);
  }

  return await response.json();
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
    maxPages = DEFAULT_PAGED_MAX_PAGES,
    maxRows = DEFAULT_PAGED_MAX_ROWS,
  } = params;

  const allRows: GSCRow[] = [];
  let pagesFetched = 0;
  let currentStartRow = startRow;
  let truncatedReason: GSCPagedSearchAnalyticsResponse['metadata']['truncatedReason'];

  while (pagesFetched < maxPages && allRows.length < maxRows) {
    const data: GSCResponse = await queryPageAnalytics(
      accessToken,
      siteUrl,
      {
        startDate,
        endDate,
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

    const remaining = maxRows - allRows.length;
    if (pageRows.length > remaining) {
      allRows.push(...pageRows.slice(0, remaining));
      truncatedReason = 'max_rows_reached';
      break;
    }

    allRows.push(...pageRows);
    currentStartRow += pageRows.length;

    if (pageRows.length < rowLimit) {
      break;
    }
  }

  if (!truncatedReason && pagesFetched >= maxPages && allRows.length > 0) {
    truncatedReason = 'max_pages_reached';
  } else if (!truncatedReason && allRows.length >= maxRows) {
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
 * @param {number} rowLimit - Límite de filas (default 50).
 * @returns {Promise<Array<{keys: string[], clicks: number, impressions: number, ctr: number, position: number}>>}
 */
export const getPageQueries = async (
  accessToken: string,
  siteUrl: string,
  pageUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number = 50,
) => {
  try {
    for (const variant of buildPageUrlVariants(pageUrl)) {
      const data = await queryPageAnalytics(
        accessToken,
        siteUrl,
        {
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
        },
        'Error fetching page queries',
      );

      if (data.rows?.length) {
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
) =>
  querySearchAnalyticsPaged(accessToken, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ['page', 'date'],
    rowLimit,
    searchType,
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
