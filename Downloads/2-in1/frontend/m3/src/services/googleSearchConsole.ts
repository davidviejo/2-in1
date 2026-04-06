// Servicio para interactuar con la API de Google Search Console
// Requiere un Token de Acceso obtenido vía OAuth 2.0 (Implicit Flow)

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';
const USER_INFO_API = 'https://www.googleapis.com/oauth2/v2/userinfo';


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
    // Codificar la URL del sitio (ej: https://example.com -> https%3A%2F%2Fexample.com)
    const encodedSiteUrl = encodeURIComponent(siteUrl);

    const body = {
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: 30,
    };

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
      throw new Error(err.error?.message || 'Error fetching analytics');
    }

    const data = await response.json();
    return data.rows || [];
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
) => {
  try {
    const encodedSiteUrl = encodeURIComponent(siteUrl);

    const body = {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit,
    };

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
      throw new Error(err.error?.message || 'Error fetching query analytics');
    }

    const data = await response.json();
    return data.rows || [];
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
) => {
  try {
    const encodedSiteUrl = encodeURIComponent(siteUrl);

    const body = {
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit,
    };

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
      throw new Error(err.error?.message || 'Error fetching query/page analytics');
    }

    const data = await response.json();
    return data.rows || [];
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
