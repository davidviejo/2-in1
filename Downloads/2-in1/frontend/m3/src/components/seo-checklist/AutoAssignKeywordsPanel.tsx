import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CHECKLIST_POINTS, ChecklistItem, ChecklistKey, SeoPage } from '../../types/seoChecklist';
import { normalizeSeoUrl } from '../../utils/seoUrlNormalizer';
import { querySearchAnalyticsPaged } from '../../services/googleSearchConsole';
import {
  getCachedUrlKeywordEntry,
  getLatestGscUrlKeywordCache,
} from '../../services/gscUrlKeywordCache';
import { useSeoChecklistSettings } from '../../hooks/useSeoChecklistSettings';
import { isBrandTermMatch } from '../../utils/brandTerms';

type KeywordSourceMode = 'all' | 'with_gsc' | 'without_kw';

interface KeywordProposal {
  id: string;
  url: string;
  currentKeyword: string;
  proposedKeyword: string;
  confidence: 'alta' | 'media' | 'baja';
  reason: string;
  gscClicks: number;
  gscImpressions: number;
}

interface AnalysisDebugSnapshot {
  selectedPropertyInput: string;
  selectedPropertyUsed: string;
  targetUrls: string[];
  liveQueriedUrls: string[];
  updatedUrls: string[];
  newlyDetectedUrls: string[];
  rawQueryPageRows: number;
  appliedFromCacheCount: number;
  propertyVariantsTried: string[];
}

interface RawQueryPageRow {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position?: number;
}

interface Props {
  pages: SeoPage[];
  onBulkUpdate: (updates: { id: string; changes: Partial<SeoPage> }[]) => void;
  onAddPages: (pages: SeoPage[]) => void;
}

const GSC_BULK_ROW_LIMIT = 25_000;
// Para proyectos grandes: aumentamos el límite total paginado para capturar más queries
// y mejorar la probabilidad de recuperar la KW principal por URL.
const GSC_BULK_MAX_ROWS = 300_000;

const normalizeUrlCandidate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') || '/' : '/';
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }
};

const buildUrlCandidates = (url: string) => {
  const normalized = normalizeUrlCandidate(url);
  if (!normalized) return [];
  return [normalized, `${normalized}/`];
};

const toCanonicalUrlKey = (url: string) => {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const normalizedPath = parsed.pathname.toLowerCase();
    const path = normalizedPath !== '/' ? normalizedPath.replace(/\/+$/, '') || '/' : '/';
    return `${host}${path}`;
  } catch {
    return normalizeUrlCandidate(trimmed).toLowerCase();
  }
};

