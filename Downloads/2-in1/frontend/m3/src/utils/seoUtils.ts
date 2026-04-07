import {
  SeoPage,
  ChecklistKey,
  AnalysisConfigPayload,
  SeoChecklistSettings,
} from '../types/seoChecklist';
import { analyzeUrl, AnalysisResponse, ENGINE_ANALYZE_TIMEOUT_MS } from '../services/pythonEngineClient';
import { getPageMetrics, getPageQueries } from '../services/googleSearchConsole';
import { normalizeSeoPageInput } from './seoUrlNormalizer';
import { isBrandTermMatch } from './brandTerms';
import { ClientRepository } from '../services/clientRepository';

const normalizeGscQueryRow = (row: any) => {
  const query = row?.query || row?.keys?.[0] || '';
  return {
    ...row,
    query,
    keys: Array.isArray(row?.keys) ? row.keys : query ? [query] : [],
  };
};

const getStoredSeoChecklistSettings = (): SeoChecklistSettings | null => {
  const currentClientId = ClientRepository.getCurrentClientId();
  if (!currentClientId) return null;
  const settingsKey = `mediaflow_seo_settings_${currentClientId}`;
  try {
    const raw = localStorage.getItem(settingsKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed as SeoChecklistSettings;
  } catch (error) {
    console.warn('Could not parse SEO checklist settings', error);
    return null;
  }
};

const isUsablePrimaryKeyword = (keyword?: string) => {
  const normalized = (keyword || '').trim();
  return normalized.length > 0 && normalized !== '-';
};

const pickPrimaryKeywordFromQueries = (gscQueries: any[] = [], brandTerms: string[] = []) => {
  const sortedQueries = [...gscQueries]
    .map(normalizeGscQueryRow)
    .filter((row) => isUsablePrimaryKeyword(row.query))
    .filter((row) => !isBrandTermMatch(row.query, brandTerms))
    .sort((a, b) => {
      if ((b.clicks || 0) !== (a.clicks || 0)) {
        return (b.clicks || 0) - (a.clicks || 0);
      }
      if ((b.impressions || 0) !== (a.impressions || 0)) {
        return (b.impressions || 0) - (a.impressions || 0);
      }
      return (a.position || Number.POSITIVE_INFINITY) - (b.position || Number.POSITIVE_INFINITY);
    });

  return sortedQueries[0]?.query?.trim() || '';
};

const buildDefaultAnalysisConfig = (
  settings?: SeoChecklistSettings | null,
): AnalysisConfigPayload => {
  const parsed = settings || getStoredSeoChecklistSettings();

  const serp = parsed?.serp || {};
  const budgets = parsed?.budgets || {};
  const mode: 'basic' | 'advanced' = serp.enabled ? 'advanced' : 'basic';

  return {
    mode,
    serp: {
      enabled: Boolean(serp.enabled),
      provider: serp.provider || 'dataforseo',
      maxKeywordsPerUrl: serp.maxKeywordsPerUrl || 10,
      maxCompetitorsPerKeyword: serp.maxCompetitorsPerKeyword || 3,
      dataforseoLogin: serp.dataforseoLogin || '',
      dataforseoPassword: serp.dataforseoPassword || '',
      dataforseoDetail: serp.dataforseoDetail || 'advanced',
      dataforseoExecutionMode: serp.dataforseoExecutionMode || 'live',
      confirmed: Boolean(serp.enabled),
    },
    budgets: {
      maxEstimatedCostPerBatch: budgets.maxEstimatedCostPerBatch || 5,
      dailyBudget: budgets.dailyBudget || 10,
    },
  };
};

export const buildGscMetricsFromQueries = (gscQueries: any[] = []) => {
  if (!Array.isArray(gscQueries) || gscQueries.length === 0) return undefined;

  const normalizedQueries = gscQueries.map(normalizeGscQueryRow);

  const clicks = normalizedQueries.reduce((sum, row) => sum + (row?.clicks || 0), 0);
  const impressions = normalizedQueries.reduce((sum, row) => sum + (row?.impressions || 0), 0);
  const weightedPosition = normalizedQueries.reduce(
    (sum, row) => sum + (row?.position || 0) * (row?.impressions || 0),
    0,
  );

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : undefined,
    queryCount: normalizedQueries.length,
    source: 'query' as const,
    updatedAt: Date.now(),
  };
};

