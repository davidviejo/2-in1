import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, LogIn, LogOut, RefreshCcw, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useGSCAuth } from '@/hooks/useGSCAuth';
import { useGSCData } from '@/hooks/useGSCData';
import { GSCDimensionFilterGroup, GSCRow, GSCSearchType } from '@/types';
import { getGSCQueryData, getGSCQueryPageData } from '@/services/googleSearchConsole';
import { inspectUrlsBatch, UrlInspectionErrorItem, UrlInspectionRow } from '@/services/gscInspectionService';
import { GscImpactSegmentationRepository } from '@/services/gscImpactSegmentationRepository';
import { parseBrandTermsInput, parseTemplateManualMap, parseTemplateRules } from '@/utils/gscFilters';
import { QuerySegmentFilter } from '@/features/gsc-impact/segmentation/coreEngine';
import {
  collectAvailableTemplates,
  filterQueryImpactRows,
  mapAndFilterUrlImpactRows,
} from '@/features/gsc-impact/segmentation/pipeline';
import { useProject } from '@/context/ProjectContext';
import {
  buildDefaultRanges,
  buildPeriodRangesFromParams,
  mapPeriodRangesToSearchParams,
  PeriodRanges,
  validatePeriodRanges,
} from '@/utils/gscImpactPeriodRanges';

type DeviceFilter = 'all' | 'DESKTOP' | 'MOBILE' | 'TABLET';

type ImpactRow = {
  key: string;
  label: string;
  preClicks: number;
  rolloutClicks: number;
  postClicks: number;
  preImpressions: number;
  rolloutImpressions: number;
  postImpressions: number;
  prePosition: number;
  rolloutPosition: number;
  postPosition: number;
};

type FilterState = {
  segmentFilter: QuerySegmentFilter;
  brandTermsText: string;
  minImpressions: number;
  pathPrefix: string;
  selectedTemplate: string;
  templateRulesText: string;
  templateManualMapText: string;
  device: DeviceFilter;
  country: string;
  searchType: GSCSearchType;
};

type UrlSampleRow = ImpactRow & {
  clickDelta: number;
  impressionDelta: number;
  positionDelta: number;
  severityScore: number;
  source: string;
  ruleId: string | null;
  ruleType: string | null;
};

type InsightRowMeta = {
  source: string;
  ruleId: string | null;
  ruleType: string | null;
};

const getSourceBadgeVariant = (source: string) => (source === 'custom' ? 'primary' : 'neutral');

const getSourceLabel = (row: InsightRowMeta) => {
  const sourceLabel = row.source === 'custom' ? 'Custom rule' : 'Base rule';
  if (!row.ruleType) return sourceLabel;
  return `${sourceLabel} · ${row.ruleType}`;
};

const toISODate = (date: Date) => date.toISOString().split('T')[0];

const sumRows = (rows: GSCRow[]) =>
  rows.reduce(
    (acc, row) => {
      acc.clicks += row.clicks;
      acc.impressions += row.impressions;
      return acc;
    },
    { clicks: 0, impressions: 0 },
  );

const aggregateByKey = (rows: GSCRow[], index: number) => {
  const map = new Map<string, { clicks: number; impressions: number; positionSum: number; positionWeight: number }>();

  rows.forEach((row) => {
    const key = row.keys[index] || 'Sin dato';
    const current = map.get(key) || { clicks: 0, impressions: 0, positionSum: 0, positionWeight: 0 };
    const weight = Math.max(row.impressions, 1);
    map.set(key, {
      clicks: current.clicks + row.clicks,
      impressions: current.impressions + row.impressions,
      positionSum: current.positionSum + row.position * weight,
      positionWeight: current.positionWeight + weight,
    });
  });

  return map;
};

