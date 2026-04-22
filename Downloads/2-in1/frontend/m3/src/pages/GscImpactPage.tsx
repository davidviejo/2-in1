import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, LogIn, LogOut, RefreshCcw, Settings2 } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useGSCAuth } from '@/hooks/useGSCAuth';
import { useGSCData } from '@/hooks/useGSCData';
import { GSCDimensionFilterGroup, GSCRow, GSCSearchType } from '@/types';
import { getGSCQueryData, getGSCQueryPageData, querySearchAnalyticsPaged } from '@/services/googleSearchConsole';
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
import {
  detectPatternSignals,
  getDaysBetweenInclusive,
  inferLanguagePrefix,
  inferPageType,
  isBrandQuery,
  scoreImpactRows,
  summarizeRows,
} from '@/features/gsc-impact/impactAnalysis';
import {
  buildPortfolioExecutiveSummary,
  buildPortfolioExecutiveSummaryText,
  buildPortfolioPropertyRow,
  detectPortfolioPatterns,
  getPortfolioStatusBadgeVariant,
  PortfolioPropertyRow,
  PortfolioSortKey,
  sortPortfolioRows,
  summarizePortfolioStatusCounts,
} from '@/features/gsc-impact/portfolioAnalysis';
import * as XLSX from 'xlsx';

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
  minClicks: number;
  pathPrefix: string;
  selectedTemplate: string;
  templateRulesText: string;
  templateManualMapText: string;
  device: DeviceFilter;
  country: string;
  searchType: GSCSearchType;
};

type ImpactViewMode = 'individual' | 'global';

const parseImpactViewMode = (value: string | null): ImpactViewMode | null => {
  if (value === 'individual' || value === 'global') return value;
  return null;
};

type GlobalFilters = {
  includeBrandInTotals: boolean;
  minimumDailyClicks: number;
  onlyNegative: boolean;
  onlyUrgent: boolean;
  sortBy: PortfolioSortKey;
};