export const processAnalysisResult = (
  page: SeoPage,
  result: AnalysisResponse,
  gscQueries: any[] = [],
  gscMetrics?: SeoPage['gscMetrics'],
  processingSettings: {
    brandTerms?: string[];
    allowKwPrincipalUpdate?: boolean;
  } = {},
): Partial<SeoPage> => {
  const brandTerms = Array.isArray(processingSettings.brandTerms)
    ? processingSettings.brandTerms
    : [];
  const allowKwPrincipalUpdate = processingSettings.allowKwPrincipalUpdate !== false;

  // FIX: Sync LocalBusiness from DATOS_ESTRUCTURADOS to GEOLOCALIZACION
  // If structured data sees LocalBusiness, GEOLOCALIZACION should also reflect it.
  if (result.items) {
    const structData = result.items.DATOS_ESTRUCTURADOS?.autoData;
    if (structData?.schemasParsed && Array.isArray(structData.schemasParsed)) {
      const hasLocalBusiness = structData.schemasParsed.some((s: any) => {
        if (typeof s === 'string') return s.includes('LocalBusiness');
        if (typeof s === 'object' && s !== null && s['@type']) {
          const type = s['@type'];
          if (typeof type === 'string') {
            return type.includes('LocalBusiness');
          }
          if (Array.isArray(type)) {
            return type.some((t: any) => typeof t === 'string' && t.includes('LocalBusiness'));
          }
        }
        return false;
      });

      if (hasLocalBusiness) {
        if (!result.items.GEOLOCALIZACION) {
          result.items.GEOLOCALIZACION = {};
        }
        if (!result.items.GEOLOCALIZACION.autoData) {
          result.items.GEOLOCALIZACION.autoData = {};
        }
        result.items.GEOLOCALIZACION.autoData.localBusiness = true;
      }
    }
  }

  // Inject GSC Data into OPORTUNIDADES if provided and not already present in result
  // If the result came from a batch job that already included GSC data, we might want to skip this,
  // but usually gscQueries here are passed from the client or empty.
  // If result already has it, we should probably respect it, but the original code overwrote it.
  // We'll follow the original logic: ensure the structure exists, then inject/overwrite if gscQueries is not empty.

  const normalizedGscQueries = gscQueries.map(normalizeGscQueryRow);
  const currentPrimaryKeyword =
    isUsablePrimaryKeyword(page.kwPrincipal) && !isBrandTermMatch(page.kwPrincipal, brandTerms)
      ? page.kwPrincipal.trim()
      : '';
  const primaryKeywordFromQueries = pickPrimaryKeywordFromQueries(normalizedGscQueries, brandTerms);

  const resolvedPrimaryKeyword = page.isBrandKeyword
    ? ''
    : allowKwPrincipalUpdate
      ? currentPrimaryKeyword || primaryKeywordFromQueries
      : currentPrimaryKeyword;

  if (normalizedGscQueries.length > 0 || !result.items?.OPORTUNIDADES?.autoData?.gscQueries) {
    if (!result.items) {
      result.items = {};
    }
    if (!result.items.OPORTUNIDADES) {
      result.items.OPORTUNIDADES = {};
    }
    if (!result.items.OPORTUNIDADES.autoData) {
      result.items.OPORTUNIDADES.autoData = {};
    }

    const normalizedPrimaryKeyword = resolvedPrimaryKeyword;
    result.items.OPORTUNIDADES.autoData.primaryKeyword = normalizedPrimaryKeyword;
    result.items.OPORTUNIDADES.autoData.isBrandKeyword = Boolean(page.isBrandKeyword);

    if (normalizedGscQueries.length > 0) {
      result.items.OPORTUNIDADES.autoData.gscQueries = normalizedGscQueries;
    }

    // Calculate kwFound if GSC data is present (either just injected or already there)
    const currentGscQueries = result.items.OPORTUNIDADES.autoData.gscQueries || [];
    if (currentGscQueries.length > 0 && normalizedPrimaryKeyword) {
      const normalizedKw = normalizedPrimaryKeyword.toLowerCase();
      const kwFound = currentGscQueries.some((q: any) => {
        const query = q.query || q.keys?.[0] || '';
        return query.toLowerCase().trim() === normalizedKw;
      });
      result.items.OPORTUNIDADES.autoData.kwPrincipalInGSC = kwFound;
    } else {
      result.items.OPORTUNIDADES.autoData.kwPrincipalInGSC = undefined;
    }
  }

  const resolvedGscMetrics =
    gscMetrics || page.gscMetrics || buildGscMetricsFromQueries(gscQueries);
  const updates: Partial<SeoPage> = {
    url: page.url,
    kwPrincipal: resolvedPrimaryKeyword,
    originalKwPrincipal: resolvedPrimaryKeyword || page.originalKwPrincipal,
    isBrandKeyword: page.isBrandKeyword || false,
    gscMetrics: resolvedGscMetrics,
    lastAnalyzedAt: Date.now(),
    checklist: { ...page.checklist },
    advancedBlockedReason: result.advancedBlockedReason,
    engineMeta: result.engineMeta,
  };

  if (result.items) {
    Object.entries(result.items).forEach(([k, v]) => {
      const key = k as ChecklistKey;
      if (updates.checklist) {
        if (!updates.checklist[key]) {
          updates.checklist[key] = {
            key: key,
            label: key,
            status_manual: 'NA',
            notes_manual: '',
          };
        }
        // Deep merge of the checklist item is NOT done for autoData in the original code,
        // it replaced the properties spread from `v`.
        // `v` contains { autoData, recommendation, suggested_status }
        // The original code:
        // updates.checklist[key] = {
        //   ...updates.checklist[key],
        //   ...v,
        //   suggested_status: v.suggested_status as any,
        // };
        // This preserves status_manual and notes_manual from `updates.checklist[key]` (which is from `page.checklist`),
        // and overwrites autoData, recommendation, etc. from `v`.

        if (v) {
          updates.checklist[key] = {
            ...updates.checklist[key],
            ...v,
            suggested_status: v.suggested_status as any,
          };
        }
      }
    });
  }

  return updates;
};