const mergePeriods = (
  pre: Map<string, { clicks: number; impressions: number; positionSum: number; positionWeight: number }>,
  rollout: Map<string, { clicks: number; impressions: number; positionSum: number; positionWeight: number }>,
  post: Map<string, { clicks: number; impressions: number; positionSum: number; positionWeight: number }>,
): ImpactRow[] => {
  const keys = new Set<string>([...pre.keys(), ...rollout.keys(), ...post.keys()]);

  return Array.from(keys).map((key) => {
    const preValue = pre.get(key) || { clicks: 0, impressions: 0, positionSum: 0, positionWeight: 0 };
    const rolloutValue = rollout.get(key) || { clicks: 0, impressions: 0, positionSum: 0, positionWeight: 0 };
    const postValue = post.get(key) || { clicks: 0, impressions: 0, positionSum: 0, positionWeight: 0 };

    const avgPosition = (value: { positionSum: number; positionWeight: number }) =>
      value.positionWeight > 0 ? Number((value.positionSum / value.positionWeight).toFixed(2)) : 0;

    return {
      key,
      label: key,
      preClicks: preValue.clicks,
      rolloutClicks: rolloutValue.clicks,
      postClicks: postValue.clicks,
      preImpressions: preValue.impressions,
      rolloutImpressions: rolloutValue.impressions,
      postImpressions: postValue.impressions,
      prePosition: avgPosition(preValue),
      rolloutPosition: avgPosition(rolloutValue),
      postPosition: avgPosition(postValue),
    };
  });
};

const toSampleRow = (row: ImpactRow & InsightRowMeta): UrlSampleRow => {
  const clickDelta = row.postClicks - row.preClicks;
  const impressionDelta = row.postImpressions - row.preImpressions;
  const positionDelta = row.postPosition - row.prePosition;
  const severityScore =
    Math.max(0, -clickDelta) * 3 +
    Math.max(0, -impressionDelta) * 0.5 +
    Math.max(0, positionDelta) * 40;

  return {
    ...row,
    clickDelta,
    impressionDelta,
    positionDelta,
    severityScore,
  };
};

const getActionableSignals = (row: UrlInspectionRow): string[] => {
  const signals: string[] = [];
  if (row.coverageState && !/submitted and indexed|indexed/i.test(row.coverageState)) {
    signals.push('Revisar cobertura/indexación');
  }
  if (row.indexingState && /blocked|not indexed|soft 404/i.test(row.indexingState)) {
    signals.push('Validar bloqueo/no index');
  }
  if (row.userCanonical && row.googleCanonical && row.userCanonical !== row.googleCanonical) {
    signals.push('Canónica declarada != Google');
  }
  if (row.pageFetchState && row.pageFetchState !== 'SUCCESSFUL') {
    signals.push('Error de fetch por Googlebot');
  }
  if (row.robotsTxtState && row.robotsTxtState !== 'ALLOWED') {
    signals.push('Revisar robots.txt');
  }
  if (signals.length === 0) {
    signals.push('Sin bloqueadores críticos detectados');
  }
  return signals;
};

const SHARED_RULES_PARAM = 'sharedRules';

const splitByLines = (value: string[]) => value.join('\n');

const buildFilterState = (
  params: URLSearchParams,
  input: {
    persistedConfig: ReturnType<typeof GscImpactSegmentationRepository.getConfigByClientId>;
    useSharedRuleParams: boolean;
  },
): FilterState => {
  const { persistedConfig, useSharedRuleParams } = input;
  const persistedBrandTermsText = splitByLines(persistedConfig.brandedTerms);
  const persistedTemplateRulesText = persistedConfig.templateRules
    .map((rule) => `${rule.template}|${rule.pattern}`)
    .join('\n');
  const persistedTemplateManualMapText = Object.entries(persistedConfig.manualMappings)
    .map(([path, template]) => `${path}|${template}`)
    .join('\n');

  return {
    segmentFilter: (params.get('segment') as QuerySegmentFilter) || 'all',
    brandTermsText:
      useSharedRuleParams && params.has('brandTerms') ? params.get('brandTerms') || '' : persistedBrandTermsText,
    minImpressions: Number(params.get('minImpressions') || 50) || 0,
    pathPrefix: params.get('pathPrefix') || '',
    selectedTemplate: params.get('template') || 'all',
    templateRulesText:
      useSharedRuleParams && params.has('templateRules')
        ? params.get('templateRules') || ''
        : persistedTemplateRulesText,
    templateManualMapText:
      useSharedRuleParams && params.has('templateMap')
        ? params.get('templateMap') || ''
        : persistedTemplateManualMapText,
    device: (params.get('device') as DeviceFilter) || 'all',
    country: (params.get('country') || '').toUpperCase(),
    searchType: (params.get('searchType') as GSCSearchType) || 'web',
  };
};

const GscImpactPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentClientId } = useProject();
  const useSharedRuleParams = searchParams.get(SHARED_RULES_PARAM) === '1';
  const persistedConfig = useMemo(
    () => GscImpactSegmentationRepository.getConfigByClientId(currentClientId),
    [currentClientId],
  );
  const initialFilters = buildFilterState(searchParams, { persistedConfig, useSharedRuleParams });
  const initialRolloutDate = searchParams.get('rolloutDate') || toISODate(new Date());
  const initialRangesFromParams = buildPeriodRangesFromParams(searchParams, initialRolloutDate);
  const useCustomRulesParam = searchParams.get('useCustomRules');
  const initialUseCustomRules =
    useCustomRulesParam === null
      ? GscImpactSegmentationRepository.getUseCustomRulesByClientId(currentClientId)
      : useCustomRulesParam === '1';

  const [rolloutDate, setRolloutDate] = useState(initialRolloutDate);
  const [periodRanges, setPeriodRanges] = useState<PeriodRanges>(initialRangesFromParams.ranges);
  const [siteSearch, setSiteSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [inspectionRows, setInspectionRows] = useState<UrlInspectionRow[]>([]);
  const [inspectionErrors, setInspectionErrors] = useState<UrlInspectionErrorItem[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionStatus, setInspectionStatus] = useState<string | null>(null);
  const [useCustomRules, setUseCustomRules] = useState<boolean>(initialUseCustomRules);

  const [queryRows, setQueryRows] = useState<ImpactRow[]>([]);
  const [urlRows, setUrlRows] = useState<ImpactRow[]>([]);

  const {
    gscAccessToken,
    googleUser,
    clientId,
    showGscConfig,
    setShowGscConfig,
    handleSaveClientId,
    handleLogoutGsc,
    login,
    setClientId,
  } = useGSCAuth();

  const { gscSites, selectedSite, setSelectedSite, gscData, comparisonGscData, isLoadingGsc } =
    useGSCData(gscAccessToken);

  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    if (!q) return gscSites;
    return gscSites.filter((site) => site.siteUrl.toLowerCase().includes(q));
  }, [gscSites, siteSearch]);

  const ranges = periodRanges;
  const periodRangeErrors = useMemo(() => validatePeriodRanges(periodRanges), [periodRanges]);
  const brandTerms = useMemo(() => parseBrandTermsInput(filters.brandTermsText), [filters.brandTermsText]);
  const templateRules = useMemo(() => parseTemplateRules(filters.templateRulesText), [filters.templateRulesText]);
  const templateManualMap = useMemo(
    () => parseTemplateManualMap(filters.templateManualMapText),
    [filters.templateManualMapText],
  );

  useEffect(() => {
    setFilters(buildFilterState(searchParams, { persistedConfig, useSharedRuleParams }));
  }, [currentClientId, persistedConfig, searchParams, useSharedRuleParams]);

  useEffect(() => {
    const queryValue = searchParams.get('useCustomRules');
    if (queryValue !== null) {
      setUseCustomRules(queryValue === '1');
      return;
    }
    setUseCustomRules(GscImpactSegmentationRepository.getUseCustomRulesByClientId(currentClientId));
  }, [currentClientId, searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('segment', filters.segmentFilter);
    next.set('minImpressions', String(filters.minImpressions));
    next.set('pathPrefix', filters.pathPrefix);
    next.set('template', filters.selectedTemplate);
    next.set('device', filters.device);
    next.set('country', filters.country);
    next.set('searchType', filters.searchType);
    next.set('useCustomRules', useCustomRules ? '1' : '0');
    next.set('rolloutDate', rolloutDate);
    if (useSharedRuleParams) {
      next.set(SHARED_RULES_PARAM, '1');
      next.set('brandTerms', filters.brandTermsText);
      next.set('templateRules', filters.templateRulesText);
      next.set('templateMap', filters.templateManualMapText);
    }
    mapPeriodRangesToSearchParams(next, periodRanges);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filters, periodRanges, rolloutDate, searchParams, setSearchParams, useCustomRules, useSharedRuleParams]);

  useEffect(() => {
    GscImpactSegmentationRepository.saveConfigByClientId(currentClientId, {
      ...persistedConfig,
      brandedTerms: parseBrandTermsInput(filters.brandTermsText),
      templateRules: parseTemplateRules(filters.templateRulesText),
      manualMappings: parseTemplateManualMap(filters.templateManualMapText),
    });
  }, [
    currentClientId,
    filters.brandTermsText,
    filters.templateManualMapText,
    filters.templateRulesText,
    persistedConfig,
  ]);

  const dimensionFilterGroups = useMemo<GSCDimensionFilterGroup[] | undefined>(() => {
    const filtersByDimension = [];
    if (filters.device !== 'all') {
      filtersByDimension.push({
        dimension: 'device' as const,
        operator: 'equals' as const,
        expression: filters.device,
      });
    }
    if (filters.country.trim()) {
      filtersByDimension.push({
        dimension: 'country' as const,
        operator: 'equals' as const,
        expression: filters.country.trim().toUpperCase(),
      });
    }
    return filtersByDimension.length > 0 ? [{ groupType: 'and', filters: filtersByDimension }] : undefined;
  }, [filters.country, filters.device]);

  useEffect(() => {
    const fetchImpact = async () => {
      if (!gscAccessToken || !selectedSite) return;

      if (periodRangeErrors.length > 0) {
        setImpactError(`Rangos inválidos: ${periodRangeErrors.join(' ')}`);
        setQueryRows([]);
        setUrlRows([]);
        return;
      }

      setLoadingImpact(true);
      setImpactError(null);

      try {
        const [
          preQuery,
          rolloutQuery,
          postQuery,
          preQueryPage,
          rolloutQueryPage,
          postQueryPage,
        ] = await Promise.all([
          getGSCQueryData(gscAccessToken, selectedSite, ranges.pre.start, ranges.pre.end, 1000, {
            searchType: filters.searchType,
            dimensionFilterGroups,
          }),
          getGSCQueryData(
            gscAccessToken,
            selectedSite,
            ranges.rollout.start,
            ranges.rollout.end,
            1000,
            { searchType: filters.searchType, dimensionFilterGroups },
          ),
          getGSCQueryData(gscAccessToken, selectedSite, ranges.post.start, ranges.post.end, 1000, {
            searchType: filters.searchType,
            dimensionFilterGroups,
          }),
          getGSCQueryPageData(gscAccessToken, selectedSite, ranges.pre.start, ranges.pre.end, 1200, {
            searchType: filters.searchType,
            dimensionFilterGroups,
          }),
          getGSCQueryPageData(
            gscAccessToken,
            selectedSite,
            ranges.rollout.start,
            ranges.rollout.end,
            1200,
            { searchType: filters.searchType, dimensionFilterGroups },
          ),
          getGSCQueryPageData(gscAccessToken, selectedSite, ranges.post.start, ranges.post.end, 1200, {
            searchType: filters.searchType,
            dimensionFilterGroups,
          }),
        ]);

        const queryMerged = mergePeriods(
          aggregateByKey(preQuery, 0),
          aggregateByKey(rolloutQuery, 0),
          aggregateByKey(postQuery, 0),
        );

        const urlMerged = mergePeriods(
          aggregateByKey(preQueryPage, 1),
          aggregateByKey(rolloutQueryPage, 1),
          aggregateByKey(postQueryPage, 1),
        );

        setQueryRows(queryMerged);
        setUrlRows(urlMerged);
      } catch (error) {
        setImpactError(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar los bloques pre/rollout/post desde Search Console.',
        );
      } finally {
        setLoadingImpact(false);
      }
    };

    void fetchImpact();
  }, [dimensionFilterGroups, filters.searchType, gscAccessToken, selectedSite, ranges, refreshTick, periodRangeErrors]);

  const gscSummary = useMemo(() => {
    const current = sumRows(gscData);
    const previous = sumRows(comparisonGscData);
    const clickDelta = current.clicks - previous.clicks;
    const impressionDelta = current.impressions - previous.impressions;

    return {
      current,
      previous,
      clickDelta,
      impressionDelta,
    };
  }, [gscData, comparisonGscData]);

  const filteredQueryRows = useMemo(() => {
    return filterQueryImpactRows(
      queryRows,
      {
        segmentFilter: filters.segmentFilter,
        brandTerms,
        minImpressions: filters.minImpressions,
      },
      persistedConfig,
      { useCustomRules },
    );
  }, [brandTerms, filters.minImpressions, filters.segmentFilter, persistedConfig, queryRows, useCustomRules]);

  const filteredUrlRows = useMemo(() => {
    return mapAndFilterUrlImpactRows(
      urlRows,
      {
        minImpressions: filters.minImpressions,
        pathPrefix: filters.pathPrefix,
        selectedTemplate: filters.selectedTemplate,
        templateRules,
        templateManualMap,
      },
      persistedConfig,
      { useCustomRules },
    );
  }, [filters.minImpressions, filters.pathPrefix, filters.selectedTemplate, persistedConfig, templateManualMap, templateRules, urlRows, useCustomRules]);

  const availableTemplates = useMemo(() => {
    return collectAvailableTemplates(
      urlRows,
      {
        templateRules,
        templateManualMap,
      },
      persistedConfig,
      { useCustomRules },
    );
  }, [persistedConfig, templateManualMap, templateRules, urlRows, useCustomRules]);

  const topQueryWinners = useMemo(
    () =>
      [...filteredQueryRows]
        .sort((a, b) => b.postClicks - b.preClicks - (a.postClicks - a.preClicks))
        .slice(0, 8),
    [filteredQueryRows],
  );

  const topQueryLosers = useMemo(
    () =>
      [...filteredQueryRows]
        .sort((a, b) => a.postClicks - a.preClicks - (b.postClicks - b.preClicks))
        .slice(0, 8),
    [filteredQueryRows],
  );

  const topUrlWinners = useMemo(
    () =>
      [...filteredUrlRows]
        .sort((a, b) => b.postClicks - b.preClicks - (a.postClicks - a.preClicks))
        .slice(0, 8),
    [filteredUrlRows],
  );

  const topUrlLosers = useMemo(
    () =>
      [...filteredUrlRows]
        .sort((a, b) => a.postClicks - a.preClicks - (b.postClicks - b.preClicks))
        .slice(0, 8),
    [filteredUrlRows],
  );

  const sampledAffectedUrls = useMemo(() => {
    return filteredUrlRows
      .map(toSampleRow)
      .filter((row) => row.clickDelta < 0 || row.impressionDelta < 0 || row.positionDelta > 0)
      .sort((a, b) => b.severityScore - a.severityScore)
      .slice(0, 10);
  }, [filteredUrlRows]);

  useEffect(() => {
    GscImpactSegmentationRepository.saveUseCustomRulesByClientId(currentClientId, useCustomRules);
  }, [currentClientId, useCustomRules]);

  const inspectSampledUrls = async () => {
    if (!selectedSite || sampledAffectedUrls.length === 0) {
      setInspectionStatus('No hay URLs afectadas para inspeccionar en esta vista.');
      return;
    }

    setIsInspecting(true);
    setInspectionRows([]);
    setInspectionErrors([]);
    setInspectionStatus('Iniciando inspección de URLs afectadas…');

    try {
      const response = await inspectUrlsBatch(
        selectedSite,
        sampledAffectedUrls.map((row) => row.key),
        { retries: 1 },
      );
      setInspectionRows(response.results || []);
      setInspectionErrors(response.errors || []);

      if (response.meta?.quotaHit) {
        setInspectionStatus('Se alcanzó cuota parcial de URL Inspection. Muestra incompleta; reintenta más tarde.');
      } else if (response.status === 'partial') {
        setInspectionStatus('Inspección parcial: algunas URLs no pudieron evaluarse.');
      } else if (response.status === 'error') {
        setInspectionStatus('No se pudo completar la inspección de URLs en backend.');
      } else {
        setInspectionStatus(`Inspección completada: ${response.meta.successCount} URLs procesadas.`);
      }
    } catch (error) {
      setInspectionStatus(
        error instanceof Error
          ? `Error inspeccionando URLs: ${error.message}`
          : 'Error inesperado inspeccionando URLs.',
      );
    } finally {
      setIsInspecting(false);
    }
  };

  return (
    <div className="page-shell pb-20">
      <header className="surface-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-brand-md bg-primary-soft p-3 text-primary">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="section-title">Impacto GSC por rollout</h1>
              <p className="section-subtitle">Análisis solo Search Console (sin GA4).</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!gscAccessToken ? (
              <Button onClick={() => login()}>
                <LogIn size={16} />
                Conectar Search Console (sin GA4)
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setShowGscConfig(true)}>
                  <Settings2 size={16} />
                  Configurar Client ID
                </Button>
                <Button variant="ghost" onClick={handleLogoutGsc}>
                  <LogOut size={16} />
                  Cerrar sesión GSC
                </Button>
              </>
            )}
          </div>
        </div>
        {googleUser && (
          <p className="section-subtitle">Conectado como {googleUser.email}. Módulo solo Search Console (sin GA4).</p>
        )}
      </header>

      {!gscAccessToken ? (
        <Card className="p-6">
          <p className="section-subtitle">
            Para usar esta vista debes autenticarte con Google Search Console. Este reporte funciona solo Search Console (sin GA4).
          </p>
        </Card>
      ) : (
        <>
          <section className="surface-panel p-6">
            <h2 className="text-lg font-semibold">Resumen ejecutivo (solo Search Console, sin GA4)</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="metric-chip">
                <p className="metric-label">Clics periodo actual</p>
                <p className="text-2xl font-bold">{gscSummary.current.clicks.toLocaleString('es-ES')}</p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">Clics comparativo</p>
                <p className="text-2xl font-bold">{gscSummary.previous.clicks.toLocaleString('es-ES')}</p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">Delta clics</p>
                <p className="text-2xl font-bold">{gscSummary.clickDelta.toLocaleString('es-ES')}</p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">Delta impresiones</p>
                <p className="text-2xl font-bold">{gscSummary.impressionDelta.toLocaleString('es-ES')}</p>
              </div>
            </div>
          </section>

          <section className="surface-panel p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className="metric-label">Propiedad Search Console (sin GA4)</label>
                <Input
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                  placeholder="Filtrar propiedad"
                />
                <select
                  className="form-control mt-2"
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                >
                  {filteredSites.map((site) => (
                    <option key={site.siteUrl} value={site.siteUrl}>
                      {site.siteUrl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="metric-label">Fecha rollout (helper)</label>
                <input
                  className="form-control"
                  type="date"
                  value={rolloutDate}
                  onChange={(e) => setRolloutDate(e.target.value)}
                />
                <Button
                  className="mt-2"
                  variant="secondary"
                  onClick={() => setPeriodRanges(buildDefaultRanges(rolloutDate))}
                >
                  Aplicar rangos recomendados
                </Button>
              </div>

              <div>
                <label className="metric-label">Segmentación query</label>
                <select
                  className="form-control"
                  value={filters.segmentFilter}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, segmentFilter: e.target.value as QuerySegmentFilter }))
                  }
                >
                  <option value="all">Todo</option>
                  <option value="brand">Brand</option>
                  <option value="non_brand">Non-brand</option>
                  <option value="question">Preguntas</option>
                </select>
              </div>

              <div>
                <label className="metric-label">Filtro mínimo impresiones</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  value={filters.minImpressions}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, minImpressions: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="metric-label">Pre-update · start</label>
                <input
                  className="form-control"
                  type="date"
                  value={periodRanges.pre.start}
                  onChange={(e) =>
                    setPeriodRanges((prev) => ({
                      ...prev,
                      pre: { ...prev.pre, start: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label className="metric-label">Pre-update · end</label>
                <input
                  className="form-control"
                  type="date"
                  value={periodRanges.pre.end}
                  onChange={(e) =>
                    setPeriodRanges((prev) => ({
                      ...prev,
                      pre: { ...prev.pre, end: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label className="metric-label">Rollout · start</label>
                <input
                  className="form-control"
                  type="date"
                  value={periodRanges.rollout.start}
                  onChange={(e) =>
                    setPeriodRanges((prev) => ({
                      ...prev,
                      rollout: { ...prev.rollout, start: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label className="metric-label">Rollout · end</label>
                <input
                  className="form-control"
                  type="date"
                  value={periodRanges.rollout.end}
                  onChange={(e) =>
                    setPeriodRanges((prev) => ({
                      ...prev,
                      rollout: { ...prev.rollout, end: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label className="metric-label">Post-update · start</label>
                <input
                  className="form-control"
                  type="date"
                  value={periodRanges.post.start}
                  onChange={(e) =>
                    setPeriodRanges((prev) => ({
                      ...prev,
                      post: { ...prev.post, start: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label className="metric-label">Post-update · end</label>
                <input
                  className="form-control"
                  type="date"
                  value={periodRanges.post.end}
                  onChange={(e) =>
                    setPeriodRanges((prev) => ({
                      ...prev,
                      post: { ...prev.post, end: e.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="metric-label">Términos de marca (por proyecto/cliente)</label>
                <Input
                  value={filters.brandTermsText}
                  onChange={(e) => setFilters((prev) => ({ ...prev, brandTermsText: e.target.value }))}
                  placeholder="mediaflow, marca x, producto y"
                />
              </div>
              <div>
                <label className="metric-label">Directorio (path prefix)</label>
                <Input
                  value={filters.pathPrefix}
                  onChange={(e) => setFilters((prev) => ({ ...prev, pathPrefix: e.target.value }))}
                  placeholder="/blog/"
                />
              </div>
              <div>
                <label className="metric-label">Template URL</label>
                <select
                  className="form-control"
                  value={filters.selectedTemplate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, selectedTemplate: e.target.value }))}
                >
                  <option value="all">Todos</option>
                  {availableTemplates.map((template) => (
                    <option key={template} value={template}>
                      {template}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="metric-label">Device</label>
                <select
                  className="form-control"
                  value={filters.device}
                  onChange={(e) => setFilters((prev) => ({ ...prev, device: e.target.value as DeviceFilter }))}
                >
                  <option value="all">Todos</option>
                  <option value="DESKTOP">Desktop</option>
                  <option value="MOBILE">Mobile</option>
                  <option value="TABLET">Tablet</option>
                </select>
              </div>
              <div>
                <label className="metric-label">Country (ISO-2)</label>
                <Input
                  value={filters.country}
                  onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value.toUpperCase() }))}
                  placeholder="ES, MX, US"
                />
              </div>
              <div>
                <label className="metric-label">Search type</label>
                <select
                  className="form-control"
                  value={filters.searchType}
                  onChange={(e) => setFilters((prev) => ({ ...prev, searchType: e.target.value as GSCSearchType }))}
                >
                  <option value="web">Web</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="news">News</option>
                  <option value="discover">Discover</option>
                  <option value="googleNews">Google News</option>
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="metric-label">Reglas template (template|/patron/*)</label>
                <textarea
                  className="form-control min-h-[88px]"
                  value={filters.templateRulesText}
                  onChange={(e) => setFilters((prev) => ({ ...prev, templateRulesText: e.target.value }))}
                />
              </div>
              <div>
                <label className="metric-label">Mapeo manual (path|template)</label>
                <textarea
                  className="form-control min-h-[88px]"
                  value={filters.templateManualMapText}
                  onChange={(e) => setFilters((prev) => ({ ...prev, templateManualMapText: e.target.value }))}
                  placeholder="/landing/pricing|Pricing"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="surface-subtle p-3 text-sm">
                <p>
                  Comparativa pre/rollout/post basada en Search Console: pre ({ranges.pre.start} → {ranges.pre.end}), rollout ({ranges.rollout.start} → {ranges.rollout.end}), post ({ranges.post.start} → {ranges.post.end}).
                </p>
              </div>
              <div className="surface-subtle p-3 text-sm">
                <p>
                  Filtros activos sincronizados en query params para compartir vista: segmentación, marca,
                  directorio/template, device/country/searchType y mínimo de impresiones.
                </p>
              </div>
            </div>

            <div className="mt-3 surface-subtle p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Usar reglas custom</p>
                  <p className="text-xs text-muted">
                    Desactiva para recalcular solo con base segmentation y comparar el impacto directo de reglas custom.
                  </p>
                </div>
                <Button
                  variant={useCustomRules ? 'primary' : 'secondary'}
                  onClick={() => setUseCustomRules((prev) => !prev)}
                >
                  {useCustomRules ? 'ON · reglas custom activas' : 'OFF · solo base segmentation'}
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button variant="secondary" onClick={() => setRefreshTick((value) => value + 1)}>
                <RefreshCcw size={16} />
                Refrescar bloque pre/rollout/post
              </Button>
              {(isLoadingGsc || loadingImpact) && <Spinner size={18} />}
            </div>
            {impactError && <p className="mt-2 text-sm text-danger">{impactError}</p>}
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold">Winners por query (solo Search Console, sin GA4)</h3>
              <p className="mt-2 text-xs text-muted">Leyenda: base = segmentación estándar · custom = reglas del cliente/proyecto.</p>
              <div className="mt-3 space-y-2">
                {topQueryWinners.map((row) => (
                  <div key={`qw-${row.key}`} className="surface-subtle p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.label}</p>
                      <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                    </div>
                    <p className="text-muted">Pre {row.preClicks} · Rollout {row.rolloutClicks} · Post {row.postClicks}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Losers por query (solo Search Console, sin GA4)</h3>
              <div className="mt-3 space-y-2">
                {topQueryLosers.map((row) => (
                  <div key={`ql-${row.key}`} className="surface-subtle p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.label}</p>
                      <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                    </div>
                    <p className="text-muted">Pre {row.preClicks} · Rollout {row.rolloutClicks} · Post {row.postClicks}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Winners por URL (solo Search Console, sin GA4)</h3>
              <div className="mt-3 space-y-2">
                {topUrlWinners.map((row) => (
                  <div key={`uw-${row.key}`} className="surface-subtle p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{row.label}</p>
                      <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                    </div>
                    <p className="text-muted">Pre {row.preClicks} · Rollout {row.rolloutClicks} · Post {row.postClicks}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Losers por URL (solo Search Console, sin GA4)</h3>
              <div className="mt-3 space-y-2">
                {topUrlLosers.map((row) => (
                  <div key={`ul-${row.key}`} className="surface-subtle p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{row.label}</p>
                      <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                    </div>
                    <p className="text-muted">Pre {row.preClicks} · Rollout {row.rolloutClicks} · Post {row.postClicks}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="surface-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">URLs inspeccionadas (URL Inspection)</h3>
                <p className="section-subtitle">
                  Muestra automática de URLs afectadas por caída de clics/impresiones o peor delta de posición.
                </p>
              </div>
              <Button onClick={() => void inspectSampledUrls()} disabled={isInspecting || sampledAffectedUrls.length === 0}>
                {isInspecting ? <Spinner size={16} /> : null}
                Inspeccionar muestra ({sampledAffectedUrls.length})
              </Button>
            </div>

            {inspectionStatus && <p className="mt-3 text-sm text-muted">{inspectionStatus}</p>}

            {sampledAffectedUrls.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="px-2 py-2">URL</th>
                      <th className="px-2 py-2">Δ clicks</th>
                      <th className="px-2 py-2">Δ imp</th>
                      <th className="px-2 py-2">Δ pos</th>
                      <th className="px-2 py-2">Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampledAffectedUrls.map((row) => (
                      <tr key={`sample-${row.key}`} className="border-t border-border/50">
                        <td className="max-w-[480px] truncate px-2 py-2">{row.key}</td>
                        <td className="px-2 py-2">{row.clickDelta}</td>
                        <td className="px-2 py-2">{row.impressionDelta}</td>
                        <td className="px-2 py-2">{row.positionDelta.toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inspectionRows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="px-2 py-2">URL</th>
                      <th className="px-2 py-2">Coverage</th>
                      <th className="px-2 py-2">Indexing</th>
                      <th className="px-2 py-2">Último crawl</th>
                      <th className="px-2 py-2">Canónica Google</th>
                      <th className="px-2 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectionRows.map((row) => (
                      <tr key={`inspection-${row.url}`} className="border-t border-border/50">
                        <td className="max-w-[360px] truncate px-2 py-2">{row.url}</td>
                        <td className="px-2 py-2">{row.coverageState}</td>
                        <td className="px-2 py-2">{row.indexingState}</td>
                        <td className="px-2 py-2">{row.lastCrawlTime ? new Date(row.lastCrawlTime).toLocaleString('es-ES') : '-'}</td>
                        <td className="max-w-[280px] truncate px-2 py-2">{row.googleCanonical || '-'}</td>
                        <td className="px-2 py-2">{getActionableSignals(row).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inspectionErrors.length > 0 && (
              <div className="mt-4 space-y-2">
                {inspectionErrors.map((item) => (
                  <p key={`inspection-error-${item.url}`} className="text-sm text-danger">
                    {item.url}: {item.error.code} {item.error.message ? `- ${item.error.message}` : ''}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showGscConfig && (
        <Modal isOpen={showGscConfig} onClose={() => setShowGscConfig(false)} title="Configurar OAuth de Search Console">
          <div className="space-y-3">
            <p className="section-subtitle">Esta configuración aplica solo a Search Console (sin GA4).</p>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Google OAuth Client ID"
            />
            <div className="flex justify-end">
              <Button onClick={() => handleSaveClientId(clientId)}>Guardar Client ID</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default GscImpactPage;