type UrlSampleRow = ImpactRow & {
  clickDelta: number;
  impressionDelta: number;
  ctrDelta: number;
  positionDelta: number;
  priorityScore: number;
  reason: string;
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
  const preCtr = row.preImpressions > 0 ? row.preClicks / row.preImpressions : 0;
  const postCtr = row.postImpressions > 0 ? row.postClicks / row.postImpressions : 0;
  const ctrDelta = postCtr - preCtr;
  const positionDelta = row.postPosition - row.prePosition;
  const baseVolume = Math.max(row.preImpressions, 1);
  const volumeWeight = Math.log10(baseVolume + 10);
  const priorityScore =
    Math.max(0, -clickDelta) * 3 * volumeWeight +
    Math.max(0, -impressionDelta) * 0.4 * volumeWeight +
    Math.max(0, -ctrDelta * 100) * 8 * volumeWeight +
    Math.max(0, positionDelta) * 35 * volumeWeight;

  let reason = 'posible revisión técnica';
  if (clickDelta < -20) reason = 'alto impacto en clicks';
  else if (ctrDelta < -0.03) reason = 'caída fuerte de CTR';
  else if (impressionDelta < -100) reason = 'pérdida de visibilidad';
  else if (positionDelta > 1.5) reason = 'empeoramiento de posición';

  return {
    ...row,
    clickDelta,
    impressionDelta,
    ctrDelta,
    positionDelta,
    priorityScore: Number(priorityScore.toFixed(2)),
    reason,
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
const GSC_ANALYSIS_PAGE_SIZE = 25000;
const GSC_ANALYSIS_MAX_PAGES = 40;
const GSC_ANALYSIS_MAX_ROWS = GSC_ANALYSIS_PAGE_SIZE * GSC_ANALYSIS_MAX_PAGES;
const PORTFOLIO_BATCH_SIZE = 5;
const DISPLAY_LIMIT_OPTIONS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
const RESULTS_PAGE_SIZE = 100;

const splitByLines = (value: string[]) => value.join('\n');

const toCsvCell = (value: string | number | boolean | null | undefined) => {
  const normalized = value === null || value === undefined ? '' : String(value);
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
};

const downloadCsv = (fileName: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) => {
  const csv = [headers.map(toCsvCell).join(','), ...rows.map((row) => row.map(toCsvCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const safePctString = (value: number | null | undefined) => (value === null || value === undefined ? 'NA' : value);
const safePctDelta = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
};

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
    minClicks: Number(params.get('minClicks') || 5) || 0,
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
  const { currentClientId, currentClient, addTask } = useProject();
  const useSharedRuleParams = searchParams.get(SHARED_RULES_PARAM) === '1';
  const persistedConfig = useMemo(
    () => GscImpactSegmentationRepository.getConfigByClientId(currentClientId),
    [currentClientId],
  );
  const initialFilters = buildFilterState(searchParams, { persistedConfig, useSharedRuleParams });
  const initialRolloutDate = searchParams.get('rolloutDate') || toISODate(new Date());
  const initialViewMode = parseImpactViewMode(searchParams.get('view')) || 'individual';
  const initialRangesFromParams = buildPeriodRangesFromParams(searchParams, initialRolloutDate);
  const useCustomRulesParam = searchParams.get('useCustomRules');
  const initialUseCustomRules =
    useCustomRulesParam === null
      ? GscImpactSegmentationRepository.getUseCustomRulesByClientId(currentClientId)
      : useCustomRulesParam === '1';

  const [rolloutDate, setRolloutDate] = useState(initialRolloutDate);
  const [viewMode, setViewMode] = useState<ImpactViewMode>(initialViewMode);
  const [periodRanges, setPeriodRanges] = useState<PeriodRanges>(initialRangesFromParams.ranges);
  const [siteSearch, setSiteSearch] = useState('');
  const [portfolioSiteSearch, setPortfolioSiteSearch] = useState('');
  const [selectedPortfolioSites, setSelectedPortfolioSites] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [displayLimit, setDisplayLimit] = useState<number>(Number(searchParams.get('topN') || 1000) || 1000);
  const [sampledUrlsPage, setSampledUrlsPage] = useState(1);
  const [portfolioTablePage, setPortfolioTablePage] = useState(1);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [inspectionRows, setInspectionRows] = useState<UrlInspectionRow[]>([]);
  const [inspectionErrors, setInspectionErrors] = useState<UrlInspectionErrorItem[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionStatus, setInspectionStatus] = useState<string | null>(null);
  const [useCustomRules, setUseCustomRules] = useState<boolean>(initialUseCustomRules);
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    includeBrandInTotals: searchParams.get('includeBrand') !== '0',
    minimumDailyClicks: Number(searchParams.get('minDailyClicks') || 0),
    onlyNegative: searchParams.get('onlyNegative') === '1',
    onlyUrgent: searchParams.get('onlyUrgent') === '1',
    sortBy: (searchParams.get('globalSort') as PortfolioSortKey) || 'risk',
  });
  const [portfolioRows, setPortfolioRows] = useState<PortfolioPropertyRow[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState<string | null>(null);

  const [queryRows, setQueryRows] = useState<ImpactRow[]>([]);
  const [urlRows, setUrlRows] = useState<ImpactRow[]>([]);
  const [timeSeriesRows, setTimeSeriesRows] = useState<GSCRow[]>([]);
  const [deviceRows, setDeviceRows] = useState<ImpactRow[]>([]);
  const [countryRows, setCountryRows] = useState<ImpactRow[]>([]);

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

  const { gscSites, selectedSite, setSelectedSite, isLoadingGsc } = useGSCData(gscAccessToken);

  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    if (!q) return gscSites;
    return gscSites.filter((site) => site.siteUrl.toLowerCase().includes(q));
  }, [gscSites, siteSearch]);
  const filteredPortfolioSites = useMemo(() => {
    const q = portfolioSiteSearch.trim().toLowerCase();
    if (!q) return gscSites;
    return gscSites.filter((site) => site.siteUrl.toLowerCase().includes(q));
  }, [gscSites, portfolioSiteSearch]);
  const filteredPortfolioSiteUrls = useMemo(
    () => new Set(filteredPortfolioSites.map((site) => site.siteUrl)),
    [filteredPortfolioSites],
  );

  const handlePortfolioSitesSelectionChange = (nextVisibleSelection: string[]) => {
    setSelectedPortfolioSites((prev) => {
      const keepHiddenSelections = prev.filter((siteUrl) => !filteredPortfolioSiteUrls.has(siteUrl));
      return Array.from(new Set([...keepHiddenSelections, ...nextVisibleSelection]));
    });
  };

  useEffect(() => {
    if (selectedPortfolioSites.length === 0) return;
    const available = new Set(gscSites.map((site) => site.siteUrl));
    setSelectedPortfolioSites((prev) => prev.filter((siteUrl) => available.has(siteUrl)));
  }, [gscSites, selectedPortfolioSites.length]);

  const ranges = periodRanges;
  const periodRangeErrors = useMemo(() => validatePeriodRanges(periodRanges), [periodRanges]);
  const hasRangeOverlapError = useMemo(
    () => periodRangeErrors.some((error) => error.toLowerCase().includes('solap')),
    [periodRangeErrors],
  );
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
    const nextViewMode = parseImpactViewMode(searchParams.get('view'));
    if (!nextViewMode) return;
    if (nextViewMode !== viewMode) {
      setViewMode(nextViewMode);
    }
  }, [searchParams, viewMode]);

  useEffect(() => {
    const nextTopN = Number(searchParams.get('topN') || 1000) || 1000;
    if (nextTopN !== displayLimit) {
      setDisplayLimit(nextTopN);
    }
  }, [displayLimit, searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('segment', filters.segmentFilter);
    next.set('minImpressions', String(filters.minImpressions));
    next.set('minClicks', String(filters.minClicks));
    next.set('pathPrefix', filters.pathPrefix);
    next.set('template', filters.selectedTemplate);
    next.set('device', filters.device);
    next.set('country', filters.country);
    next.set('searchType', filters.searchType);
    next.set('useCustomRules', useCustomRules ? '1' : '0');
    next.set('rolloutDate', rolloutDate);
    next.set('view', viewMode);
    next.set('includeBrand', globalFilters.includeBrandInTotals ? '1' : '0');
    next.set('minDailyClicks', String(globalFilters.minimumDailyClicks));
    next.set('onlyNegative', globalFilters.onlyNegative ? '1' : '0');
    next.set('onlyUrgent', globalFilters.onlyUrgent ? '1' : '0');
    next.set('globalSort', globalFilters.sortBy);
    next.set('topN', String(displayLimit));
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
  }, [
    displayLimit,
    filters,
    globalFilters,
    periodRanges,
    rolloutDate,
    searchParams,
    setSearchParams,
    useCustomRules,
    useSharedRuleParams,
    viewMode,
  ]);

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
      if (viewMode !== 'individual') {
        setLoadingImpact(false);
        return;
      }
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
          preByDevice,
          rolloutByDevice,
          postByDevice,
          preByCountry,
          rolloutByCountry,
          postByCountry,
          fullSeries,
        ] = await Promise.all([
          getGSCQueryData(gscAccessToken, selectedSite, ranges.pre.start, ranges.pre.end, GSC_ANALYSIS_PAGE_SIZE, {
            searchType: filters.searchType,
            dimensionFilterGroups,
            maxPages: GSC_ANALYSIS_MAX_PAGES,
            maxRows: GSC_ANALYSIS_MAX_ROWS,
          }),
          getGSCQueryData(
            gscAccessToken,
            selectedSite,
            ranges.rollout.start,
            ranges.rollout.end,
            GSC_ANALYSIS_PAGE_SIZE,
            {
              searchType: filters.searchType,
              dimensionFilterGroups,
              maxPages: GSC_ANALYSIS_MAX_PAGES,
              maxRows: GSC_ANALYSIS_MAX_ROWS,
            },
          ),
          getGSCQueryData(gscAccessToken, selectedSite, ranges.post.start, ranges.post.end, GSC_ANALYSIS_PAGE_SIZE, {
            searchType: filters.searchType,
            dimensionFilterGroups,
            maxPages: GSC_ANALYSIS_MAX_PAGES,
            maxRows: GSC_ANALYSIS_MAX_ROWS,
          }),
          getGSCQueryPageData(gscAccessToken, selectedSite, ranges.pre.start, ranges.pre.end, GSC_ANALYSIS_PAGE_SIZE, {
            searchType: filters.searchType,
            dimensionFilterGroups,
            maxPages: GSC_ANALYSIS_MAX_PAGES,
            maxRows: GSC_ANALYSIS_MAX_ROWS,
          }),
          getGSCQueryPageData(
            gscAccessToken,
            selectedSite,
            ranges.rollout.start,
            ranges.rollout.end,
            GSC_ANALYSIS_PAGE_SIZE,
            {
              searchType: filters.searchType,
              dimensionFilterGroups,
              maxPages: GSC_ANALYSIS_MAX_PAGES,
              maxRows: GSC_ANALYSIS_MAX_ROWS,
            },
          ),
          getGSCQueryPageData(gscAccessToken, selectedSite, ranges.post.start, ranges.post.end, GSC_ANALYSIS_PAGE_SIZE, {
            searchType: filters.searchType,
            dimensionFilterGroups,
            maxPages: GSC_ANALYSIS_MAX_PAGES,
            maxRows: GSC_ANALYSIS_MAX_ROWS,
          }),
          querySearchAnalyticsPaged(gscAccessToken, {
            siteUrl: selectedSite,
            startDate: ranges.pre.start,
            endDate: ranges.pre.end,
            dimensions: ['device'],
            rowLimit: 100,
            searchType: filters.searchType,
            dimensionFilterGroups,
          }).then((data) => data.rows || []),
          querySearchAnalyticsPaged(gscAccessToken, {
            siteUrl: selectedSite,
            startDate: ranges.rollout.start,
            endDate: ranges.rollout.end,
            dimensions: ['device'],
            rowLimit: 100,
            searchType: filters.searchType,
            dimensionFilterGroups,
          }).then((data) => data.rows || []),
          querySearchAnalyticsPaged(gscAccessToken, {
            siteUrl: selectedSite,
            startDate: ranges.post.start,
            endDate: ranges.post.end,
            dimensions: ['device'],
            rowLimit: 100,
            searchType: filters.searchType,
            dimensionFilterGroups,
          }).then((data) => data.rows || []),
          querySearchAnalyticsPaged(gscAccessToken, {
            siteUrl: selectedSite,
            startDate: ranges.pre.start,
            endDate: ranges.pre.end,
            dimensions: ['country'],
            rowLimit: 100,
            searchType: filters.searchType,
            dimensionFilterGroups,
          }).then((data) => data.rows || []),
          querySearchAnalyticsPaged(gscAccessToken, {
            siteUrl: selectedSite,
            startDate: ranges.rollout.start,
            endDate: ranges.rollout.end,
            dimensions: ['country'],
            rowLimit: 100,
            searchType: filters.searchType,
            dimensionFilterGroups,
          }).then((data) => data.rows || []),
          querySearchAnalyticsPaged(gscAccessToken, {
            siteUrl: selectedSite,
            startDate: ranges.post.start,
            endDate: ranges.post.end,
            dimensions: ['country'],
            rowLimit: 100,
            searchType: filters.searchType,
            dimensionFilterGroups,
          }).then((data) => data.rows || []),
          querySearchAnalyticsPaged(gscAccessToken, {
            siteUrl: selectedSite,
            startDate: ranges.pre.start,
            endDate: ranges.post.end,
            dimensions: ['date'],
            rowLimit: 1500,
            searchType: filters.searchType,
            dimensionFilterGroups,
          }).then((data) => data.rows || []),
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
        setDeviceRows(
          mergePeriods(aggregateByKey(preByDevice, 0), aggregateByKey(rolloutByDevice, 0), aggregateByKey(postByDevice, 0)),
        );
        setCountryRows(
          mergePeriods(aggregateByKey(preByCountry, 0), aggregateByKey(rolloutByCountry, 0), aggregateByKey(postByCountry, 0)),
        );
        setTimeSeriesRows(fullSeries);
      } catch (error) {
        setImpactError(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar los bloques pre/rollout/post desde Search Console.',
        );
        setDeviceRows([]);
        setCountryRows([]);
        setTimeSeriesRows([]);
      } finally {
        setLoadingImpact(false);
      }
    };

    void fetchImpact();
  }, [dimensionFilterGroups, filters.searchType, gscAccessToken, selectedSite, ranges, refreshTick, periodRangeErrors, viewMode]);

  useEffect(() => {
    const fetchPortfolioImpact = async () => {
      if (viewMode !== 'global') {
        setLoadingPortfolio(false);
        setPortfolioStatus(null);
        return;
      }
      if (!gscAccessToken || gscSites.length === 0) {
        setPortfolioRows([]);
        setPortfolioStatus(null);
        return;
      }

      if (periodRangeErrors.length > 0) {
        setPortfolioError(`Rangos inválidos: ${periodRangeErrors.join(' ')}`);
        setPortfolioRows([]);
        setPortfolioStatus(null);
        return;
      }

      setLoadingPortfolio(true);
      setPortfolioError(null);
      setPortfolioStatus('Preparando análisis portfolio…');

      try {
        const days = {
          pre: getDaysBetweenInclusive(ranges.pre.start, ranges.pre.end),
          rollout: getDaysBetweenInclusive(ranges.rollout.start, ranges.rollout.end),
          post: getDaysBetweenInclusive(ranges.post.start, ranges.post.end),
        };
        const sitesToAnalyze =
          selectedPortfolioSites.length > 0
            ? gscSites.filter((site) => selectedPortfolioSites.includes(site.siteUrl))
            : gscSites;
        const perSite: PortfolioPropertyRow[] = [];
        const skippedSites: Array<{ siteUrl: string; reason: string }> = [];

        for (let i = 0; i < sitesToAnalyze.length; i += PORTFOLIO_BATCH_SIZE) {
          const batch = sitesToAnalyze.slice(i, i + PORTFOLIO_BATCH_SIZE);
          setPortfolioStatus(
            `Analizando portfolio: ${Math.min(i + batch.length, sitesToAnalyze.length)}/${sitesToAnalyze.length} propiedades`,
          );

          const batchResults = await Promise.all(
            batch.map(async (site) => {
              try {
                const [preQuery, rolloutQuery, postQuery] = await Promise.all([
                  getGSCQueryData(gscAccessToken, site.siteUrl, ranges.pre.start, ranges.pre.end, GSC_ANALYSIS_PAGE_SIZE, {
                    searchType: filters.searchType,
                    dimensionFilterGroups,
                    maxPages: GSC_ANALYSIS_MAX_PAGES,
                    maxRows: GSC_ANALYSIS_MAX_ROWS,
                  }),
                  getGSCQueryData(
                    gscAccessToken,
                    site.siteUrl,
                    ranges.rollout.start,
                    ranges.rollout.end,
                    GSC_ANALYSIS_PAGE_SIZE,
                    {
                      searchType: filters.searchType,
                      dimensionFilterGroups,
                      maxPages: GSC_ANALYSIS_MAX_PAGES,
                      maxRows: GSC_ANALYSIS_MAX_ROWS,
                    },
                  ),
                  getGSCQueryData(gscAccessToken, site.siteUrl, ranges.post.start, ranges.post.end, GSC_ANALYSIS_PAGE_SIZE, {
                    searchType: filters.searchType,
                    dimensionFilterGroups,
                    maxPages: GSC_ANALYSIS_MAX_PAGES,
                    maxRows: GSC_ANALYSIS_MAX_ROWS,
                  }),
                ]);

                const mergedRows = mergePeriods(
                  aggregateByKey(preQuery, 0),
                  aggregateByKey(rolloutQuery, 0),
                  aggregateByKey(postQuery, 0),
                );
                const brandRows = mergedRows.filter((row) => isBrandQuery(row.label, brandTerms));
                const nonBrandRows = mergedRows.filter((row) => !isBrandQuery(row.label, brandTerms));
                const totalSummary = summarizeRows(mergedRows, days);
                const brandSummary = summarizeRows(brandRows, days);
                const nonBrandSummary = summarizeRows(nonBrandRows, days);

                return buildPortfolioPropertyRow({
                  property: site.siteUrl,
                  total: totalSummary,
                  brand: brandSummary,
                  nonBrand: nonBrandSummary,
                });
              } catch (error) {
                const reason = error instanceof Error ? error.message : 'Error no identificado desde Search Console.';
                skippedSites.push({ siteUrl: site.siteUrl, reason });
                console.warn('[GSC Impact] Se omite propiedad en portfolio por error:', site.siteUrl, reason);
                return null;
              }
            }),
          );
          perSite.push(...batchResults.filter((row): row is PortfolioPropertyRow => row !== null));
        }

        setPortfolioRows(perSite);
        if (skippedSites.length > 0) {
          setPortfolioStatus(
            `Portfolio completado: ${perSite.length} propiedades analizadas, ${skippedSites.length} omitidas por permisos u otros errores.`,
          );
        } else {
          setPortfolioStatus(`Portfolio completado: ${perSite.length} propiedades analizadas.`);
        }
      } catch (error) {
        setPortfolioError(
          error instanceof Error ? error.message : 'No se pudo cargar el análisis multi-site desde Search Console.',
        );
        setPortfolioRows([]);
        setPortfolioStatus(null);
      } finally {
        setLoadingPortfolio(false);
      }
    };

    void fetchPortfolioImpact();
  }, [
    brandTerms,
    dimensionFilterGroups,
    filters.searchType,
    gscAccessToken,
    gscSites,
    periodRangeErrors,
    ranges.post.end,
    ranges.post.start,
    ranges.pre.end,
    ranges.pre.start,
    ranges.rollout.end,
    ranges.rollout.start,
    refreshTick,
    selectedPortfolioSites,
    viewMode,
  ]);

  const windowDays = useMemo(
    () => ({
      pre: getDaysBetweenInclusive(ranges.pre.start, ranges.pre.end),
      rollout: getDaysBetweenInclusive(ranges.rollout.start, ranges.rollout.end),
      post: getDaysBetweenInclusive(ranges.post.start, ranges.post.end),
    }),
    [ranges.post.end, ranges.post.start, ranges.pre.end, ranges.pre.start, ranges.rollout.end, ranges.rollout.start],
  );

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

  const scoredQueryRows = useMemo(
    () => scoreImpactRows(filteredQueryRows, { minImpressions: filters.minImpressions, minClicks: filters.minClicks }),
    [filteredQueryRows, filters.minClicks, filters.minImpressions],
  );
  const scoredUrlRows = useMemo(
    () => scoreImpactRows(filteredUrlRows, { minImpressions: filters.minImpressions, minClicks: filters.minClicks }),
    [filteredUrlRows, filters.minClicks, filters.minImpressions],
  );

  const topQueryWinners = useMemo(
    () => [...scoredQueryRows].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, displayLimit),
    [displayLimit, scoredQueryRows],
  );
  const topQueryLosers = useMemo(
    () => [...scoredQueryRows].sort((a, b) => b.impactScore - a.impactScore).slice(0, displayLimit),
    [displayLimit, scoredQueryRows],
  );
  const topUrlWinners = useMemo(
    () => [...scoredUrlRows].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, displayLimit),
    [displayLimit, scoredUrlRows],
  );
  const topUrlLosers = useMemo(
    () => [...scoredUrlRows].sort((a, b) => b.impactScore - a.impactScore).slice(0, displayLimit),
    [displayLimit, scoredUrlRows],
  );
  const topCtrDeterioration = useMemo(
    () => [...scoredUrlRows].sort((a, b) => b.ctrDeteriorationScore - a.ctrDeteriorationScore).slice(0, displayLimit),
    [displayLimit, scoredUrlRows],
  );

  const sampledAffectedUrls = useMemo(
    () =>
      filteredUrlRows
        .map(toSampleRow)
        .filter((row) => row.clickDelta < 0 || row.impressionDelta < 0 || row.positionDelta > 0 || row.ctrDelta < 0)
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, displayLimit),
    [displayLimit, filteredUrlRows],
  );
  const sampledUrlsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(sampledAffectedUrls.length / RESULTS_PAGE_SIZE)),
    [sampledAffectedUrls.length],
  );
  const pagedSampledAffectedUrls = useMemo(() => {
    const page = Math.min(sampledUrlsPage, sampledUrlsTotalPages);
    const start = (page - 1) * RESULTS_PAGE_SIZE;
    return sampledAffectedUrls.slice(start, start + RESULTS_PAGE_SIZE);
  }, [sampledAffectedUrls, sampledUrlsPage, sampledUrlsTotalPages]);

  const globalSummary = useMemo(() => summarizeRows(filteredUrlRows, windowDays), [filteredUrlRows, windowDays]);
  const queryBrandSplit = useMemo(() => {
    const brand = filteredQueryRows.filter((row) => isBrandQuery(row.label, brandTerms));
    const nonBrand = filteredQueryRows.filter((row) => !isBrandQuery(row.label, brandTerms));
    return { brand, nonBrand };
  }, [brandTerms, filteredQueryRows]);
  const brandSummary = useMemo(() => summarizeRows(queryBrandSplit.brand, windowDays), [queryBrandSplit.brand, windowDays]);
  const nonBrandSummary = useMemo(
    () => summarizeRows(queryBrandSplit.nonBrand, windowDays),
    [queryBrandSplit.nonBrand, windowDays],
  );

  const executiveInterpretation = useMemo(() => {
    const notes: string[] = [];
    if (globalSummary.postVsPre.impressionsPerDay.absolute > 0 && globalSummary.postVsPre.clicksPerDay.absolute < 0) {
      notes.push('Impresiones/día al alza con clics/día a la baja: probable caída de CTR o cambio en mix de queries.');
    }
    if (brandSummary.postVsPre.clicksPerDay.absolute < -Math.max(1, Math.abs(nonBrandSummary.postVsPre.clicksPerDay.absolute))) {
      notes.push('La caída está más concentrada en brand que en non-brand: revisar branded SERP y home.');
    }
    if (globalSummary.rollout.clicksPerDay < globalSummary.pre.clicksPerDay && globalSummary.post.clicksPerDay > globalSummary.rollout.clicksPerDay) {
      notes.push('Rollout con caída y recuperación parcial post: patrón compatible con efecto temporal del despliegue.');
    }
    if (globalSummary.postVsPre.position.absolute > 0.5) {
      notes.push('El empeoramiento de posición media sugiere pérdida de visibilidad estructural.');
    }
    if (notes.length === 0) {
      notes.push('Sin señal dominante única: revisar patrones detectados y segmentaciones para confirmar hipótesis.');
    }
    return notes.slice(0, 3);
  }, [brandSummary.postVsPre.clicksPerDay.absolute, globalSummary, nonBrandSummary.postVsPre.clicksPerDay.absolute]);

  const breakdownFromRows = (rows: (ImpactRow & { template?: string })[], getBucket: (row: ImpactRow & { template?: string }) => string) => {
    const map = new Map<string, ImpactRow[]>();
    rows.forEach((row) => {
      const bucket = getBucket(row) || 'Sin dato';
      const current = map.get(bucket) || [];
      current.push(row);
      map.set(bucket, current);
    });
    return Array.from(map.entries())
      .map(([bucket, groupedRows]) => ({ bucket, summary: summarizeRows(groupedRows, windowDays) }))
      .sort((a, b) => (a.summary.postVsPre.clicksPerDay.absolute - b.summary.postVsPre.clicksPerDay.absolute));
  };

  const directoryBreakdown = useMemo(() => breakdownFromRows(filteredUrlRows, (row) => {
    try {
      const url = new URL(row.key);
      const first = url.pathname.split('/').filter(Boolean)[0];
      return first ? `/${first}/` : '/';
    } catch {
      return 'Sin dato';
    }
  }), [filteredUrlRows, windowDays]);
  const templateBreakdown = useMemo(() => breakdownFromRows(filteredUrlRows, (row) => row.template || 'Sin template'), [filteredUrlRows, windowDays]);
  const languageBreakdown = useMemo(() => breakdownFromRows(filteredUrlRows, (row) => inferLanguagePrefix(row.key)), [filteredUrlRows, windowDays]);
  const pageTypeBreakdown = useMemo(() => breakdownFromRows(filteredUrlRows, (row) => inferPageType(row.key)), [filteredUrlRows, windowDays]);
  const deviceBreakdown = useMemo(() => breakdownFromRows(deviceRows, (row) => row.key), [deviceRows, windowDays]);
  const countryBreakdown = useMemo(() => breakdownFromRows(countryRows, (row) => row.key), [countryRows, windowDays]);

  const patternSignals = useMemo(() => {
    const clicksSeries = timeSeriesRows.map((row) => row.clicks);
    const mean = clicksSeries.reduce((sum, value) => sum + value, 0) / Math.max(1, clicksSeries.length);
    const variance = clicksSeries.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, clicksSeries.length);
    const volatility = mean > 0 ? Math.sqrt(variance) / mean : 0;
    return detectPatternSignals({
      global: globalSummary,
      brand: brandSummary,
      nonBrand: nonBrandSummary,
      rolloutVolatility: volatility,
      topNegativeDirectory: directoryBreakdown[0]?.bucket,
      topNegativeCountry: countryBreakdown[0]?.bucket,
      topNegativeDevice: deviceBreakdown[0]?.bucket,
    });
  }, [brandSummary, countryBreakdown, deviceBreakdown, directoryBreakdown, globalSummary, nonBrandSummary, timeSeriesRows]);

  const timelineData = useMemo(
    () =>
      timeSeriesRows
        .map((row) => ({
          date: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: Number((row.ctr * 100).toFixed(2)),
          position: Number(row.position.toFixed(2)),
          phase:
            row.keys[0] < ranges.rollout.start
              ? 'pre'
              : row.keys[0] <= ranges.rollout.end
                ? 'rollout'
                : 'post',
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [ranges.rollout.end, ranges.rollout.start, timeSeriesRows],
  );

  const filteredPortfolioRows = useMemo(() => {
    return portfolioRows.filter((row) => {
      if (!globalFilters.includeBrandInTotals && row.nonBrandDeltaClicksPerDay === 0) return false;
      if (row.preClicksPerDay < globalFilters.minimumDailyClicks) return false;
      if (globalFilters.onlyNegative && row.postClicksPerDay >= row.preClicksPerDay) return false;
      if (globalFilters.onlyUrgent && row.status !== 'urgente') return false;
      return true;
    });
  }, [globalFilters, portfolioRows]);

  const sortedPortfolioRows = useMemo(
    () => sortPortfolioRows(filteredPortfolioRows, globalFilters.sortBy),
    [filteredPortfolioRows, globalFilters.sortBy],
  );
  const portfolioTableTotalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedPortfolioRows.length / RESULTS_PAGE_SIZE)),
    [sortedPortfolioRows.length],
  );
  const pagedPortfolioRows = useMemo(() => {
    const page = Math.min(portfolioTablePage, portfolioTableTotalPages);
    const start = (page - 1) * RESULTS_PAGE_SIZE;
    return sortedPortfolioRows.slice(start, start + RESULTS_PAGE_SIZE);
  }, [portfolioTablePage, portfolioTableTotalPages, sortedPortfolioRows]);
  const portfolioCounts = useMemo(() => summarizePortfolioStatusCounts(filteredPortfolioRows), [filteredPortfolioRows]);
  const portfolioSignals = useMemo(() => detectPortfolioPatterns(filteredPortfolioRows), [filteredPortfolioRows]);
  const portfolioSummaryText = useMemo(
    () => buildPortfolioExecutiveSummaryText(filteredPortfolioRows),
    [filteredPortfolioRows],
  );
  const portfolioExecutiveSummary = useMemo(
    () => buildPortfolioExecutiveSummary(filteredPortfolioRows),
    [filteredPortfolioRows],
  );
  const portfolioRowsForExport = useMemo(() => {
    if (selectedPortfolioSites.length === 0) return sortedPortfolioRows;
    const selectedSet = new Set(selectedPortfolioSites);
    return sortedPortfolioRows.filter((row) => selectedSet.has(row.property));
  }, [selectedPortfolioSites, sortedPortfolioRows]);

  const topPortfolioImprovers = useMemo(
    () =>
      [...sortedPortfolioRows]
        .sort((a, b) => b.postClicksPerDay - b.preClicksPerDay - (a.postClicksPerDay - a.preClicksPerDay))
        .slice(0, 5),
    [sortedPortfolioRows],
  );
  const topPortfolioDeclines = useMemo(
    () => [...sortedPortfolioRows].sort((a, b) => a.postClicksPerDay - a.preClicksPerDay - (b.postClicksPerDay - b.preClicksPerDay)).slice(0, 5),
    [sortedPortfolioRows],
  );
  const urgentPortfolioRows = useMemo(
    () => sortedPortfolioRows.filter((row) => row.status === 'urgente').slice(0, 5),
    [sortedPortfolioRows],
  );
  const anomalousPortfolioRows = useMemo(
    () =>
      sortedPortfolioRows
        .filter((row) => row.quality !== 'ok' || row.consistencyScore >= 4)
        .slice(0, 5),
    [sortedPortfolioRows],
  );
  const prioritizedPortfolioRows = useMemo(() => sortedPortfolioRows.slice(0, 8), [sortedPortfolioRows]);

  const createPortfolioTask = (row: PortfolioPropertyRow) => {
    const deltaClicksDay = row.postClicksPerDay - row.preClicksPerDay;
    const sector = currentClient?.sector?.trim() || 'Genérico';
    const projectType = currentClient?.projectType || 'MEDIA';
    const urgencyTag = row.status === 'urgente' ? 'Urgente' : row.status === 'riesgo' ? 'Riesgo' : 'Atención';

    addTask(
      1,
      `[Portfolio GSC][${urgencyTag}] Revisar ${row.property}`,
      `Prioridad portfolio (${projectType} · ${sector}): validar caída ${deltaClicksDay.toFixed(2)} clicks/día, non-brand ${row.nonBrandDeltaClicksPerDay.toFixed(2)} y ΔCTR ${(row.deltaCtr * 100).toFixed(2)}pp en ${row.property}.`,
      row.status === 'urgente' || row.status === 'riesgo' ? 'High' : 'Medium',
      'GSC',
      {
        isInCustomRoadmap: true,
        insightSourceMeta: {
          insightId: `gsc-portfolio-${row.property}`,
          sourceType: 'gsc_portfolio_property',
          sourceLabel: 'Impacto GSC Portfolio',
          moduleId: 1,
          metricsSnapshot: {
            deltaClicksPerDay: Number(deltaClicksDay.toFixed(2)),
            deltaCtrPp: Number((row.deltaCtr * 100).toFixed(2)),
            deltaPosition: Number(row.deltaPosition.toFixed(2)),
            nonBrandDeltaClicksPerDay: Number(row.nonBrandDeltaClicksPerDay.toFixed(2)),
            urgencyScore: Number(row.urgencyScore.toFixed(2)),
            riskScore: Number(row.riskScore.toFixed(2)),
          },
          periodContext: {
            current: `${ranges.post.start}..${ranges.post.end}`,
            previous: `${ranges.pre.start}..${ranges.pre.end}`,
          },
          property: row.property,
          url: row.property,
          timestamp: Date.now(),
        },
      },
    );
    setPortfolioStatus(`Tarea creada para ${row.property} y añadida al roadmap.`);
  };

  useEffect(() => {
    GscImpactSegmentationRepository.saveUseCustomRulesByClientId(currentClientId, useCustomRules);
  }, [currentClientId, useCustomRules]);

  useEffect(() => {
    setSampledUrlsPage(1);
  }, [displayLimit, filteredUrlRows, viewMode]);

  useEffect(() => {
    setPortfolioTablePage(1);
  }, [globalFilters, selectedPortfolioSites, sortedPortfolioRows.length, viewMode]);

  const exportIndividualDataset = () => {
    const workbook = XLSX.utils.book_new();

    const summaryRows = [
      {
        analysis_mode: 'solo_search_console_sin_ga4',
        exported_at: new Date().toISOString(),
        property: selectedSite,
        search_type: filters.searchType,
        device_filter: filters.device,
        country_filter: filters.country || 'all',
        segment_filter: filters.segmentFilter,
        min_impressions: filters.minImpressions,
        min_clicks: filters.minClicks,
        path_prefix: filters.pathPrefix || 'all',
        template_filter: filters.selectedTemplate,
        use_custom_rules: useCustomRules,
        pre_start: ranges.pre.start,
        pre_end: ranges.pre.end,
        rollout_start: ranges.rollout.start,
        rollout_end: ranges.rollout.end,
        post_start: ranges.post.start,
        post_end: ranges.post.end,
        total_urls_analyzed: scoredUrlRows.length,
        total_queries_analyzed: scoredQueryRows.length,
      },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumen');

    const urlRows = scoredUrlRows.map((row) => ({
      url: row.key,
      template: row.template || 'Sin template',
      pre_clicks: row.preClicks,
      rollout_clicks: row.rolloutClicks,
      post_clicks: row.postClicks,
      pre_impressions: row.preImpressions,
      rollout_impressions: row.rolloutImpressions,
      post_impressions: row.postImpressions,
      pre_position: row.prePosition,
      rollout_position: row.rolloutPosition,
      post_position: row.postPosition,
      pre_ctr: row.preCtr,
      post_ctr: row.postCtr,
      delta_clicks: row.deltaClicks,
      delta_clicks_pct: safePctString(row.deltaClicksPct),
      delta_impressions: row.postImpressions - row.preImpressions,
      delta_impressions_pct: safePctString(safePctDelta(row.postImpressions, row.preImpressions)),
      delta_ctr: row.deltaCtr,
      delta_position: row.deltaPosition,
      impact_score: row.impactScore,
      opportunity_score: row.opportunityScore,
      ctr_deterioration_score: row.ctrDeteriorationScore,
      source: row.source,
      rule_id: row.ruleId,
      rule_type: row.ruleType,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(urlRows), 'URLs');

    const queryRows = scoredQueryRows.map((row) => ({
      query: row.label,
      pre_clicks: row.preClicks,
      rollout_clicks: row.rolloutClicks,
      post_clicks: row.postClicks,
      pre_impressions: row.preImpressions,
      rollout_impressions: row.rolloutImpressions,
      post_impressions: row.postImpressions,
      pre_position: row.prePosition,
      rollout_position: row.rolloutPosition,
      post_position: row.postPosition,
      pre_ctr: row.preCtr,
      post_ctr: row.postCtr,
      delta_clicks: row.deltaClicks,
      delta_clicks_pct: safePctString(row.deltaClicksPct),
      delta_impressions: row.postImpressions - row.preImpressions,
      delta_impressions_pct: safePctString(safePctDelta(row.postImpressions, row.preImpressions)),
      delta_ctr: row.deltaCtr,
      delta_position: row.deltaPosition,
      impact_score: row.impactScore,
      opportunity_score: row.opportunityScore,
      ctr_deterioration_score: row.ctrDeteriorationScore,
      source: row.source,
      rule_id: row.ruleId,
      rule_type: row.ruleType,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(queryRows), 'Queries');

    const timelineRows = timelineData.map((row) => ({
      date: row.date,
      phase: row.phase,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr_pct: row.ctr,
      position: row.position,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(timelineRows), 'Timeline');

    const breakdownBlocks = [
      { category: 'directory', rows: directoryBreakdown },
      { category: 'template', rows: templateBreakdown },
      { category: 'device', rows: deviceBreakdown },
      { category: 'country', rows: countryBreakdown },
      { category: 'language_prefix', rows: languageBreakdown },
      { category: 'page_type', rows: pageTypeBreakdown },
    ];
    const breakdownRows = breakdownBlocks.flatMap((block) =>
      block.rows.map((row) => ({
        category: block.category,
        bucket: row.bucket,
        pre_clicks_day: row.summary.pre.clicksPerDay,
        post_clicks_day: row.summary.post.clicksPerDay,
        delta_clicks_day: row.summary.postVsPre.clicksPerDay.absolute,
        pre_impressions_day: row.summary.pre.impressionsPerDay,
        post_impressions_day: row.summary.post.impressionsPerDay,
        delta_impressions_day: row.summary.postVsPre.impressionsPerDay.absolute,
        pre_ctr: row.summary.pre.ctr,
        post_ctr: row.summary.post.ctr,
        delta_ctr: row.summary.postVsPre.ctr.absolute,
        pre_position: row.summary.pre.position,
        post_position: row.summary.post.position,
        delta_position: row.summary.postVsPre.position.absolute,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(breakdownRows), 'Segmentacion');

    const signalRows = patternSignals.map((signal) => ({
      id: signal.id,
      title: signal.title,
      detail: signal.detail,
      confidence: signal.confidence,
      priority: signal.priority,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(signalRows), 'Patrones');

    XLSX.writeFile(workbook, `gsc_impact_individual_full_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPortfolioDataset = () => {
    const rows = portfolioRowsForExport.map((row) => [
      row.property,
      row.preClicks,
      row.rolloutClicks,
      row.postClicks,
      row.preClicksPerDay,
      row.postClicksPerDay,
      row.deltaClicks,
      row.deltaClicksPct,
      row.preImpressions,
      row.postImpressions,
      row.preImpressionsPerDay,
      row.postImpressionsPerDay,
      row.preCtr,
      row.postCtr,
      row.deltaCtr,
      row.prePosition,
      row.postPosition,
      row.deltaPosition,
      row.brandDeltaClicksPerDay,
      row.nonBrandDeltaClicksPerDay,
      row.riskScore,
      row.status,
      row.quality,
      row.qualityReason,
      row.consistencyScore,
    ]);
    downloadCsv(
      `gsc_impact_portfolio_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'property',
        'pre_clicks',
        'rollout_clicks',
        'post_clicks',
        'pre_clicks_day',
        'post_clicks_day',
        'delta_clicks',
        'delta_clicks_pct',
        'pre_impressions',
        'post_impressions',
        'pre_impressions_day',
        'post_impressions_day',
        'pre_ctr',
        'post_ctr',
        'delta_ctr',
        'pre_position',
        'post_position',
        'delta_position',
        'brand_delta_clicks_day',
        'non_brand_delta_clicks_day',
        'risk_score',
        'status',
        'quality',
        'quality_reason',
        'consistency_score',
      ],
      rows,
    );
  };

  const exportPortfolioByPropertyDataset = () => {
    const workbook = XLSX.utils.book_new();
    const summaryRows = portfolioRowsForExport.map((row) => ({
      property: row.property,
      pre_clicks: row.preClicks,
      rollout_clicks: row.rolloutClicks,
      post_clicks: row.postClicks,
      pre_clicks_day: row.preClicksPerDay,
      post_clicks_day: row.postClicksPerDay,
      delta_clicks: row.deltaClicks,
      delta_clicks_pct: row.deltaClicksPct,
      pre_impressions: row.preImpressions,
      post_impressions: row.postImpressions,
      pre_impressions_day: row.preImpressionsPerDay,
      post_impressions_day: row.postImpressionsPerDay,
      pre_ctr: row.preCtr,
      post_ctr: row.postCtr,
      delta_ctr: row.deltaCtr,
      pre_position: row.prePosition,
      post_position: row.postPosition,
      delta_position: row.deltaPosition,
      brand_delta_clicks_day: row.brandDeltaClicksPerDay,
      non_brand_delta_clicks_day: row.nonBrandDeltaClicksPerDay,
      risk_score: row.riskScore,
      status: row.status,
      quality: row.quality,
      quality_reason: row.qualityReason,
      consistency_score: row.consistencyScore,
    }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumen');
    portfolioRowsForExport.forEach((row) => {
      const sheetName = row.property.replace(/[^a-z0-9]/gi, '_').slice(0, 31) || 'property';
      const rowSheet = summaryRows.filter((item) => item.property === row.property);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rowSheet), sheetName);
    });

    XLSX.writeFile(
      workbook,
      `gsc_impact_portfolio_individual_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="metric-label">Vista</label>
                <select
                  className="form-control"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ImpactViewMode)}
                >
                  <option value="individual">Impacto GSC por rollout (propiedad)</option>
                  <option value="global">Impacto global GSC (portfolio)</option>
                </select>
              </div>
              {viewMode === 'global' && (
                <>
                  <div>
                    <label className="metric-label">Orden portfolio</label>
                    <select
                      className="form-control"
                      value={globalFilters.sortBy}
                      onChange={(e) =>
                        setGlobalFilters((prev) => ({ ...prev, sortBy: e.target.value as PortfolioSortKey }))
                      }
                    >
                      <option value="risk">Riesgo/prioridad</option>
                      <option value="urgency">Urgencia</option>
                      <option value="delta_clicks_day">Delta clicks/day</option>
                      <option value="delta_position">Delta posición</option>
                      <option value="delta_non_brand">Delta non-brand</option>
                      <option value="delta_ctr">Delta CTR</option>
                      <option value="volume_affected">Volumen afectado</option>
                    </select>
                  </div>
                  <div>
                    <label className="metric-label">Volumen mínimo (clicks/day pre)</label>
                    <input
                      className="form-control"
                      type="number"
                      min={0}
                      value={globalFilters.minimumDailyClicks}
                      onChange={(e) =>
                        setGlobalFilters((prev) => ({ ...prev, minimumDailyClicks: Number(e.target.value) || 0 }))
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="metric-label">Resultados visibles (Top N)</label>
                <select
                  className="form-control"
                  value={displayLimit}
                  onChange={(e) => setDisplayLimit(Number(e.target.value) || 1000)}
                >
                  {DISPLAY_LIMIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="surface-subtle p-2 text-sm md:col-span-2">
                <p>
                  Extracción por periodo: hasta {GSC_ANALYSIS_MAX_ROWS.toLocaleString('es-ES')} filas de GSC (paginado de {GSC_ANALYSIS_PAGE_SIZE.toLocaleString('es-ES')}).
                  Puedes exportar todo lo cargado a CSV para abrirlo en Google Sheets.
                </p>
              </div>
            </div>

            {viewMode === 'global' && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="surface-subtle flex items-center gap-2 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={globalFilters.includeBrandInTotals}
                    onChange={(e) =>
                      setGlobalFilters((prev) => ({ ...prev, includeBrandInTotals: e.target.checked }))
                    }
                  />
                  Incluir brand en lectura total
                </label>
                <label className="surface-subtle flex items-center gap-2 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={globalFilters.onlyNegative}
                    onChange={(e) => setGlobalFilters((prev) => ({ ...prev, onlyNegative: e.target.checked }))}
                  />
                  Solo propiedades con caída
                </label>
                <label className="surface-subtle flex items-center gap-2 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={globalFilters.onlyUrgent}
                    onChange={(e) => setGlobalFilters((prev) => ({ ...prev, onlyUrgent: e.target.checked }))}
                  />
                  Solo urgentes
                </label>
                <div className="surface-subtle p-2 text-sm">
                  <p className="font-semibold">Cobertura portfolio</p>
                  <p>
                    {filteredPortfolioRows.length}/{portfolioRows.length} propiedades mostradas
                  </p>
                </div>
              </div>
            )}

            {viewMode === 'global' && (
              <>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div className="surface-subtle p-3 text-sm lg:col-span-2">
                    <label className="metric-label">Portfolios a analizar (opcional)</label>
                    <Input
                      value={portfolioSiteSearch}
                      onChange={(e) => setPortfolioSiteSearch(e.target.value)}
                      placeholder="Buscar propiedad para seleccionar"
                    />
                    <select
                      className="form-control mt-2 min-h-[180px]"
                      multiple
                      value={selectedPortfolioSites}
                      onChange={(e) =>
                        handlePortfolioSitesSelectionChange(
                          Array.from(e.target.selectedOptions, (option) => option.value),
                        )
                      }
                    >
                      {filteredPortfolioSites.map((site) => (
                        <option key={site.siteUrl} value={site.siteUrl}>
                          {site.siteUrl}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-muted">
                      Si no seleccionas ninguna propiedad, se analiza todo el portfolio.
                    </p>
                  </div>
                  <div className="surface-subtle p-3 text-sm">
                    <p className="font-semibold">Selección actual</p>
                    <p className="mt-1">
                      {selectedPortfolioSites.length === 0
                        ? `Todas (${gscSites.length})`
                        : `${selectedPortfolioSites.length} propiedades`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setSelectedPortfolioSites(filteredPortfolioSites.map((site) => site.siteUrl))
                        }
                        disabled={filteredPortfolioSites.length === 0}
                      >
                        Seleccionar visibles
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedPortfolioSites([])}
                        disabled={selectedPortfolioSites.length === 0}
                      >
                        Limpiar selección
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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
                  <div className="surface-subtle p-3 text-sm md:col-span-2">
                    <p className="font-semibold">Ventanas del análisis portfolio</p>
                    <p>
                      Ajusta manualmente pre-update, rollout y post-update para evitar solapes o rangos inválidos
                      antes de recalcular el portfolio.
                    </p>
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
                {periodRangeErrors.length > 0 && (
                  <div className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm">
                    <p className="font-semibold">
                      Validación de ventanas: {hasRangeOverlapError ? 'hay solapes detectados' : 'rangos inválidos'}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {periodRangeErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {viewMode === 'global' ? (
            <>
              <section className="surface-panel p-6">
                <h2 className="text-lg font-semibold">Resumen ejecutivo global</h2>
                <p className="section-subtitle">Radar portfolio multi-site para priorizar análisis por propiedad.</p>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6">
                  <div className="metric-chip"><p className="metric-label">Total</p><p className="text-2xl font-bold">{portfolioCounts.total}</p></div>
                  <div className="metric-chip"><p className="metric-label">Mejoran</p><p className="text-2xl font-bold">{portfolioExecutiveSummary.improving}</p></div>
                  <div className="metric-chip"><p className="metric-label">Empeoran</p><p className="text-2xl font-bold">{portfolioExecutiveSummary.worsening}</p></div>
                  <div className="metric-chip"><p className="metric-label">Urgentes</p><p className="text-2xl font-bold">{portfolioExecutiveSummary.urgent}</p></div>
                  <div className="metric-chip"><p className="metric-label">Anomalías</p><p className="text-2xl font-bold">{portfolioExecutiveSummary.anomalies}</p></div>
                  <div className="metric-chip"><p className="metric-label">Baja confianza</p><p className="text-2xl font-bold">{portfolioExecutiveSummary.lowConfidence}</p></div>
                </div>
                <div className="mt-3 surface-subtle p-3 text-sm">
                  <ul className="list-disc space-y-1 pl-5">
                    {portfolioSummaryText.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                    {portfolioExecutiveSummary.bestImprovement && (
                      <li>
                        Mejor mejora: {portfolioExecutiveSummary.bestImprovement.property} (Δ/day{' '}
                        {(portfolioExecutiveSummary.bestImprovement.postClicksPerDay - portfolioExecutiveSummary.bestImprovement.preClicksPerDay).toFixed(2)}).
                      </li>
                    )}
                    {portfolioExecutiveSummary.worstDecline && (
                      <li>
                        Peor caída: {portfolioExecutiveSummary.worstDecline.property} (Δ/day{' '}
                        {(portfolioExecutiveSummary.worstDecline.postClicksPerDay - portfolioExecutiveSummary.worstDecline.preClicksPerDay).toFixed(2)}).
                      </li>
                    )}
                  </ul>
                </div>
                {(loadingPortfolio || isLoadingGsc) && <div className="mt-3"><Spinner size={18} /></div>}
                {portfolioStatus && <p className="mt-2 text-sm text-muted">{portfolioStatus}</p>}
                {portfolioError && <p className="mt-2 text-sm text-danger">{portfolioError}</p>}
              </section>

              <section className="surface-panel p-6">
                <h3 className="text-lg font-semibold">Patrones detectados (portfolio)</h3>
                <div className="mt-3 space-y-2">
                  {portfolioSignals.map((signal) => (
                    <div key={signal.id} className="surface-subtle p-3 text-sm">
                      <p className="font-semibold">{signal.title} <span className="text-xs text-muted">(confianza: {signal.confidence})</span></p>
                      <p>{signal.detail}</p>
                    </div>
                  ))}
                  {portfolioSignals.length === 0 && <p className="text-sm text-muted">Sin patrones agregados robustos con la muestra actual.</p>}
                </div>
              </section>

              <section className="surface-panel p-6">
                <h3 className="text-lg font-semibold">Propiedades prioritarias</h3>
                <p className="section-subtitle">Bloque accionable para pasar de análisis a decisión y ejecución en roadmap.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-4">
                  <Card className="p-3"><p className="font-semibold">Top mejora</p>{topPortfolioImprovers.map((row) => <p key={`imp-${row.property}`} className="mt-2 text-sm">{row.property} · Δ/day {(row.postClicksPerDay - row.preClicksPerDay).toFixed(2)}</p>)}</Card>
                  <Card className="p-3"><p className="font-semibold">Top caída</p>{topPortfolioDeclines.map((row) => <p key={`dec-${row.property}`} className="mt-2 text-sm">{row.property} · Δ/day {(row.postClicksPerDay - row.preClicksPerDay).toFixed(2)}</p>)}</Card>
                  <Card className="p-3"><p className="font-semibold">Urgentes</p>{urgentPortfolioRows.map((row) => <p key={`urg-${row.property}`} className="mt-2 text-sm">{row.property} · score {row.riskScore.toFixed(1)}</p>)}{urgentPortfolioRows.length === 0 && <p className="mt-2 text-sm text-muted">Sin urgentes.</p>}</Card>
                  <Card className="p-3"><p className="font-semibold">Anomalías / baja confianza</p>{anomalousPortfolioRows.map((row) => <p key={`ano-${row.property}`} className="mt-2 text-sm">{row.property} · {row.qualityReason}</p>)}{anomalousPortfolioRows.length === 0 && <p className="mt-2 text-sm text-muted">Sin anomalías relevantes.</p>}</Card>
                </div>
                <div className="mt-3 space-y-2">
                  {prioritizedPortfolioRows.map((row) => (
                    <div key={`priority-${row.property}`} className="surface-subtle flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                      <div>
                        <p className="font-semibold">{row.property}</p>
                        <p className="text-muted">
                          Urgencia {row.urgencyScore.toFixed(1)} · Δ/day {(row.postClicksPerDay - row.preClicksPerDay).toFixed(2)} · Non-brand Δ/day {row.nonBrandDeltaClicksPerDay.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => createPortfolioTask(row)}>
                          Crear tarea roadmap
                        </Button>
                        <Button variant="ghost" onClick={() => { setSelectedSite(row.property); setViewMode('individual'); }}>
                          Abrir propiedad
                        </Button>
                      </div>
                    </div>
                  ))}
                  {prioritizedPortfolioRows.length === 0 && <p className="text-sm text-muted">Sin propiedades prioritarias con los filtros actuales.</p>}
                </div>
              </section>

              <section className="surface-panel p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Tabla principal de propiedades</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={exportPortfolioDataset} disabled={portfolioRowsForExport.length === 0}>
                      Exportar portfolio (CSV/Sheets)
                    </Button>
                    <Button variant="secondary" onClick={exportPortfolioByPropertyDataset} disabled={portfolioRowsForExport.length === 0}>
                      Exportar por propiedad (XLSX)
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Se exportan {portfolioRowsForExport.length} propiedades
                  {selectedPortfolioSites.length > 0 ? ' (según selección actual).' : ' (todas las visibles tras filtros).'}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="px-2 py-2">Propiedad</th><th className="px-2 py-2">Clicks pre</th><th className="px-2 py-2">Rollout</th><th className="px-2 py-2">Clicks post</th><th className="px-2 py-2">Clicks/day pre</th><th className="px-2 py-2">Clicks/day post</th><th className="px-2 py-2">Δ clicks</th><th className="px-2 py-2">Δ clicks %</th><th className="px-2 py-2">Imp pre</th><th className="px-2 py-2">Imp post</th><th className="px-2 py-2">Imp/day pre</th><th className="px-2 py-2">Imp/day post</th><th className="px-2 py-2">CTR pre</th><th className="px-2 py-2">CTR post</th><th className="px-2 py-2">Δ CTR</th><th className="px-2 py-2">Pos pre</th><th className="px-2 py-2">Pos post</th><th className="px-2 py-2">Δ pos</th><th className="px-2 py-2">Brand Δ/day</th><th className="px-2 py-2">Non-brand Δ/day</th><th className="px-2 py-2">Riesgo</th><th className="px-2 py-2">Urgencia</th><th className="px-2 py-2">Estado</th><th className="px-2 py-2">Calidad</th><th className="px-2 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedPortfolioRows.map((row) => (
                        <tr key={row.property} className="border-t border-border/50">
                          <td className="px-2 py-2">{row.property}</td><td className="px-2 py-2">{row.preClicks.toFixed(0)}</td><td className="px-2 py-2">{row.rolloutClicks.toFixed(0)}</td><td className="px-2 py-2">{row.postClicks.toFixed(0)}</td><td className="px-2 py-2">{row.preClicksPerDay.toFixed(2)}</td><td className="px-2 py-2">{row.postClicksPerDay.toFixed(2)}</td><td className="px-2 py-2">{row.deltaClicks.toFixed(0)}</td><td className="px-2 py-2">{row.deltaClicksPct === null ? 'n/a' : `${(row.deltaClicksPct * 100).toFixed(1)}%`}</td><td className="px-2 py-2">{row.preImpressions.toFixed(0)}</td><td className="px-2 py-2">{row.postImpressions.toFixed(0)}</td><td className="px-2 py-2">{row.preImpressionsPerDay.toFixed(2)}</td><td className="px-2 py-2">{row.postImpressionsPerDay.toFixed(2)}</td><td className="px-2 py-2">{(row.preCtr * 100).toFixed(2)}%</td><td className="px-2 py-2">{(row.postCtr * 100).toFixed(2)}%</td><td className="px-2 py-2">{(row.deltaCtr * 100).toFixed(2)}pp</td><td className="px-2 py-2">{row.prePosition.toFixed(2)}</td><td className="px-2 py-2">{row.postPosition.toFixed(2)}</td><td className="px-2 py-2">{row.deltaPosition.toFixed(2)}</td><td className="px-2 py-2">{row.brandDeltaClicksPerDay.toFixed(2)}</td><td className="px-2 py-2">{row.nonBrandDeltaClicksPerDay.toFixed(2)}</td><td className="px-2 py-2">{row.riskScore.toFixed(1)}</td><td className="px-2 py-2">{row.urgencyScore.toFixed(1)}</td>
                          <td className="px-2 py-2"><Badge variant={getPortfolioStatusBadgeVariant(row.status)}>{row.status}</Badge></td>
                          <td className="px-2 py-2"><Badge variant={row.quality === 'ok' ? 'success' : 'warning'}>{row.quality}</Badge></td>
                          <td className="px-2 py-2"><div className="flex gap-2"><Button variant="secondary" onClick={() => { setSelectedSite(row.property); setViewMode('individual'); }}>Abrir</Button><Button variant="ghost" onClick={() => createPortfolioTask(row)}>Tarea</Button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedPortfolioRows.length > RESULTS_PAGE_SIZE && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-muted">
                      Mostrando {pagedPortfolioRows.length} de {sortedPortfolioRows.length} propiedades.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setPortfolioTablePage((prev) => Math.max(1, prev - 1))}
                        disabled={portfolioTablePage <= 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-muted">
                        Página {portfolioTablePage} de {portfolioTableTotalPages}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => setPortfolioTablePage((prev) => Math.min(portfolioTableTotalPages, prev + 1))}
                        disabled={portfolioTablePage >= portfolioTableTotalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : (
          <>
          <section className="surface-panel p-6">
            <h2 className="text-lg font-semibold">Resumen ejecutivo (solo Search Console, sin GA4)</h2>
            <p className="mt-2 text-sm text-muted">
              Comparativa normalizada por día para evitar sesgos por ventanas de distinta duración. Este módulo detecta patrones, no causalidad absoluta.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="metric-chip">
                <p className="metric-label">Clics/día post vs pre</p>
                <p className="text-2xl font-bold">
                  {globalSummary.post.clicksPerDay.toFixed(1)} vs {globalSummary.pre.clicksPerDay.toFixed(1)}
                </p>
                <p className="text-xs text-muted">
                  Δ {globalSummary.postVsPre.clicksPerDay.absolute.toFixed(1)} ·{' '}
                  {globalSummary.postVsPre.clicksPerDay.pct === null
                    ? 'n/a'
                    : `${(globalSummary.postVsPre.clicksPerDay.pct * 100).toFixed(1)}%`}
                </p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">Impresiones/día post vs pre</p>
                <p className="text-2xl font-bold">
                  {globalSummary.post.impressionsPerDay.toFixed(1)} vs {globalSummary.pre.impressionsPerDay.toFixed(1)}
                </p>
                <p className="text-xs text-muted">
                  Δ {globalSummary.postVsPre.impressionsPerDay.absolute.toFixed(1)} ·{' '}
                  {globalSummary.postVsPre.impressionsPerDay.pct === null
                    ? 'n/a'
                    : `${(globalSummary.postVsPre.impressionsPerDay.pct * 100).toFixed(1)}%`}
                </p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">CTR post vs pre</p>
                <p className="text-2xl font-bold">
                  {(globalSummary.post.ctr * 100).toFixed(2)}% vs {(globalSummary.pre.ctr * 100).toFixed(2)}%
                </p>
                <p className="text-xs text-muted">
                  Δ {(globalSummary.postVsPre.ctr.absolute * 100).toFixed(2)} pp ·{' '}
                  {globalSummary.postVsPre.ctr.pct === null ? 'n/a' : `${(globalSummary.postVsPre.ctr.pct * 100).toFixed(1)}%`}
                </p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">Posición media post vs pre</p>
                <p className="text-2xl font-bold">
                  {globalSummary.post.position.toFixed(2)} vs {globalSummary.pre.position.toFixed(2)}
                </p>
                <p className="text-xs text-muted">Δ {globalSummary.postVsPre.position.absolute.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {[
                { label: 'Todo', value: globalSummary },
                { label: 'Brand', value: brandSummary },
                { label: 'Non-brand', value: nonBrandSummary },
              ].map((segment) => (
                <div key={segment.label} className="surface-subtle p-3 text-sm">
                  <p className="font-semibold">{segment.label}</p>
                  <p>
                    Clics/día {segment.value.pre.clicksPerDay.toFixed(1)} → {segment.value.post.clicksPerDay.toFixed(1)} ·
                    CTR {(segment.value.pre.ctr * 100).toFixed(2)}% → {(segment.value.post.ctr * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted">
                    Ventanas: pre {segment.value.pre.days}d · rollout {segment.value.rollout.days}d · post {segment.value.post.days}d
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 surface-subtle p-3 text-sm">
              <p className="font-semibold">Interpretación automática (basada en reglas observables)</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {executiveInterpretation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="surface-panel p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
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
              <div>
                <label className="metric-label">Filtro mínimo clics</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  value={filters.minClicks}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minClicks: Number(e.target.value) || 0 }))}
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
                  directorio/template, device/country/searchType y mínimos de impresiones/clics.
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
              <Button variant="secondary" onClick={exportIndividualDataset} disabled={filteredUrlRows.length === 0}>
                Exportar informe completo (XLSX)
              </Button>
              {(isLoadingGsc || loadingImpact) && <Spinner size={18} />}
            </div>
            {impactError && <p className="mt-2 text-sm text-danger">{impactError}</p>}
          </section>

          <section className="surface-panel p-6">
            <h3 className="text-lg font-semibold">Patrones detectados</h3>
            <p className="section-subtitle">Señales heurísticas priorizadas por impacto probable. No implican causalidad absoluta.</p>
            <div className="mt-3 space-y-2">
              {patternSignals.map((signal) => (
                <div key={signal.id} className="surface-subtle p-3 text-sm">
                  <p className="font-semibold">
                    {signal.title} <span className="text-xs text-muted">(confianza: {signal.confidence})</span>
                  </p>
                  <p>{signal.detail}</p>
                </div>
              ))}
              {patternSignals.length === 0 && <p className="text-sm text-muted">Sin patrones robustos con la muestra actual.</p>}
            </div>
          </section>

          <section className="surface-panel p-6">
            <h3 className="text-lg font-semibold">Evolución temporal diaria</h3>
            <p className="section-subtitle">
              Serie diaria Search Console para validar si la caída coincide con rollout ({ranges.rollout.start} → {ranges.rollout.end}) o venía de antes.
            </p>
            <div className="mt-3 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#2563eb" dot={false} name="Clicks" />
                  <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#16a34a" dot={false} name="Impr." />
                  <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#f97316" dot={false} name="CTR %" />
                  <Line yAxisId="right" type="monotone" dataKey="position" stroke="#a855f7" dot={false} name="Posición" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted">
              Hitos de ventana: pre inicia {ranges.pre.start}, rollout inicia {ranges.rollout.start}, rollout termina {ranges.rollout.end}, post inicia {ranges.post.start}.
            </p>
          </section>

          <section className="surface-panel p-6">
            <h3 className="text-lg font-semibold">Segmentación agregada (impacto normalizado)</h3>
            <p className="section-subtitle">Ordenado por mayor impacto negativo de clics/día (post vs pre).</p>
            <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {[
                { title: 'Directorio', data: directoryBreakdown },
                { title: 'Template', data: templateBreakdown },
                { title: 'Device', data: deviceBreakdown },
                { title: 'Country', data: countryBreakdown },
                { title: 'Idioma/prefijo', data: languageBreakdown },
                { title: 'Tipo de página', data: pageTypeBreakdown },
              ].map((block) => (
                <Card key={block.title} className="p-4">
                  <h4 className="font-semibold">{block.title}</h4>
                  <div className="mt-2 space-y-2 text-sm">
                    {block.data.slice(0, 6).map((item) => (
                      <div key={`${block.title}-${item.bucket}`} className="surface-subtle p-2">
                        <p className="font-medium">{item.bucket}</p>
                        <p>
                          Clicks/día {item.summary.pre.clicksPerDay.toFixed(1)} → {item.summary.post.clicksPerDay.toFixed(1)} ·
                          Imp/día {item.summary.pre.impressionsPerDay.toFixed(1)} → {item.summary.post.impressionsPerDay.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted">
                          CTR {(item.summary.pre.ctr * 100).toFixed(2)}% → {(item.summary.post.ctr * 100).toFixed(2)}% · Pos {item.summary.pre.position.toFixed(2)} → {item.summary.post.position.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold">Mayor crecimiento por query</h3>
              <p className="mt-2 text-xs text-muted">Score de oportunidad = delta clicks + delta CTR + mejora de posición ponderada por volumen base.</p>
              <div className="mt-3 space-y-2">
                {topQueryWinners.map((row) => (
                  <div key={`qw-${row.key}`} className="surface-subtle p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.label}</p>
                      <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                    </div>
                    <p className="text-muted">
                      Δ clicks {row.deltaClicks.toFixed(0)} · Δ CTR {(row.deltaCtr * 100).toFixed(2)}pp · score {row.opportunityScore}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Mayor caída por query</h3>
              <div className="mt-3 space-y-2">
                {topQueryLosers.map((row) => (
                  <div key={`ql-${row.key}`} className="surface-subtle p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.label}</p>
                      <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                    </div>
                    <p className="text-muted">
                      Δ clicks {row.deltaClicks.toFixed(0)} · Δ CTR {(row.deltaCtr * 100).toFixed(2)}pp · score impacto {row.impactScore}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Mayor crecimiento por URL</h3>
              <div className="mt-3 space-y-2">
                {topUrlWinners.map((row) => (
                  <div key={`uw-${row.key}`} className="surface-subtle p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{row.label}</p>
                      <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                    </div>
                    <p className="text-muted">
                      Δ clicks {row.deltaClicks.toFixed(0)} · Δ CTR {(row.deltaCtr * 100).toFixed(2)}pp · score {row.opportunityScore}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Mayor caída por URL</h3>
              <div className="mt-3 space-y-2">
                {topUrlLosers.map((row) => (
                  <div key={`ul-${row.key}`} className="surface-subtle p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{row.label}</p>
                      <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                    </div>
                    <p className="text-muted">
                      Δ clicks {row.deltaClicks.toFixed(0)} · Δ CTR {(row.deltaCtr * 100).toFixed(2)}pp · score impacto {row.impactScore}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="surface-panel p-6">
            <h3 className="text-lg font-semibold">Mayor deterioro de CTR (URLs)</h3>
            <div className="mt-3 space-y-2">
              {topCtrDeterioration.map((row) => (
                <div key={`ctr-loss-${row.key}`} className="surface-subtle p-3 text-sm">
                  <p className="font-medium truncate">{row.label}</p>
                  <p className="text-muted">
                    CTR {(row.preCtr * 100).toFixed(2)}% → {(row.postCtr * 100).toFixed(2)}% · Δ {(row.deltaCtr * 100).toFixed(2)}pp
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">URLs inspeccionadas (URL Inspection)</h3>
                <p className="section-subtitle">
                  Priorización por pérdida neta de clicks/impresiones, caída de CTR, empeoramiento de posición y volumen base.
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
                      <th className="px-2 py-2">Δ CTR</th>
                      <th className="px-2 py-2">Δ pos</th>
                      <th className="px-2 py-2">Score</th>
                      <th className="px-2 py-2">Motivo</th>
                      <th className="px-2 py-2">Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSampledAffectedUrls.map((row) => (
                      <tr key={`sample-${row.key}`} className="border-t border-border/50">
                        <td className="max-w-[480px] truncate px-2 py-2">{row.key}</td>
                        <td className="px-2 py-2">{row.clickDelta}</td>
                        <td className="px-2 py-2">{row.impressionDelta}</td>
                        <td className="px-2 py-2">{(row.ctrDelta * 100).toFixed(2)}pp</td>
                        <td className="px-2 py-2">{row.positionDelta.toFixed(2)}</td>
                        <td className="px-2 py-2">{row.priorityScore}</td>
                        <td className="px-2 py-2">{row.reason}</td>
                        <td className="px-2 py-2">
                          <Badge variant={getSourceBadgeVariant(row.source)}>{getSourceLabel(row)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sampledAffectedUrls.length > RESULTS_PAGE_SIZE && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-muted">
                      Mostrando {pagedSampledAffectedUrls.length} de {sampledAffectedUrls.length} URLs.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setSampledUrlsPage((prev) => Math.max(1, prev - 1))}
                        disabled={sampledUrlsPage <= 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-muted">
                        Página {sampledUrlsPage} de {sampledUrlsTotalPages}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => setSampledUrlsPage((prev) => Math.min(sampledUrlsTotalPages, prev + 1))}
                        disabled={sampledUrlsPage >= sampledUrlsTotalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
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