export const runPageAnalysis = async (
  page: SeoPage,
  analysisConfig?: AnalysisConfigPayload,
  projectSettings?: SeoChecklistSettings | null,
): Promise<Partial<SeoPage>> => {
  const normalizedPage = normalizeSeoPageInput(page);
  const resolvedProjectSettings = projectSettings || getStoredSeoChecklistSettings();
  const resolvedAnalysisConfig = analysisConfig || buildDefaultAnalysisConfig(resolvedProjectSettings);
  const resolvedProcessingSettings = {
    brandTerms: Array.isArray(resolvedProjectSettings?.brandTerms)
      ? resolvedProjectSettings.brandTerms
      : [],
    allowKwPrincipalUpdate: resolvedProjectSettings?.allowKwPrincipalUpdate !== false,
  };
  const manualCompetitorUrls = (normalizedPage.competitors || [])
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter((url) => Boolean(url));
  const shouldAnalyzeCompetitors =
    resolvedAnalysisConfig.mode === 'advanced' &&
    resolvedAnalysisConfig.serp?.confirmed &&
    resolvedProjectSettings?.competitorsMode !== 'off';
  let gscQueries: any[] = [];
  let gscMetrics: SeoPage['gscMetrics'] | undefined = page.gscMetrics;

  // Check if page already has GSC data (to avoid re-fetching and respect limits)
  if (
    page.checklist.OPORTUNIDADES?.autoData?.gscQueries &&
    Array.isArray(page.checklist.OPORTUNIDADES.autoData.gscQueries) &&
    page.checklist.OPORTUNIDADES.autoData.gscQueries.length > 0
  ) {
    gscQueries = page.checklist.OPORTUNIDADES.autoData.gscQueries;
  } else {
    const token = localStorage.getItem('mediaflow_gsc_token');
    const site = localStorage.getItem('mediaflow_gsc_selected_site');

    if (token && site) {
      try {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [pageMetricsRow, pageQueries] = await Promise.all([
          getPageMetrics(token, site, normalizedPage.url, start, end),
          getPageQueries(token, site, normalizedPage.url, start, end, 50),
        ]);

        gscQueries = pageQueries.map(normalizeGscQueryRow);
        if (pageMetricsRow) {
          gscMetrics = {
            clicks: pageMetricsRow.clicks || 0,
            impressions: pageMetricsRow.impressions || 0,
            ctr: pageMetricsRow.ctr || 0,
            position: pageMetricsRow.position,
            queryCount: gscQueries.length,
            source: 'page',
            updatedAt: Date.now(),
          };
        } else if (gscQueries.length > 0) {
          gscMetrics = buildGscMetricsFromQueries(gscQueries);
        }
      } catch (e) {
        console.warn('Could not fetch GSC queries', e);
      }
    }
  }

  const result = await analyzeUrl(
    {
      url: normalizedPage.url,
      kwPrincipal: normalizedPage.kwPrincipal,
      pageType: normalizedPage.pageType,
      geoTarget: normalizedPage.geoTarget,
      cluster: normalizedPage.cluster,
      pageId: normalizedPage.id,
      gscQueries,
      analysisConfig: resolvedAnalysisConfig,
      analyzeCompetitors: shouldAnalyzeCompetitors,
      competitorUrls: manualCompetitorUrls,
    },
    { timeoutMs: ENGINE_ANALYZE_TIMEOUT_MS },
  );

  const updates = processAnalysisResult(
    normalizedPage,
    result,
    gscQueries,
    gscMetrics,
    resolvedProcessingSettings,
  );
  updates.url = normalizedPage.url;
  return updates;
};