const normalizeSiteHost = (siteUrl: string) => {
  const trimmed = (siteUrl || '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('sc-domain:')) {
    return trimmed.replace('sc-domain:', '').replace(/^www\./, '');
  }
  try {
    return new URL(trimmed).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const doesUrlBelongToSite = (url: string, siteUrl: string) => {
  const siteHost = normalizeSiteHost(siteUrl);
  if (!siteHost) return true;
  try {
    const pageHost = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return pageHost === siteHost || pageHost.endsWith(`.${siteHost}`);
  } catch {
    return true;
  }
};

const isUsableKeyword = (value?: string) => {
  const normalized = (value || '').trim();
  return normalized.length > 0 && normalized !== '-';
};


const FRONTEND_ROUTE_BLOCKLIST = [
  '/app',
  '/dashboard',
  '/login',
  '/signup',
  '/register',
  '/admin',
  '/_next',
  '/static',
  '/assets',
];

const FRONTEND_ASSET_EXTENSIONS = /\.(js|mjs|cjs|css|map|json|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|pdf|txt|xml)$/i;

const shouldSkipFrontendUrlForAutoAssign = (rawUrl: string) => {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return true;

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.toLowerCase();

    if (parsed.hash && parsed.hash.includes('/')) return true;
    if (parsed.searchParams.has('utm_source') || parsed.searchParams.has('utm_campaign')) return true;
    if (FRONTEND_ASSET_EXTENSIONS.test(pathname)) return true;
    if (FRONTEND_ROUTE_BLOCKLIST.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/') )) return true;

    return false;
  } catch {
    const normalized = trimmed.toLowerCase();
    if (normalized.includes('#/')) return true;
    return FRONTEND_ASSET_EXTENSIONS.test(normalized);
  }
};
const isUrlLikeQuery = (value?: string) => {
  const query = (value || '').trim().toLowerCase();
  if (!query) return false;
  if (query.startsWith('http://') || query.startsWith('https://') || query.startsWith('www.')) {
    return true;
  }
  if (query.includes('/')) return true;
  if (query.includes('.') && !query.includes(' ')) return true;
  return false;
};

const getDimensionValue = (row: any, dimension: 'page' | 'query') => {
  const keys = Array.isArray(row?.keys) ? row.keys : [];
  const dimensions = Array.isArray(row?.dimensions) ? row.dimensions : [];
  const dimensionIndex = dimensions.findIndex((item) => String(item).toLowerCase() === dimension);
  if (dimensionIndex >= 0 && typeof keys[dimensionIndex] === 'string') {
    return String(keys[dimensionIndex] || '').trim();
  }
  if (typeof row?.[dimension] === 'string') {
    return row[dimension].trim();
  }
  if (keys.length >= 2) {
    const first = typeof keys[0] === 'string' ? keys[0].trim() : '';
    const second = typeof keys[1] === 'string' ? keys[1].trim() : '';
    const firstLooksLikeUrl = /^https?:\/\//i.test(first);
    const secondLooksLikeUrl = /^https?:\/\//i.test(second);

    if (dimension === 'query') {
      if (firstLooksLikeUrl && !secondLooksLikeUrl) return second;
      if (secondLooksLikeUrl && !firstLooksLikeUrl) return first;
    }

    if (dimension === 'page') {
      if (firstLooksLikeUrl) return first;
      if (secondLooksLikeUrl) return second;
    }
  }
  if (dimension === 'query') {
    const nonUrlCandidate = keys.find((key: any) => typeof key === 'string' && !/^https?:\/\//i.test(key));
    if (typeof nonUrlCandidate === 'string') return nonUrlCandidate.trim();
    if (typeof keys[1] === 'string') return String(keys[1] || '').trim();
    if (typeof keys[0] === 'string') return String(keys[0] || '').trim();
  }
  if (dimension === 'page') {
    const urlKeyCandidate = keys.find((key: any) => typeof key === 'string' && /^https?:\/\//i.test(key));
    if (typeof urlKeyCandidate === 'string') return urlKeyCandidate.trim();
  }
  return '';
};

const normalizeQueryRow = (row: any) => {
  const query = getDimensionValue(row, 'query');
  return {
    ...row,
    query,
    clicks: Number(row?.clicks || 0),
    impressions: Number(row?.impressions || 0),
    position: Number(row?.position || Number.POSITIVE_INFINITY),
  };
};

const normalizeAndPrioritizeQueries = (rows: any[], brandTerms: string[] = [], excludeBrand = false) => {
  const byKeyword = new Map<string, any>();

  rows
    .map((row) => normalizeQueryRow({ ...row, query: getDimensionValue(row, 'query') }))
    .filter((query) => isUsableKeyword(query.query))
    .filter((query) => !isUrlLikeQuery(query.query))
    .filter((query) => (excludeBrand ? !isBrandTermMatch(query.query, brandTerms) : true))
    .forEach((query) => {
      const keywordKey = query.query.trim().toLowerCase();
      const existing = byKeyword.get(keywordKey);
      if (!existing) {
        byKeyword.set(keywordKey, query);
        return;
      }

      if (
        query.impressions > existing.impressions ||
        (query.impressions === existing.impressions && query.clicks > existing.clicks)
      ) {
        byKeyword.set(keywordKey, query);
      }
    });

  return Array.from(byKeyword.values()).sort((a, b) => {
    if (b.impressions !== a.impressions) return b.impressions - a.impressions;
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    return 0;
  });
};


export const getKeywordCandidatesFromPage = (page: SeoPage) => {
  const rawQueries = page.checklist.OPORTUNIDADES?.autoData?.gscQueries;
  if (!Array.isArray(rawQueries) || rawQueries.length === 0) {
    return [];
  }

  return rawQueries
    .map(normalizeQueryRow)
    .filter((query: any) => isUsableKeyword(query.query))
    .filter((query: any) => !isUrlLikeQuery(query.query))
    .sort((a: any, b: any) => {
      if (b.impressions !== a.impressions) return b.impressions - a.impressions;
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      return 0;
    });
};

export const getBestKeywordFromPage = (page: SeoPage, blockedKeywords: Set<string>) => {
  const candidates = getKeywordCandidatesFromPage(page);
  const bestUnblocked = candidates.find(
    (candidate: any) => !blockedKeywords.has(candidate.query.trim().toLowerCase()),
  );
  const bestBlockedFallback = candidates[0];
  const best = bestUnblocked || bestBlockedFallback || null;
  if (!best) return null;

  return {
    keyword: best.query.trim(),
    clicks: best.clicks,
    impressions: best.impressions,
    isBlockedFallback: !bestUnblocked,
  };
};

export const buildKeywordProposals = (
  pages: SeoPage[],
  sourceMode: KeywordSourceMode,
  brandTerms: string[] = [],
): KeywordProposal[] => {
  const candidatesByPage = new Map<string, ReturnType<typeof getKeywordCandidatesFromPage>>();
  pages.forEach((page) => {
    candidatesByPage.set(page.id, getKeywordCandidatesFromPage(page));
  });

  const keywordOwners = new Map<string, { pageId: string; impressions: number; clicks: number }>();
  pages.forEach((page) => {
    const candidates = candidatesByPage.get(page.id) || [];
    candidates.forEach((candidate: any) => {
      const keyword = candidate.query.trim().toLowerCase();
      if (!keyword || isBrandTermMatch(candidate.query, brandTerms)) return;

      const currentOwner = keywordOwners.get(keyword);
      if (
        !currentOwner ||
        candidate.impressions > currentOwner.impressions ||
        (candidate.impressions === currentOwner.impressions && candidate.clicks > currentOwner.clicks)
      ) {
        keywordOwners.set(keyword, {
          pageId: page.id,
          impressions: candidate.impressions,
          clicks: candidate.clicks,
        });
      }
    });
  });

  return pages
    .filter((page) => {
      if (sourceMode === 'with_gsc') {
        return (page.gscMetrics?.queryCount || 0) > 0;
      }
      if (sourceMode === 'without_kw') {
        return !isUsableKeyword(page.kwPrincipal);
      }
      return true;
    })
    .map((page) => {
      const currentKeyword = (page.kwPrincipal || '').trim();
      const ownedCandidates = (candidatesByPage.get(page.id) || []).filter((candidate: any) => {
        const keyword = candidate.query.trim().toLowerCase();
        return keywordOwners.get(keyword)?.pageId === page.id;
      });
      const bestOwned = ownedCandidates[0];
      const suggestion = bestOwned
        ? {
            keyword: bestOwned.query.trim(),
            clicks: bestOwned.clicks,
            impressions: bestOwned.impressions,
            isBlockedFallback: false,
          }
        : null;
      const isBrandPage = Boolean(page.isBrandKeyword || isBrandTermMatch(currentKeyword, brandTerms));

      if (isBrandPage) {
        return {
          id: page.id,
          url: page.url,
          currentKeyword,
          proposedKeyword: '',
          confidence: 'baja' as const,
          reason: 'URL marcada como keyword de marca; se omite autoasignación.',
          gscClicks: 0,
          gscImpressions: 0,
        };
      }

      if (!suggestion) {
        const fallbackReason =
          page.checklist.OPORTUNIDADES?.autoData?.gscQueryFallbackReason ||
          'Sin queries GSC válidas para proponer una KW principal.';
        return {
          id: page.id,
          url: page.url,
          currentKeyword,
          proposedKeyword: '',
          confidence: 'baja' as const,
          reason: fallbackReason,
          gscClicks: 0,
          gscImpressions: 0,
        };
      }

      if (isBrandTermMatch(suggestion.keyword, brandTerms)) {
        return {
          id: page.id,
          url: page.url,
          currentKeyword,
          proposedKeyword: '',
          confidence: 'baja' as const,
          reason: 'La mejor query detectada es de marca; no se propone como KW principal.',
          gscClicks: suggestion.clicks,
          gscImpressions: suggestion.impressions,
        };
      }

      const confidence: KeywordProposal['confidence'] =
        suggestion.clicks >= 10 || suggestion.impressions >= 200
          ? 'alta'
          : suggestion.clicks >= 3 || suggestion.impressions >= 75
            ? 'media'
            : 'baja';

      const proposal: KeywordProposal = {
        id: page.id,
        url: page.url,
        currentKeyword,
        proposedKeyword: suggestion.keyword,
        confidence,
        reason:
          page.checklist.OPORTUNIDADES?.autoData?.gscQueryFallbackReason ||
          (currentKeyword.toLowerCase() === suggestion.keyword.toLowerCase()
            ? 'La keyword actual ya coincide con la mejor query de GSC.'
            : 'Keyword sugerida desde la mejor query propietaria por URL (impresiones y luego clics), sin duplicar entre URLs.'),
        gscClicks: suggestion.clicks,
        gscImpressions: suggestion.impressions,
      };

      return proposal;
    });
};

export const AutoAssignKeywordsPanel: React.FC<Props> = ({ pages, onBulkUpdate, onAddPages }) => {
  const [sourceMode, setSourceMode] = useState<KeywordSourceMode>('without_kw');
  const [status, setStatus] = useState('');
  const [isLoadingGsc, setIsLoadingGsc] = useState(false);
  const [reuseDashboardData, setReuseDashboardData] = useState(true);
  const [selectedSite, setSelectedSite] = useState(
    () => localStorage.getItem('mediaflow_gsc_selected_site') || '',
  );
  const [outsidePropertyUrls, setOutsidePropertyUrls] = useState<
    { originalUrl: string; parsedHost: string; normalizedSiteHost: string }[]
  >([]);
  const [gscDiscoveredUrls, setGscDiscoveredUrls] = useState<SeoPage[]>([]);
  const [debugSnapshot, setDebugSnapshot] = useState<AnalysisDebugSnapshot | null>(null);
  const [showDebugSnapshot, setShowDebugSnapshot] = useState(false);
  const [rawQueryPageRowsSnapshot, setRawQueryPageRowsSnapshot] = useState<RawQueryPageRow[]>([]);
  const { settings } = useSeoChecklistSettings();
  const activeBrandTerms = useMemo(() => settings.brandTerms || [], [settings.brandTerms]);

  const proposals = useMemo<KeywordProposal[]>(() => {
    return buildKeywordProposals(pages, sourceMode, activeBrandTerms);
  }, [activeBrandTerms, pages, sourceMode]);
  const actionableProposalsCount = proposals.filter((proposal) => proposal.proposedKeyword).length;
  const discoveredUrlCount = gscDiscoveredUrls.length;

  const createSeoPageId = (): string => {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `seo-page-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const createEmptyChecklist = (): Record<ChecklistKey, ChecklistItem> =>
    CHECKLIST_POINTS.reduce(
      (acc, pt) => {
        acc[pt.key] = { key: pt.key, label: pt.label, status_manual: 'NA', notes_manual: '' };
        return acc;
      },
      {} as Record<ChecklistKey, ChecklistItem>,
    );

  const loadGscData = async () => {
    const latestRememberedSite = (localStorage.getItem('mediaflow_gsc_selected_site') || '').trim();
    const site = (latestRememberedSite || selectedSite).trim();

    if (site !== selectedSite.trim()) {
      setSelectedSite(site);
    }
    const token = localStorage.getItem('mediaflow_gsc_token');

    if (!site) {
      setStatus(
        'Primero selecciona una propiedad en Dashboard para reutilizar o cargar queries.',
      );
      return;
    }

    const targetPages = pages.filter((page) => {
      if (sourceMode === 'with_gsc') return true;
      if (sourceMode === 'without_kw') return !isUsableKeyword(page.kwPrincipal);
      return true;
    });

    const pagesOutsideSelectedProperty = targetPages.filter((page) => !doesUrlBelongToSite(page.url, site));
    const normalizedSiteHost = normalizeSiteHost(site) || '-';
    const detectedOutsidePropertyUrls = pagesOutsideSelectedProperty.map((page) => {
      let parsedHost = 'No se pudo parsear';
      try {
        parsedHost = new URL(page.url).hostname.replace(/^www\./i, '').toLowerCase();
      } catch {
        // mantenemos fallback descriptivo para la UI
      }

      return {
        originalUrl: page.url,
        parsedHost,
        normalizedSiteHost,
      };
    });

    setOutsidePropertyUrls(detectedOutsidePropertyUrls);

    if (targetPages.length === 0) {
      setStatus('No hay URLs para consultar GSC con el filtro actual.');
      return;
    }

    const cachedSnapshot = reuseDashboardData ? getLatestGscUrlKeywordCache(site) : null;
    const hasReusableCacheForTargets =
      reuseDashboardData &&
      targetPages.some((page) => Boolean(getCachedUrlKeywordEntry(cachedSnapshot, page.url)));

    if (!hasReusableCacheForTargets && !token) {
      setStatus(
        '⚠️ Sin token GSC activo y sin caché reutilizable; conecta GSC en Dashboard y vuelve a intentar.',
      );
      return;
    }

    setIsLoadingGsc(true);
    setStatus(`Cargando datos GSC para ${targetPages.length} URL(s)...`);
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let okCount = 0;
    let reusedCount = 0;
    let fetchedCount = 0;
    let missingTokenCount = 0;
    const updates: { id: string; changes: Partial<SeoPage> }[] = [];
    const pagesToFetchLive: SeoPage[] = [];
    const updatedUrls = new Set<string>();
    let rawQueryPageRows = 0;
    const rawRowsForSnapshot: RawQueryPageRow[] = [];

    for (const page of targetPages) {
      const cachedEntry = getCachedUrlKeywordEntry(cachedSnapshot, page.url);
      if (cachedEntry) {
        reusedCount += 1;
        okCount += 1;
        updates.push({
          id: page.id,
          changes: {
            gscMetrics: {
              clicks: Number(cachedEntry.metrics.clicks || 0),
              impressions: Number(cachedEntry.metrics.impressions || 0),
              ctr: Number(cachedEntry.metrics.ctr || 0),
              position: Number(cachedEntry.metrics.position || 0) || undefined,
              queryCount: Number(cachedEntry.metrics.queryCount || 0),
              source: 'page',
              updatedAt: Date.now(),
            },
            checklist: {
              ...page.checklist,
              OPORTUNIDADES: {
                ...page.checklist.OPORTUNIDADES,
                autoData: {
                  ...(page.checklist.OPORTUNIDADES?.autoData || {}),
                  gscQueries: cachedEntry.queries.map(normalizeQueryRow),
                },
              },
            },
          },
        });
        updatedUrls.add(page.url);
        continue;
      }

      pagesToFetchLive.push(page);

      if (!token) {
        missingTokenCount += 1;
      }
    }

    const discoveredByUrl = new Map<string, SeoPage>();
    if (token && pagesToFetchLive.length > 0) {
      try {
        const bulkResponse = await querySearchAnalyticsPaged(token, {
          siteUrl: site,
          startDate: start,
          endDate: end,
          dimensions: ['query', 'page'],
          rowLimit: GSC_BULK_ROW_LIMIT,
          maxRows: GSC_BULK_MAX_ROWS,
          searchType: 'web',
        });
        const bulkRows = Array.isArray(bulkResponse.rows) ? bulkResponse.rows : [];
        rawQueryPageRows = bulkRows.length;
        for (const row of bulkRows) {
          const pageValue = normalizeUrlCandidate(getDimensionValue(row, 'page'));
          const queryValue = String(getDimensionValue(row, 'query') || '').trim();
          if (!pageValue || !queryValue) continue;
          rawRowsForSnapshot.push({
            page: pageValue,
            query: queryValue,
            clicks: Number(row.clicks || 0),
            impressions: Number(row.impressions || 0),
            ctr: Number(row.ctr || 0),
            position: Number(row.position || 0) || undefined,
          });
        }
        const rowsByUrl = new Map<string, any[]>();
        const rowsByCanonicalUrl = new Map<string, any[]>();
        const globalTopQueryRows = normalizeAndPrioritizeQueries(bulkRows).slice(0, 20);

        for (const row of bulkRows) {
          const rowUrl = normalizeUrlCandidate(getDimensionValue(row, 'page'));
          if (!rowUrl || shouldSkipFrontendUrlForAutoAssign(rowUrl)) continue;

          for (const rowUrlCandidate of buildUrlCandidates(rowUrl)) {
            const bucket = rowsByUrl.get(rowUrlCandidate);
            if (bucket) {
              bucket.push(row);
            } else {
              rowsByUrl.set(rowUrlCandidate, [row]);
            }
          }

          const canonicalRowUrl = toCanonicalUrlKey(rowUrl);
          if (!canonicalRowUrl) continue;
          const canonicalBucket = rowsByCanonicalUrl.get(canonicalRowUrl);
          if (canonicalBucket) {
            canonicalBucket.push(row);
          } else {
            rowsByCanonicalUrl.set(canonicalRowUrl, [row]);
          }
        }

        for (const page of pagesToFetchLive) {
          const pageCandidates = buildUrlCandidates(page.url);
          const exactPageRows = Array.from(
            new Set(pageCandidates.flatMap((candidate) => rowsByUrl.get(candidate) || [])),
          );
          const fallbackCanonicalRows =
            exactPageRows.length === 0
              ? rowsByCanonicalUrl.get(toCanonicalUrlKey(page.url)) || []
              : [];
          const pageRows = exactPageRows.length > 0 ? exactPageRows : fallbackCanonicalRows;
          const usesGlobalFallback = pageRows.length === 0;
          const normalizedQueries = normalizeAndPrioritizeQueries(pageRows);

          const diagnosticQueries =
            normalizedQueries.length > 0 ? normalizedQueries : usesGlobalFallback ? globalTopQueryRows : [];

          if (diagnosticQueries.length === 0) continue;

          const aggregated = diagnosticQueries.reduce(
            (acc, row) => {
              acc.clicks += Number(row.clicks || 0);
              acc.impressions += Number(row.impressions || 0);
              acc.weightedPosition += Number(row.position || 0) * Number(row.impressions || 0);
              return acc;
            },
            { clicks: 0, impressions: 0, weightedPosition: 0 },
          );
          const ctr = aggregated.impressions > 0 ? aggregated.clicks / aggregated.impressions : 0;
          const position =
            aggregated.impressions > 0
              ? aggregated.weightedPosition / aggregated.impressions
              : undefined;

          okCount += 1;
          fetchedCount += 1;
          updatedUrls.add(page.url);
          updates.push({
            id: page.id,
            changes: {
              gscMetrics: {
                clicks: aggregated.clicks,
                impressions: aggregated.impressions,
                ctr,
                position,
                queryCount: diagnosticQueries.length,
                source: 'page',
                updatedAt: Date.now(),
              },
              checklist: {
                ...page.checklist,
                OPORTUNIDADES: {
                  ...page.checklist.OPORTUNIDADES,
                  autoData: {
                    ...(page.checklist.OPORTUNIDADES?.autoData || {}),
                    gscQueries: diagnosticQueries,
                    gscQueryFallbackReason: usesGlobalFallback
                      ? 'Fallback global del sitio por falta de match URL↔query (exacto/canónico).'
                      : '',
                  },
                },
              },
            },
          });
        }

        const existingUrlKeys = new Set(
          pages
            .map((page) => {
              try {
                return normalizeSeoUrl(page.url).toLowerCase();
              } catch {
                return '';
              }
            })
            .filter(Boolean),
        );

        rowsByCanonicalUrl.forEach((canonicalRows) => {
          if (!canonicalRows.length) return;
          const discoveredUrl = normalizeUrlCandidate(getDimensionValue(canonicalRows[0], 'page'));
          if (!discoveredUrl || shouldSkipFrontendUrlForAutoAssign(discoveredUrl)) return;

          let discoveredUrlKey = '';
          try {
            discoveredUrlKey = normalizeSeoUrl(discoveredUrl).toLowerCase();
          } catch {
            return;
          }
          if (existingUrlKeys.has(discoveredUrlKey) || discoveredByUrl.has(discoveredUrlKey)) return;

          const normalizedQueries = normalizeAndPrioritizeQueries(canonicalRows, activeBrandTerms, true);
          const topQuery = normalizedQueries[0];
          if (!topQuery) return;

          discoveredByUrl.set(discoveredUrlKey, {
            id: createSeoPageId(),
            url: discoveredUrl,
            kwPrincipal: topQuery.query,
            originalKwPrincipal: topQuery.query,
            isBrandKeyword: false,
            pageType: 'Article',
            checklist: createEmptyChecklist(),
            gscMetrics: {
              clicks: Number(topQuery.clicks || 0),
              impressions: Number(topQuery.impressions || 0),
              ctr: Number(topQuery.ctr || 0),
              position: Number(topQuery.position || 0) || undefined,
              queryCount: normalizedQueries.length,
              source: 'page',
              updatedAt: Date.now(),
            },
          });
        });
      } catch (error) {
        console.warn('Fallo en carga masiva GSC. No se pudieron actualizar URLs sin caché.', error);
      }
    }
    setRawQueryPageRowsSnapshot(rawRowsForSnapshot);
    setGscDiscoveredUrls(Array.from(discoveredByUrl.values()));
    setDebugSnapshot({
      selectedPropertyInput: selectedSite.trim(),
      selectedPropertyUsed: site,
      targetUrls: targetPages.map((page) => page.url),
      liveQueriedUrls: pagesToFetchLive.map((page) => page.url),
      updatedUrls: Array.from(updatedUrls.values()),
      newlyDetectedUrls: Array.from(discoveredByUrl.values()).map((entry) => entry.url),
      rawQueryPageRows,
      appliedFromCacheCount: reusedCount,
      propertyVariantsTried: Array.from(
        new Set([selectedSite.trim(), latestRememberedSite, site].filter(Boolean)),
      ),
    });

    if (updates.length > 0) {
      onBulkUpdate(updates);
    }

    const reusedText =
      reusedCount > 0
        ? ` ${reusedCount} URL(s) reutilizadas desde datos ya recopilados en Dashboard.`
        : '';
    const fetchedText =
      fetchedCount > 0 ? ` ${fetchedCount} URL(s) consultadas de nuevo en GSC.` : '';
    const missingTokenText =
      missingTokenCount > 0
        ? ` ${missingTokenCount} URL(s) sin actualizar por falta de token GSC para consulta en vivo.`
        : '';

    const outsidePropertyText =
      pagesOutsideSelectedProperty.length > 0
        ? ` ${pagesOutsideSelectedProperty.length} URL(s) parecen ser de otro dominio distinto a la propiedad seleccionada (${site}): ${detectedOutsidePropertyUrls
            .map((entry) => entry.originalUrl)
            .join(', ')}.`
        : '';

    setStatus(
      `Carga finalizada: ${okCount} URL(s) con datos actualizados.${reusedText}${fetchedText}${missingTokenText}${outsidePropertyText}`,
    );
    setIsLoadingGsc(false);
  };

  const includeDiscoveredUrls = () => {
    if (gscDiscoveredUrls.length === 0) {
      setStatus('No hay nuevas URLs detectadas desde GSC para añadir.');
      return;
    }
    onAddPages(gscDiscoveredUrls);
    setStatus(`Se añadieron ${gscDiscoveredUrls.length} URL(s) nuevas detectadas en GSC al checklist.`);
    setGscDiscoveredUrls([]);
  };

  const applyKeywordAssignments = () => {
    const updates = proposals
      .filter(
        (proposal) =>
          proposal.proposedKeyword &&
          proposal.proposedKeyword.toLowerCase() !== proposal.currentKeyword.toLowerCase(),
      )
      .map((proposal) => ({
        id: proposal.id,
        changes: {
          kwPrincipal: proposal.proposedKeyword,
          isBrandKeyword: false,
        },
      }));

    if (updates.length === 0) {
      setStatus('No hay cambios para aplicar: todas las keywords ya estaban asignadas.');
      return;
    }

    onBulkUpdate(updates);
    setStatus(`Autoasignación aplicada: ${updates.length} URLs actualizadas con nueva KW principal.`);
  };

  const escapeCsvCell = (value: string | number | undefined) => {
    const normalized = String(value ?? '');
    if (normalized.includes('"') || normalized.includes(',') || normalized.includes('\n')) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  };

  const downloadRawQueryPageRowsCsv = () => {
    if (!rawQueryPageRowsSnapshot.length) return;
    const header = ['page', 'query', 'clicks', 'impressions', 'ctr', 'position'];
    const lines = rawQueryPageRowsSnapshot.map((row) =>
      [
        escapeCsvCell(row.page),
        escapeCsvCell(row.query),
        escapeCsvCell(row.clicks),
        escapeCsvCell(row.impressions),
        escapeCsvCell(row.ctr),
        escapeCsvCell(row.position ?? ''),
      ].join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `gsc-query-page-rows-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Autoasignación de KWs</h2>
        <p className="text-sm text-slate-600">
          Propone y asigna solo keywords principales usando las queries disponibles de GSC.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Fuente</label>
          <select
            value={sourceMode}
            onChange={(event) => setSourceMode(event.target.value as KeywordSourceMode)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="without_kw">Solo URLs sin KW principal</option>
            <option value="with_gsc">Solo URLs con datos de GSC</option>
            <option value="all">Todas las URLs</option>
          </select>
        </div>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={reuseDashboardData}
            onChange={(event) => setReuseDashboardData(event.target.checked)}
          />
          Reutilizar datos ya recopilados en Dashboard (si existen)
        </label>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-slate-700">Propiedad GSC a usar</label>
          <input
            type="text"
            value={selectedSite}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSelectedSite(nextValue);
              localStorage.setItem('mediaflow_gsc_selected_site', nextValue.trim());
            }}
            placeholder="sc-domain:midominio.com o https://www.midominio.com/"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Este campo controla desde qué propiedad se cargan las queries para Autoasignar KWs.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={loadGscData} disabled={isLoadingGsc}>
          {isLoadingGsc ? 'Cargando datos GSC...' : 'Cargar URLs/queries desde GSC'}
        </Button>
        <Button
          variant="secondary"
          onClick={applyKeywordAssignments}
          disabled={actionableProposalsCount === 0}
        >
          Aprobar y pasar a Análisis SEO y Clusters
        </Button>
        <Button variant="secondary" onClick={includeDiscoveredUrls} disabled={discoveredUrlCount === 0}>
          Añadir URLs detectadas ({discoveredUrlCount})
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowDebugSnapshot((prev) => !prev)}
          disabled={!debugSnapshot}
        >
          {showDebugSnapshot ? 'Ocultar datos de referencia' : 'Ver datos de referencia'}
        </Button>
      </div>

      {status && <p className="text-sm text-slate-600">{status}</p>}

      {showDebugSnapshot && debugSnapshot && (
        <details className="rounded-lg border border-sky-200 bg-sky-50/40 p-3" open>
          <summary className="cursor-pointer text-sm font-semibold text-sky-800">
            Snapshot de referencia del análisis
          </summary>
          <div className="mt-2 space-y-2 text-xs text-slate-700">
            <p>
              <strong>Propiedad introducida:</strong> {debugSnapshot.selectedPropertyInput || '-'}
            </p>
            <p>
              <strong>Propiedad usada:</strong> {debugSnapshot.selectedPropertyUsed || '-'}
            </p>
            <p>
              <strong>Variantes probadas:</strong>{' '}
              {debugSnapshot.propertyVariantsTried.join(' · ') || '-'}
            </p>
            <p>
              <strong>Filas crudas query+page (estimación):</strong> {debugSnapshot.rawQueryPageRows}
            </p>
            {rawQueryPageRowsSnapshot.length > 0 && (
              <div className="rounded-md border border-sky-200 bg-white p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-700">
                    <strong>Filas crudas guardadas:</strong> {rawQueryPageRowsSnapshot.length}
                  </p>
                  <Button variant="secondary" onClick={downloadRawQueryPageRowsCsv}>
                    Descargar filas crudas (CSV)
                  </Button>
                </div>
                <div className="max-h-64 overflow-auto rounded border border-slate-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-2 py-1">page</th>
                        <th className="px-2 py-1">query</th>
                        <th className="px-2 py-1">clicks</th>
                        <th className="px-2 py-1">impressions</th>
                        <th className="px-2 py-1">ctr</th>
                        <th className="px-2 py-1">position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawQueryPageRowsSnapshot.slice(0, 200).map((row, index) => (
                        <tr key={`${row.page}-${row.query}-${index}`} className="border-t border-slate-100">
                          <td className="px-2 py-1 text-slate-700">{row.page}</td>
                          <td className="px-2 py-1 text-slate-700">{row.query}</td>
                          <td className="px-2 py-1 text-slate-700">{row.clicks}</td>
                          <td className="px-2 py-1 text-slate-700">{row.impressions}</td>
                          <td className="px-2 py-1 text-slate-700">{row.ctr}</td>
                          <td className="px-2 py-1 text-slate-700">{row.position ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rawQueryPageRowsSnapshot.length > 200 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Mostrando primeras 200 filas. Descarga el CSV para el dataset completo.
                  </p>
                )}
              </div>
            )}
            <p>
              <strong>URLs objetivo checklist:</strong> {debugSnapshot.targetUrls.length}
            </p>
            <p>
              <strong>URLs consultadas en vivo:</strong> {debugSnapshot.liveQueriedUrls.length}
            </p>
            <p>
              <strong>URLs actualizadas:</strong> {debugSnapshot.updatedUrls.length}
            </p>
            <p>
              <strong>URLs nuevas detectadas:</strong> {debugSnapshot.newlyDetectedUrls.length}
            </p>
          </div>
        </details>
      )}

      {outsidePropertyUrls.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-amber-800">
            URLs fuera de propiedad detectadas ({outsidePropertyUrls.length})
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-amber-900">
                <tr>
                  <th className="px-2 py-1">URL original</th>
                  <th className="px-2 py-1">Host parseado</th>
                  <th className="px-2 py-1">Host normalizado de propiedad</th>
                </tr>
              </thead>
              <tbody>
                {outsidePropertyUrls.map((entry) => (
                  <tr key={`${entry.originalUrl}-${entry.parsedHost}`} className="border-t border-amber-200">
                    <td className="px-2 py-1 text-slate-700">{entry.originalUrl}</td>
                    <td className="px-2 py-1 text-slate-700">{entry.parsedHost}</td>
                    <td className="px-2 py-1 text-slate-700">{entry.normalizedSiteHost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {gscDiscoveredUrls.length > 0 && (
        <details className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3" open>
          <summary className="cursor-pointer text-sm font-semibold text-emerald-800">
            Nuevas URLs detectadas en GSC listas para incluir ({gscDiscoveredUrls.length})
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-emerald-900">
                <tr>
                  <th className="px-2 py-1">URL</th>
                  <th className="px-2 py-1">KW principal sugerida</th>
                  <th className="px-2 py-1">Clics</th>
                  <th className="px-2 py-1">Impresiones</th>
                </tr>
              </thead>
              <tbody>
                {gscDiscoveredUrls.map((entry) => (
                  <tr key={entry.id} className="border-t border-emerald-200">
                    <td className="px-2 py-1 text-slate-700">{entry.url}</td>
                    <td className="px-2 py-1 text-slate-700">{entry.kwPrincipal}</td>
                    <td className="px-2 py-1 text-slate-700">{entry.gscMetrics?.clicks || 0}</td>
                    <td className="px-2 py-1 text-slate-700">{entry.gscMetrics?.impressions || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">KW actual</th>
              <th className="px-3 py-2">KW propuesta</th>
              <th className="px-3 py-2">Confianza</th>
              <th className="px-3 py-2">Datos GSC</th>
              <th className="px-3 py-2">Justificación</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((proposal) => (
              <tr key={proposal.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs text-slate-700">{proposal.url}</td>
                <td className="px-3 py-2 text-slate-600">{proposal.currentKeyword || '-'}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{proposal.proposedKeyword}</td>
                <td className="px-3 py-2 capitalize text-slate-600">{proposal.confidence}</td>
                <td className="px-3 py-2 text-slate-600">
                  {proposal.gscClicks} clics / {proposal.gscImpressions} imp.
                </td>
                <td className="px-3 py-2 text-slate-600">{proposal.reason}</td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No hay propuestas de keyword con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
