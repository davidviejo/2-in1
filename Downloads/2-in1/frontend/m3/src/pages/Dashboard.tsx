import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  ReferenceLine,
  Legend,
} from 'recharts';
import { GSCRow, ModuleData } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Download,
  Mic,
  Flame,
  LogIn,
  Settings,
  X,
  Search,
  Globe,
  HelpCircle,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import { Skeleton } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useGSCAuth } from '../hooks/useGSCAuth';
import { GSCComparisonMode, useGSCData } from '../hooks/useGSCData';
import { GSCDateRangeControl } from '../components/GSCDateRangeControl';
import { InsightDetailModal } from '../components/InsightDetailModal';
import {
  SeoInsight,
  SeoInsightBrandType,
  SeoInsightCategory,
  SeoInsightLifecycleStatus,
} from '../types/seoInsights';
import { ProjectType } from '../types';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { buildIgnoredEntryKey, useSeoIgnoredItems } from '../hooks/useSeoIgnoredItems';
import { useSeoInsightState } from '../hooks/useSeoInsightState';
import { useProject } from '../context/ProjectContext';
import * as XLSX from 'xlsx';
import {
  classifyQueryBrandSegment,
  matchBrandFilter,
  QueryBrandFilter,
} from '../utils/queryBrandSegment';
import { parseBrandTerms } from '../utils/brandTerms';
import {
  formatProjectContextLabel,
  getDashboardContextProfile,
  rankInsightsByProjectContext,
} from '../utils/dashboardContext';
import { computeHybridGlobalScore } from '../utils/hybridGlobalScore';

const GSC_COMPARISON_MODE_LABELS: Record<GSCComparisonMode, string> = {
  previous_period: 'Periodo anterior',
  previous_year: 'Mismo periodo del año pasado',
};

interface DashboardProps {
  modules: ModuleData[];
  globalScore: number;
  onReset?: () => void;
}

interface HeroMetricProps {
  title: string;
  value: string | number;
  description: string;
  tone: string;
  onClick?: () => void;
  ctaLabel?: string;
}

interface UrlTrendSignal {
  url: string;
  peakDate: string;
  peakClicks: number;
  baselineClicks: number;
  surgeRatio: number;
  clickIncrease: number;
}

type PerformanceMetric = 'clicks' | 'impressions' | 'ctr' | 'position';
type QueryCategoryFilter = 'all' | 'informational' | 'commercial' | 'navigational' | 'local' | 'other';

interface NormalizedQueryRow {
  query: string;
  dominantUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  brandSegment: 'brand' | 'non-brand' | 'mixed';
  needsReview: boolean;
  category: QueryCategoryFilter;
  previousClicks: number;
  previousImpressions: number;
  previousCtr: number;
  previousPosition: number;
  deltaClicksPct: number;
}

export const getVisibleSelectedGscSite = (
  selectedSite: string,
  filteredGscSites: Array<{ siteUrl: string }>,
) => {
  if (!selectedSite) {
    return '';
  }

  return filteredGscSites.some((site) => site.siteUrl === selectedSite) ? selectedSite : '';
};

export const detectTrendingUrls = (rows: GSCRow[]): UrlTrendSignal[] => {
  const groupedByUrl = new Map<string, Array<{ date: string; clicks: number }>>();

  rows.forEach((row) => {
    const url = row.keys?.[0];
    const date = row.keys?.[1];
    if (!url || !date) return;

    const bucket = groupedByUrl.get(url) || [];
    bucket.push({ date, clicks: Number(row.clicks) || 0 });
    groupedByUrl.set(url, bucket);
  });

  const result: UrlTrendSignal[] = [];

  groupedByUrl.forEach((entries, url) => {
    if (entries.length < 5) return;

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let best: UrlTrendSignal | null = null;

    for (let i = 4; i < sorted.length; i += 1) {
      const baselineSlice = sorted.slice(Math.max(0, i - 4), i);
      if (baselineSlice.length === 0) continue;

      const baselineRaw = baselineSlice.reduce((sum, item) => sum + item.clicks, 0) / baselineSlice.length;
      const baseline = Math.max(3, baselineRaw);
      const peakClicks = sorted[i].clicks;
      const clickIncrease = peakClicks - baseline;
      const surgeRatio = peakClicks / baseline;

      const isSignificant =
        peakClicks >= 25 &&
        clickIncrease >= 20 &&
        surgeRatio >= 2.5;

      if (!isSignificant) continue;

      const candidate: UrlTrendSignal = {
        url,
        peakDate: sorted[i].date,
        peakClicks,
        baselineClicks: baselineRaw,
        surgeRatio,
        clickIncrease,
      };

      if (!best || candidate.clickIncrease * candidate.surgeRatio > best.clickIncrease * best.surgeRatio) {
        best = candidate;
      }
    }

    if (best) {
      result.push(best);
    }
  });

  return result.sort((a, b) => b.clickIncrease * b.surgeRatio - a.clickIncrease * a.surgeRatio).slice(0, 5);
};

const formatNumberSafe = (value: unknown, fallback = '—') => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : fallback;
};

const formatPositionSafe = (value: unknown, fallback = '—') => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(1) : fallback;
};

const PERFORMANCE_METRIC_LABELS: Record<PerformanceMetric, string> = {
  clicks: 'Clics',
  impressions: 'Impresiones',
  ctr: 'CTR',
  position: 'Posición media',
};

const classifyQueryCategory = (query: string): QueryCategoryFilter => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 'other';
  if (/^(como|cómo|que|qué|cuando|cuándo|where|what|how|why)\b/.test(normalized)) return 'informational';
  if (/(precio|comprar|oferta|presupuesto|tarifa|cotizacion|cotización|shop|buy)/.test(normalized)) return 'commercial';
  if (/(cerca|near me|en |madrid|barcelona|valencia|sevilla|bilbao)/.test(normalized)) return 'local';
  if (/(login|marca|oficial|site|sitio|web|home)/.test(normalized)) return 'navigational';
  return 'other';
};

const sanitizeSheetName = (value: string, fallback: string) => {
  const invalidChars = ['\\', '/', '?', '*', '[', ']', ':'];
  const sanitized = invalidChars
    .reduce((result, char) => result.replaceAll(char, ' '), value)
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) {
    return fallback;
  }

  return sanitized.slice(0, 31);
};

const mapInsightRowForExport = (row: SeoInsight['relatedRows'][number]) => {
  const queryFromKeys = row.keys?.[0] ?? '';
  const urlFromKeys = row.keys?.[1] ?? '';

  return {
    query: row.query ?? queryFromKeys,
    url: row.url ?? row.page ?? urlFromKeys,
    clicks: row.clicks ?? '',
    impressions: row.impressions ?? '',
    ctr: row.ctr ?? '',
    position: row.position ?? '',
  };
};

const buildInsightExportRows = (insight: SeoInsight) => {
  if (insight.relatedRows.length === 0) {
    return [
      {
        categoria: insight.category,
        insightId: insight.id,
        titulo: insight.title,
        prioridad: insight.priority,
        severidad: insight.severity,
        score: insight.score,
        oportunidad: insight.opportunity,
        confianza: insight.confidence,
        impacto: insight.impact,
        urgencia: insight.urgency,
        facilidad: insight.ease,
        valorNegocio: insight.businessValue,
        facilidadImplementacion: insight.implementationEase,
        accionSugerida: insight.suggestedAction,
        regla: insight.ruleKey,
        alcanceRegla: insight.ruleScope,
        explicacionAplicabilidad: insight.appliesBecause,
        modulo: insight.moduleId || '',
        brandType: insight.brandType,
        estado: insight.status,
        propiedad: insight.propertyId,
        periodoActual: insight.periodCurrent ? `${insight.periodCurrent.startDate}..${insight.periodCurrent.endDate}` : '',
        periodoAnterior: insight.periodPrevious ? `${insight.periodPrevious.startDate}..${insight.periodPrevious.endDate}` : '',
        resumen: insight.summary,
        motivo: insight.reason,
        query: '',
        url: '',
        clicks: '',
        impressions: '',
        ctr: '',
        position: '',
      },
    ];
  }

  return insight.relatedRows.map((row) => ({
    categoria: insight.category,
    insightId: insight.id,
    titulo: insight.title,
    prioridad: insight.priority,
    severidad: insight.severity,
    score: insight.score,
    oportunidad: insight.opportunity,
    confianza: insight.confidence,
    impacto: insight.impact,
    urgencia: insight.urgency,
    facilidad: insight.ease,
    valorNegocio: insight.businessValue,
    facilidadImplementacion: insight.implementationEase,
    accionSugerida: insight.suggestedAction,
    regla: insight.ruleKey,
    alcanceRegla: insight.ruleScope,
    explicacionAplicabilidad: insight.appliesBecause,
    modulo: insight.moduleId || '',
    brandType: insight.brandType,
    estado: insight.status,
    propiedad: insight.propertyId,
    periodoActual: insight.periodCurrent ? `${insight.periodCurrent.startDate}..${insight.periodCurrent.endDate}` : '',
    periodoAnterior: insight.periodPrevious ? `${insight.periodPrevious.startDate}..${insight.periodPrevious.endDate}` : '',
    resumen: insight.summary,
    motivo: insight.reason,
    ...mapInsightRowForExport(row),
  }));
};

const HeroMetric: React.FC<HeroMetricProps> = ({ title, value, description, tone, onClick, ctaLabel }) => {
  if (onClick) {
    return (
      <button type="button" className="text-left" onClick={onClick}>
        <Card className={`rounded-2xl p-5 shadow-brand transition-transform hover:-translate-y-0.5 ${tone}`}>
          <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">{title}</div>
          <div className="mt-3 text-3xl font-bold">{value}</div>
          <div className="mt-2 line-clamp-3 text-xs opacity-80">{description}</div>
          <div className="mt-3 text-[11px] font-semibold opacity-90">{ctaLabel || 'Ver detalle'}</div>
        </Card>
      </button>
    );
  }

  return (
    <Card className={`rounded-2xl p-5 shadow-brand ${tone}`}>
      <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">{title}</div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
      <div className="mt-2 line-clamp-3 text-xs opacity-80">{description}</div>
    </Card>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ modules, globalScore }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { success: showSuccess } = useToast();
  const { currentClient, updateCurrentClientProfile, addTask, projectScoreContext } = useProject();
  const [quickTask, setQuickTask] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<SeoInsight | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SeoInsightCategory | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>(
    'all',
  );
  const [selectedModule, setSelectedModule] = useState<'all' | string>('all');
  const [selectedBrandType, setSelectedBrandType] = useState<'all' | SeoInsightBrandType>('all');
  const [trafficSegmentFilter, setTrafficSegmentFilter] = useState<QueryBrandFilter>('all');
  const [queryCategoryFilter, setQueryCategoryFilter] = useState<QueryCategoryFilter>('all');
  const [selectedPerformanceMetric, setSelectedPerformanceMetric] = useState<PerformanceMetric>('clicks');
  const [showRoadmapAnnotations, setShowRoadmapAnnotations] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<'all' | SeoInsightLifecycleStatus>('all');
  const [selectedRuleScope, setSelectedRuleScope] = useState<'all' | 'generic' | 'project_type' | 'sector'>('all');
  const [gscSiteQuery, setGscSiteQuery] = useState('');
  const [comparisonMode, setComparisonMode] = useState<GSCComparisonMode>('previous_period');
  const [showInsightsHelp, setShowInsightsHelp] = useState(false);
  const [showBrandConfigModal, setShowBrandConfigModal] = useState(false);
  const [projectSectorDraft, setProjectSectorDraft] = useState('');
  const [brandTermsDraft, setBrandTermsDraft] = useState('');
  const [analysisProjectTypesDraft, setAnalysisProjectTypesDraft] = useState<ProjectType[]>([]);

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

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

  const {
    gscSites,
    selectedSite,
    setSelectedSite,
    gscData,
    comparisonGscData,
    queryPageData,
    comparisonQueryPageData,
    pageDateData,
    comparisonPeriod,
    isLoadingGsc,
    insights: { insights, groupedInsights },
  } = useGSCData(gscAccessToken, startDate, endDate, comparisonMode, {
    propertyId: currentClient?.id,
    brandTerms: currentClient?.brandTerms || [],
    projectType: currentClient?.projectType,
    analysisProjectTypes: currentClient?.analysisProjectTypes || (currentClient?.projectType ? [currentClient.projectType] : ['MEDIA']),
    sector: currentClient?.sector || 'Generico',
    geoScope: currentClient?.geoScope || 'global',
  });

  const {
    entries: ignoredEntries,
    isIgnored,
    ignoreRow,
    unignoreKey,
    importEntries,
  } = useSeoIgnoredItems();

  const { getInsightStatus, setInsightStatus } = useSeoInsightState(
    `${currentClient?.id || 'global'}:${selectedSite || 'no-site'}`,
  );

  const filteredGscSites = useMemo(() => {
    const normalizedQuery = gscSiteQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return gscSites;
    }

    return gscSites.filter((site) => site.siteUrl.toLowerCase().includes(normalizedQuery));
  }, [gscSiteQuery, gscSites]);

  const visibleSelectedGscSite = useMemo(
    () => getVisibleSelectedGscSite(selectedSite, filteredGscSites),
    [filteredGscSites, selectedSite],
  );

  const activeProjectType = currentClient?.projectType || 'MEDIA';
  const activeSector = currentClient?.sector || 'Generico';
  const activeGeoScope = currentClient?.geoScope || 'global';
  const activeAnalysisProjectTypes = currentClient?.analysisProjectTypes || [activeProjectType];

  const contextProfile = useMemo(
    () => getDashboardContextProfile(activeProjectType, activeSector),
    [activeProjectType, activeSector],
  );

  const contextLabel = useMemo(
    () => formatProjectContextLabel(activeProjectType, activeSector, activeGeoScope),
    [activeGeoScope, activeProjectType, activeSector],
  );

  const weightedCriticalModules = useMemo(() => {
    if (!projectScoreContext) {
      return [];
    }

    return projectScoreContext.criticalModuleIds
      .map((moduleId) => {
        const module = modules.find((item) => item.id === moduleId);
        const weight = projectScoreContext.appliedWeights.find((item) => item.moduleId === moduleId)?.weight || 0;
        const maturity = projectScoreContext.moduleMaturity[moduleId] || 0;
        if (!module) {
          return null;
        }

        return {
          moduleId,
          title: module.title,
          weight,
          maturity,
        };
      })
      .filter((entry): entry is { moduleId: number; title: string; weight: number; maturity: number } => Boolean(entry));
  }, [modules, projectScoreContext]);

  const chartData = useMemo(
    () =>
      modules.map((m) => {
        const total = m.tasks.length;
        const completed = m.tasks.filter((t) => t.status === 'completed').length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        return {
          name: `M${m.id}`,
          fullTitle: m.title,
          score: percentage,
          color: percentage === 100 ? '#10b981' : percentage > 50 ? '#3b82f6' : '#94a3b8',
        };
      }),
    [modules],
  );

  const radarData = useMemo(() => {
    const categoryScores: Record<string, { total: number; completed: number }> = {};
    modules.forEach((m) => {
      m.tasks.forEach((t) => {
        const cat = t.category || 'General';
        if (!categoryScores[cat]) {
          categoryScores[cat] = { total: 0, completed: 0 };
        }
        categoryScores[cat].total += 1;
        if (t.status === 'completed') {
          categoryScores[cat].completed += 1;
        }
      });
    });

    return Object.keys(categoryScores).map((cat) => ({
      subject: cat,
      A: Math.round((categoryScores[cat].completed / categoryScores[cat].total) * 100),
      fullMark: 100,
    }));
  }, [modules]);

  const nextModule = useMemo(
    () =>
      modules.find((m) => {
        const total = m.tasks.length;
        const completed = m.tasks.filter((t) => t.status === 'completed').length;
        return completed < total;
      }),
    [modules],
  );

  const actionableInsights = useMemo(
    () =>
      insights
        .map((insight) => {
          const visibleRows = insight.relatedRows.filter((row) => !isIgnored(row));
          return {
            ...insight,
            status: getInsightStatus(insight),
            relatedRows: visibleRows,
            affectedCount: visibleRows.length,
          };
        })
        .filter((insight) => insight.relatedRows.length > 0),
    [insights, isIgnored, getInsightStatus],
  );

  useEffect(() => {
    const insightId = searchParams.get('insightId');
    if (!insightId || actionableInsights.length === 0) return;
    const matched = actionableInsights.find((insight) => insight.id === insightId);
    if (!matched) return;
    setSelectedInsight(matched);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('insightId');
    setSearchParams(nextParams, { replace: true });
  }, [actionableInsights, searchParams, setSearchParams]);

  const segmentFilteredInsights = useMemo(
    () =>
      actionableInsights.filter((insight) => matchBrandFilter(insight.brandType, trafficSegmentFilter)),
    [actionableInsights, trafficSegmentFilter],
  );

  const prioritizedContextInsights = useMemo(
    () =>
      rankInsightsByProjectContext(
        segmentFilteredInsights,
        activeProjectType,
        activeAnalysisProjectTypes,
        activeSector,
      ),
    [activeAnalysisProjectTypes, activeProjectType, activeSector, segmentFilteredInsights],
  );

  const actionableGroupedInsights = useMemo(
    () =>
      groupedInsights
        .map((group) => ({
          ...group,
          insights: group.insights
            .map((insight) => {
              const visibleRows = insight.relatedRows.filter((row) => !isIgnored(row));
              return {
                ...insight,
                relatedRows: visibleRows,
                affectedCount: visibleRows.length,
              };
            })
            .filter((insight) => insight.relatedRows.length > 0),
        }))
        .filter((group) => group.insights.length > 0),
    [groupedInsights, isIgnored],
  );

  const actionableTopOpportunities = useMemo(
    () => prioritizedContextInsights.filter((insight) => insight.category === 'opportunity').slice(0, 3),
    [prioritizedContextInsights],
  );

  const actionableTopRisks = useMemo(
    () => prioritizedContextInsights.filter((insight) => insight.category === 'risk').slice(0, 3),
    [prioritizedContextInsights],
  );

  const topQueriesNormalized = useMemo<NormalizedQueryRow[]>(() => {
    const previousByQuery = ((comparisonQueryPageData as GSCRow[]) || []).reduce((acc, row) => {
      const query = (row.keys?.[0] || '').trim();
      if (!query) return acc;
      const previous = acc.get(query) || { clicks: 0, impressions: 0, positionWeighted: 0 };
      const impressions = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      const position = Number(row.position || 0);
      previous.clicks += clicks;
      previous.impressions += impressions;
      previous.positionWeighted += position * impressions;
      acc.set(query, previous);
      return acc;
    }, new Map<string, { clicks: number; impressions: number; positionWeighted: number }>());

    const currentByQuery = ((queryPageData as GSCRow[]) || []).reduce((acc, row) => {
      const query = (row.keys?.[0] || '').trim();
      if (!query) return acc;
      const bucket =
        acc.get(query) ||
        { query, clicks: 0, impressions: 0, positionWeighted: 0, dominantUrl: '', dominantUrlClicks: 0 };
      const impressions = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      const position = Number(row.position || 0);
      const url = row.keys?.[1] || '';
      bucket.clicks += clicks;
      bucket.impressions += impressions;
      bucket.positionWeighted += position * impressions;
      if (clicks > bucket.dominantUrlClicks && url) {
        bucket.dominantUrl = url;
        bucket.dominantUrlClicks = clicks;
      }
      acc.set(query, bucket);
      return acc;
    }, new Map<string, { query: string; clicks: number; impressions: number; positionWeighted: number; dominantUrl: string; dominantUrlClicks: number }>());

    const rows = Array.from(currentByQuery.values()).map((item) => {
      const prev = previousByQuery.get(item.query) || { clicks: 0, impressions: 0, positionWeighted: 0 };
      const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
      const previousCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
      const classification = classifyQueryBrandSegment(item.query, currentClient?.brandTerms || []);
      const category = classifyQueryCategory(item.query);

      return {
        query: item.query,
        dominantUrl: item.dominantUrl || 'Sin URL dominante',
        clicks: item.clicks,
        impressions: item.impressions,
        ctr,
        position: item.impressions > 0 ? item.positionWeighted / item.impressions : 0,
        brandSegment: classification.segment,
        needsReview: classification.needsReview,
        category,
        previousClicks: prev.clicks,
        previousImpressions: prev.impressions,
        previousCtr,
        previousPosition: prev.impressions > 0 ? prev.positionWeighted / prev.impressions : 0,
        deltaClicksPct: prev.clicks > 0 ? ((item.clicks - prev.clicks) / prev.clicks) * 100 : 0,
      };
    });

    return rows
      .filter((item) => matchBrandFilter(item.brandSegment, trafficSegmentFilter))
      .filter((item) => queryCategoryFilter === 'all' || item.category === queryCategoryFilter)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);
  }, [comparisonQueryPageData, currentClient?.brandTerms, queryCategoryFilter, queryPageData, trafficSegmentFilter]);

  const trendingUrls = useMemo(() => detectTrendingUrls(pageDateData), [pageDateData]);


  const prioritizedQuickWins = useMemo(
    () => prioritizedContextInsights.filter((insight) => insight.findingFamily === 'quick_win').slice(0, 5),
    [prioritizedContextInsights],
  );

  const prioritizedAnomalies = useMemo(
    () => prioritizedContextInsights.filter((insight) => insight.findingFamily === 'anomaly').slice(0, 5),
    [prioritizedContextInsights],
  );

  const filteredInsights = useMemo(
    () =>
      prioritizedContextInsights.filter((insight) => {
        const categoryMatch = selectedCategory === 'all' || insight.category === selectedCategory;
        const priorityMatch = selectedPriority === 'all' || insight.priority === selectedPriority;
        const moduleMatch = selectedModule === 'all' || String(insight.moduleId || '') === selectedModule;
        const brandMatch = selectedBrandType === 'all' || insight.brandType === selectedBrandType;
        const statusMatch = selectedStatus === 'all' || insight.status === selectedStatus;
        const scopeMatch = selectedRuleScope === 'all' || insight.ruleScope === selectedRuleScope;
        return categoryMatch && priorityMatch && moduleMatch && brandMatch && statusMatch && scopeMatch;
      }),
    [prioritizedContextInsights, selectedCategory, selectedPriority, selectedModule, selectedBrandType, selectedStatus, selectedRuleScope],
  );

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas las categorías' },
      ...actionableGroupedInsights.map((group) => ({ value: group.category, label: group.label })),
    ],
    [actionableGroupedInsights],
  );

  const topQuerySummary = useMemo(() => {
    const rows = topQueriesNormalized;
    return rows.reduce(
      (acc, row) => {
        acc.total.clicks += Number(row.clicks || 0);
        acc.total.impressions += Number(row.impressions || 0);
        if (row.brandSegment === 'brand') {
          acc.brand.clicks += Number(row.clicks || 0);
          acc.brand.impressions += Number(row.impressions || 0);
        } else if (row.brandSegment === 'non-brand') {
          acc.nonBrand.clicks += Number(row.clicks || 0);
          acc.nonBrand.impressions += Number(row.impressions || 0);
        }
        if (row.brandSegment === 'mixed') {
          acc.reviewCount += 1;
        }
        return acc;
      },
      {
        total: { clicks: 0, impressions: 0 },
        brand: { clicks: 0, impressions: 0 },
        nonBrand: { clicks: 0, impressions: 0 },
        reviewCount: 0,
      },
    );
  }, [topQueriesNormalized]);

  const performanceSummary = useMemo(() => {
    const current = gscData.reduce(
      (acc, row) => {
        const clicks = Number(row.clicks || 0);
        const impressions = Number(row.impressions || 0);
        const position = Number(row.position || 0);
        acc.clicks += clicks;
        acc.impressions += impressions;
        acc.positionWeighted += position * impressions;
        return acc;
      },
      { clicks: 0, impressions: 0, positionWeighted: 0 },
    );

    const previous = comparisonGscData.reduce(
      (acc, row) => {
        const clicks = Number(row.clicks || 0);
        const impressions = Number(row.impressions || 0);
        const position = Number(row.position || 0);
        acc.clicks += clicks;
        acc.impressions += impressions;
        acc.positionWeighted += position * impressions;
        return acc;
      },
      { clicks: 0, impressions: 0, positionWeighted: 0 },
    );

    const toCtr = (clicks: number, impressions: number) => (impressions > 0 ? (clicks / impressions) * 100 : 0);
    const toPosition = (weighted: number, impressions: number) => (impressions > 0 ? weighted / impressions : 0);
    const deltaPct = (curr: number, prev: number) => (prev > 0 ? ((curr - prev) / prev) * 100 : 0);

    return {
      current: {
        clicks: current.clicks,
        impressions: current.impressions,
        ctr: toCtr(current.clicks, current.impressions),
        position: toPosition(current.positionWeighted, current.impressions),
      },
      previous: {
        clicks: previous.clicks,
        impressions: previous.impressions,
        ctr: toCtr(previous.clicks, previous.impressions),
        position: toPosition(previous.positionWeighted, previous.impressions),
      },
      delta: {
        clicks: deltaPct(current.clicks, previous.clicks),
        impressions: deltaPct(current.impressions, previous.impressions),
        ctr: toCtr(current.clicks, current.impressions) - toCtr(previous.clicks, previous.impressions),
        position: toPosition(current.positionWeighted, current.impressions) - toPosition(previous.positionWeighted, previous.impressions),
      },
    };
  }, [comparisonGscData, gscData]);

  const brandDeltaSummary = useMemo(() => {
    const previousRows = comparisonQueryPageData || [];
    const previous = previousRows.reduce(
      (acc, row) => {
        const query = row.keys?.[0] || '';
        const classification = classifyQueryBrandSegment(query, currentClient?.brandTerms || []);
        const clicks = Number(row.clicks || 0);
        if (classification.segment === 'brand') {
          acc.brand += clicks;
        } else if (classification.segment === 'non-brand') {
          acc.nonBrand += clicks;
        }
        return acc;
      },
      { brand: 0, nonBrand: 0 },
    );

    return {
      current: {
        brand: topQuerySummary.brand.clicks,
        nonBrand: topQuerySummary.nonBrand.clicks,
      },
      delta: {
        brand: topQuerySummary.brand.clicks - previous.brand,
        nonBrand: topQuerySummary.nonBrand.clicks - previous.nonBrand,
      },
    };
  }, [comparisonQueryPageData, currentClient?.brandTerms, topQuerySummary.brand.clicks, topQuerySummary.nonBrand.clicks]);

  const newInsightsCount = useMemo(
    () => actionableInsights.filter((insight) => insight.status === 'new').length,
    [actionableInsights],
  );

  const hybridGlobalScore = useMemo(
    () =>
      computeHybridGlobalScore({
        modules,
        structuralScore: projectScoreContext?.score || globalScore,
        performance: {
          current: {
            clicks: performanceSummary.current.clicks,
            ctr: performanceSummary.current.ctr,
            position: performanceSummary.current.position,
          },
          previous: {
            clicks: performanceSummary.previous.clicks,
            ctr: performanceSummary.previous.ctr,
            position: performanceSummary.previous.position,
          },
        },
        nonBrand: {
          currentClicks: brandDeltaSummary.current.nonBrand,
          previousClicks: Math.max(0, brandDeltaSummary.current.nonBrand - brandDeltaSummary.delta.nonBrand),
        },
        insights: actionableInsights,
        propertyId: visibleSelectedGscSite || selectedSite || 'Sin propiedad',
        periodCurrent: `${startDate}..${endDate}`,
        periodPrevious: comparisonPeriod
          ? `${comparisonPeriod.previous.startDate}..${comparisonPeriod.previous.endDate}`
          : 'Sin comparativa',
        timestamp: Date.now(),
      }),
    [
      actionableInsights,
      brandDeltaSummary.current.nonBrand,
      brandDeltaSummary.delta.nonBrand,
      comparisonPeriod,
      endDate,
      globalScore,
      modules,
      performanceSummary.current.clicks,
      performanceSummary.current.ctr,
      performanceSummary.current.position,
      performanceSummary.previous.clicks,
      performanceSummary.previous.ctr,
      performanceSummary.previous.position,
      projectScoreContext?.score,
      selectedSite,
      startDate,
      visibleSelectedGscSite,
    ],
  );

  const effectiveGlobalScore = hybridGlobalScore.globalScore;

  const scoreBadge = useMemo(() => {
    if (effectiveGlobalScore >= 95) return { title: 'Chief SEO Officer', variant: 'success' as const };
    if (effectiveGlobalScore >= 80) return { title: 'Jefe de Audiencias', variant: 'warning' as const };
    if (effectiveGlobalScore >= 60) return { title: 'Líder Técnico SEO', variant: 'primary' as const };
    if (effectiveGlobalScore >= 40) return { title: 'Estratega SEO', variant: 'primary' as const };
    if (effectiveGlobalScore >= 20) return { title: 'Analista Junior', variant: 'primary' as const };
    return { title: 'Becario SEO', variant: 'neutral' as const };
  }, [effectiveGlobalScore]);

  const recommendedAction = useMemo(() => {
    const candidate = filteredInsights[0] || prioritizedContextInsights[0];
    if (!candidate) {
      return null;
    }

    return {
      title: candidate.title,
      action: candidate.suggestedAction || 'Revisar el insight y convertirlo en tarea del roadmap.',
      reason: candidate.reason,
      trace: {
        source: candidate.trace?.source || 'gsc',
        query: candidate.trace?.query || candidate.relatedRows[0]?.query || candidate.relatedRows[0]?.keys?.[0] || 'N/A',
        url: candidate.trace?.url || candidate.relatedRows[0]?.url || candidate.relatedRows[0]?.page || candidate.relatedRows[0]?.keys?.[1] || 'N/A',
        property: candidate.trace?.propertyId || candidate.propertyId || selectedSite || 'Sin propiedad',
        module: candidate.trace?.moduleId ? `M${candidate.trace.moduleId}` : candidate.moduleId ? `M${candidate.moduleId}` : 'Sin módulo',
        timestamp: candidate.trace?.timestamp || candidate.createdAt || Date.now(),
      },
      insight: candidate,
    };
  }, [filteredInsights, prioritizedContextInsights, selectedSite]);

  const reviewNowActions = useMemo(() => {
    if (actionableInsights.length === 0) {
      return [];
    }

    return prioritizedContextInsights.slice(0, 3).map((insight) => ({
      id: insight.id,
      title: insight.title,
      action: insight.suggestedAction || 'Analizar insight y convertir en tarea.',
      context: `${insight.propertyId || selectedSite || 'sin propiedad'} · ${insight.periodCurrent?.startDate || startDate} → ${insight.periodCurrent?.endDate || endDate}`,
      insight,
    }));
  }, [endDate, prioritizedContextInsights, selectedSite, startDate]);

  const saveBrandConfig = () => {
    if (!currentClient) return;
    updateCurrentClientProfile({
      projectType: currentClient.projectType || 'MEDIA',
      sector: projectSectorDraft || currentClient.sector || 'Otro',
      geoScope: currentClient.geoScope || 'global',
      brandTerms: parseBrandTerms(brandTermsDraft),
      analysisProjectTypes: analysisProjectTypesDraft.length > 0
        ? analysisProjectTypesDraft
        : [currentClient.projectType || 'MEDIA'],
    });
    setShowBrandConfigModal(false);
    showSuccess('Configuración de sector y términos de marca actualizada.');
  };

  const handleExport = () => {
    const date = new Date().toLocaleDateString();
    const text = `REPORTE SEO MEDIAFLOW - ${date}\nPuntuación Global Híbrida: ${effectiveGlobalScore}% (${scoreBadge.title})\nSubscore Estructural: ${hybridGlobalScore.structuralSubscore}%\nSubscore Rendimiento: ${hybridGlobalScore.performanceSubscore}%\nVariación vs periodo anterior: ${hybridGlobalScore.variationVsPrevious >= 0 ? '+' : ''}${hybridGlobalScore.variationVsPrevious}\nInsights activos: ${actionableInsights.length}\n\n${modules.map((m) => `${m.title}: ${m.tasks.filter((t) => t.status === 'completed').length}/${m.tasks.length}`).join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_MediaFlow_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    showSuccess('Reporte descargado.');
  };

  const handleExportInsightsWorkbook = () => {
    if (actionableInsights.length === 0) {
      showSuccess('No hay puntos para exportar en este momento.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    const expandedRows = actionableInsights.flatMap((insight) => buildInsightExportRows(insight));

    const summaryRows = actionableInsights.map((insight) => ({
      categoria: insight.category,
      insightId: insight.id,
      titulo: insight.title,
      prioridad: insight.priority,
      severidad: insight.severity,
      score: insight.score,
      oportunidad: insight.opportunity,
      confianza: insight.confidence,
      impacto: insight.impact,
      urgencia: insight.urgency,
      facilidad: insight.ease,
      valorNegocio: insight.businessValue,
      facilidadImplementacion: insight.implementationEase,
      accionSugerida: insight.suggestedAction,
      regla: insight.ruleKey,
      alcanceRegla: insight.ruleScope,
      explicacionAplicabilidad: insight.appliesBecause,
      modulo: insight.moduleId || '',
      brandType: insight.brandType,
      estado: insight.status,
      propiedad: insight.propertyId,
      periodoActual: insight.periodCurrent ? `${insight.periodCurrent.startDate}..${insight.periodCurrent.endDate}` : '',
      periodoAnterior: insight.periodPrevious ? `${insight.periodPrevious.startDate}..${insight.periodPrevious.endDate}` : '',
      resumen: insight.summary,
      motivo: insight.reason,
      filasRelacionadas: insight.relatedRows.length,
    }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumen insights');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expandedRows), 'Detalle completo');

    const usedSheetNames = new Set<string>(['Resumen insights', 'Detalle completo']);

    actionableInsights
      .reduce((acc, insight) => {
        const key = insight.suggestedAction?.trim() || 'Sin acción sugerida';
        if (!acc.has(key)) {
          acc.set(key, []);
        }
        acc.get(key)?.push(insight);
        return acc;
      }, new Map<string, SeoInsight[]>())
      .forEach((groupInsights, actionLabel, index) => {
        const actionRows = groupInsights.flatMap((insight) => buildInsightExportRows(insight));

        const baseName = sanitizeSheetName(actionLabel, `Accion ${index + 1}`);
        let sheetName = baseName;
        let suffix = 2;
        while (usedSheetNames.has(sheetName)) {
          const trimmed = baseName.slice(0, Math.max(1, 31 - (` (${suffix})`.length)));
          sheetName = `${trimmed} (${suffix})`;
          suffix += 1;
        }
        usedSheetNames.add(sheetName);

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(actionRows), sheetName);
      });

    XLSX.writeFile(workbook, `SEO_Insights_Detallados_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showSuccess(
      `Excel exportado con ${actionableInsights.length} insights y ${Math.max(1, new Set(actionableInsights.map((item) => item.suggestedAction?.trim() || 'Sin acción sugerida')).size)} pestañas de acción.`,
    );
  };

  const simulateVoiceRecording = () => {
    setIsRecording(true);
    setTimeout(() => {
      setQuickTask('Revisar etiquetas canonical en la sección de deportes...');
      setIsRecording(false);
      showSuccess('Nota de voz transcrita.');
    }, 1500);
  };

  const gscChartData = useMemo(() => {
    const maxLength = Math.max(gscData.length, comparisonGscData.length);

    const metricValue = (row: GSCRow | undefined, metric: PerformanceMetric) => {
      if (!row) return null;
      if (metric === 'ctr') return Number(row.ctr || 0) * 100;
      if (metric === 'position') return Number(row.position || 0);
      if (metric === 'impressions') return Number(row.impressions || 0);
      return Number(row.clicks || 0);
    };

    return Array.from({ length: maxLength }, (_, index) => {
      const currentRow = gscData[index];
      const comparisonRow = comparisonGscData[index];

      return {
        label: currentRow?.keys?.[0] || comparisonRow?.keys?.[0] || `Fila ${index + 1}`,
        currentClicks: currentRow?.clicks ?? null,
        currentImpressions: currentRow?.impressions ?? null,
        comparisonClicks: comparisonRow?.clicks ?? null,
        comparisonImpressions: comparisonRow?.impressions ?? null,
        currentMetricValue: metricValue(currentRow, selectedPerformanceMetric),
        comparisonMetricValue: metricValue(comparisonRow, selectedPerformanceMetric),
      };
    });
  }, [comparisonGscData, gscData, selectedPerformanceMetric]);

  const roadmapAnnotations = useMemo(
    () =>
      (currentClient?.completedTasksLog || [])
        .map((item) => ({
          id: item.id,
          label: `${item.title}${item.moduleId ? ` (M${item.moduleId})` : ''}`,
          date: new Date(item.completedAt).toISOString().split('T')[0],
        }))
        .filter((item) => gscChartData.some((chartRow) => chartRow.label === item.date))
        .slice(-8),
    [currentClient?.completedTasksLog, gscChartData],
  );

  const comparisonSummary = useMemo(() => {
    if (!comparisonPeriod) {
      return 'Sin comparativa disponible.';
    }

    return `${GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode]}: ${comparisonPeriod.previous.startDate} a ${comparisonPeriod.previous.endDate}`;
  }, [comparisonPeriod]);

  const openQueryInsight = (queryRow: NormalizedQueryRow) => {
    const insightMatch = prioritizedContextInsights.find((insight) =>
      insight.relatedRows.some((row) => (row.query || row.keys?.[0] || '').toLowerCase() === queryRow.query.toLowerCase()),
    );

    if (insightMatch) {
      setSelectedInsight(insightMatch);
      return;
    }

    showSuccess('No hay insight directo para esta query. Puedes crear una tarea igualmente.');
  };

  const createTaskFromQuery = (queryRow: NormalizedQueryRow) => {
    addTask(
      1,
      `Optimizar query: ${queryRow.query}`,
      `Revisar intención y snippet para ${queryRow.query}. URL dominante: ${queryRow.dominantUrl}.`,
      'Medium',
      'GSC',
      {
        isInCustomRoadmap: true,
        insightSourceMeta: {
          insightId: `query-${queryRow.query}`,
          sourceType: 'gsc_query',
          sourceLabel: 'Top Consultas',
          moduleId: 1,
          metricsSnapshot: {
            clicks: queryRow.clicks,
            impressions: queryRow.impressions,
            ctr: Number(queryRow.ctr.toFixed(2)),
            position: Number(queryRow.position.toFixed(2)),
            deltaClicksPct: Number(queryRow.deltaClicksPct.toFixed(2)),
          },
          periodContext: {
            current: `${startDate}..${endDate}`,
            previous: comparisonPeriod ? `${comparisonPeriod.previous.startDate}..${comparisonPeriod.previous.endDate}` : undefined,
          },
          property: selectedSite || 'Sin propiedad',
          query: queryRow.query,
          url: queryRow.dominantUrl,
          timestamp: Date.now(),
        },
      },
    );
    showSuccess('Tarea creada desde Top Consultas y añadida al roadmap.');
  };

  const priorityLabel: Record<'high' | 'medium' | 'low', string> = {
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
  };

  const severityVariant: Record<'critical' | 'high' | 'medium' | 'low', 'danger' | 'warning' | 'success'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'warning',
    low: 'success',
  };

  const priorityVariant: Record<'high' | 'medium' | 'low', 'danger' | 'warning' | 'neutral'> = {
    high: 'danger',
    medium: 'warning',
    low: 'neutral',
  };

  const InsightCard = ({ insight }: { insight: SeoInsight }) => (
    <button
      onClick={() => setSelectedInsight(insight)}
      className="surface-panel text-left p-5 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              {insight.visualContext.categoryLabel}
            </span>
            <Badge variant={priorityVariant[insight.priority]} className="text-[10px]">
              Prioridad {priorityLabel[insight.priority]}
            </Badge>
            <Badge variant={severityVariant[insight.severity]} className="text-[10px]">
              {insight.severity}
            </Badge>
            <Badge variant="neutral" className="text-[10px]">
              {insight.status}
            </Badge>
          </div>
          <h3 className="text-base font-bold text-foreground">{insight.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-muted">
            {insight.summary}
          </p>
        </div>
        <div className="text-right min-w-[74px]">
          <div className="text-2xl font-bold text-foreground">{insight.affectedCount}</div>
          <div className="text-xs text-muted">elementos</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
        <div className="metric-chip">
          <div className="metric-label">Score</div>
          <div className="text-lg font-bold text-foreground">{insight.score}</div>
        </div>
        <div className="metric-chip">
          <div className="metric-label">Oportunidad</div>
          <div className="text-lg font-bold text-foreground">{insight.opportunity}</div>
        </div>
        <div className="metric-chip">
          <div className="metric-label">Confianza</div>
          <div className="text-lg font-bold text-foreground">{insight.confidence}</div>
        </div>
      </div>
      <div className="mt-4 line-clamp-2 text-xs text-muted">{insight.reason}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setInsightStatus(insight.id, 'ignored');
          }}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:border-danger/40"
        >
          Ignorar
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setInsightStatus(insight.id, 'postponed');
          }}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted"
        >
          Posponer
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setInsightStatus(insight.id, 'planned');
            setSelectedInsight(insight);
          }}
          className="rounded-md border border-primary/40 px-2 py-1 text-[11px] text-primary"
        >
          Convertir en tarea
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setInsightStatus(insight.id, 'done');
          }}
          className="rounded-md border border-success/40 px-2 py-1 text-[11px] text-success"
        >
          Resuelto
        </button>
      </div>
    </button>
  );

  return (
    <div className="page-shell relative animate-fade-in">
      {selectedInsight && (
        <div className="overlay-backdrop animate-fade-in">
          <ErrorBoundary>
            <InsightDetailModal
              insight={selectedInsight}
              onClose={() => setSelectedInsight(null)}
              isIgnored={isIgnored}
              onIgnoreRow={(row) => {
                ignoreRow(row);
                showSuccess('Fila marcada como ya gestionada.');
              }}
              onUnignoreRow={(key) => {
                unignoreKey(key);
                showSuccess('Fila reincorporada al análisis.');
              }}
              buildIgnoredKey={buildIgnoredEntryKey}
            />
          </ErrorBoundary>
        </div>
      )}

      {showInsightsHelp && (
        <Modal
          isOpen={showInsightsHelp}
          onClose={() => setShowInsightsHelp(false)}
          title="Ayuda · evitar reanalizar trabajo ya realizado"
          className="max-w-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                <HelpCircle size={20} />
              </h3>
              <p className="text-sm text-muted mt-2">
                Puedes excluir consultas/URLs ya gestionadas una a una o importando un listado en
                CSV.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="surface-subtle p-4">
              <div className="font-semibold text-foreground">
                Opción 1 · marcar desde cada insight
              </div>
              <ol className="mt-2 list-decimal pl-5 text-sm text-muted space-y-2">
                <li>Abre un insight concreto.</li>
                <li>
                  En cada fila usa el icono de bloquear para marcarla como &quot;ya
                  gestionada&quot;.
                </li>
                <li>La fila se ocultará aquí y dejará de entrar en futuros análisis del motor.</li>
              </ol>
            </div>
            <div className="surface-subtle p-4">
              <div className="font-semibold text-foreground">
                Opción 2 · importar un sheet/CSV
              </div>
              <p className="mt-2 text-sm text-muted">
                Sube un CSV con cabeceras <strong>query</strong> y <strong>url</strong>, o con esas
                dos columnas en ese orden.
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-brand-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover">
                <Upload size={16} /> Importar CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const content = await file.text();
                    const importedCount = importEntries(content);
                    showSuccess(`${importedCount} filas añadidas a exclusiones.`);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
            <div className="font-semibold">Formato recomendado del sheet</div>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-3 text-xs">{`query,url
mejores zapatillas running,https://dominio.com/running
auditoria seo local,https://dominio.com/seo-local`}</pre>
            <p className="mt-2">
              Exclusiones guardadas actualmente: <strong>{ignoredEntries.length}</strong>.
            </p>
          </div>
        </Modal>
      )}

      {showBrandConfigModal && (
        <Modal
          isOpen={showBrandConfigModal}
          onClose={() => setShowBrandConfigModal(false)}
          title="Configurar segmentación Brand / Non-brand"
          className="max-w-2xl"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Esta configuración se guarda en el proyecto actual y se reutiliza en insights, top
              consultas e impacto GSC.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                Sector del proyecto
              </label>
              <Input
                value={projectSectorDraft}
                onChange={(event) => setProjectSectorDraft(event.target.value)}
                placeholder="Ej. Salud, Legal, SaaS..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                Términos de marca (coma, salto de línea o punto y coma)
              </label>
              <textarea
                value={brandTermsDraft}
                onChange={(event) => setBrandTermsDraft(event.target.value)}
                className="min-h-[120px] w-full rounded-lg border border-border bg-surface-alt p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="acme, acme corp, producto x"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                Tipologías extra para ampliar análisis
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['MEDIA', 'ECOM', 'LOCAL', 'NATIONAL', 'INTERNATIONAL'] as ProjectType[]).map((type) => (
                  <label key={type} className="flex items-center gap-2 rounded-md border border-border bg-surface-alt px-2 py-1 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={analysisProjectTypesDraft.includes(type)}
                      onChange={(event) => {
                        setAnalysisProjectTypesDraft((prev) => {
                          if (event.target.checked) {
                            return Array.from(new Set([...prev, type]));
                          }
                          return prev.filter((item) => item !== type);
                        });
                      }}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-alt p-3 text-xs text-muted">
              <span>Proyecto actual: {currentClient?.name || 'Sin proyecto'}</span>
              <span>Tipo: {currentClient?.projectType || 'MEDIA'}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowBrandConfigModal(false)}>
                Cancelar
              </Button>
              <Button onClick={saveBrandConfig}>Guardar configuración</Button>
            </div>
          </div>
        </Modal>
      )}

      {showGscConfig && (
        <Modal
          isOpen={showGscConfig}
          onClose={() => setShowGscConfig(false)}
          title="Configuración Global API"
          className="max-w-md"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
              <Settings size={20} />
            </h3>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            Introduce el <strong>Client ID</strong> de tu proyecto en Google Cloud para conectar
            Search Console.
          </p>
          <label className="mb-1 block text-xs font-bold uppercase text-muted">
            OAuth 2.0 Client ID
          </label>
          <Input
            type="text"
            className="mb-4 font-mono"
            placeholder="xxxx-xxxx.apps.googleusercontent.com"
            defaultValue={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <Button onClick={() => handleSaveClientId(clientId)} className="w-full font-bold">
            Guardar Configuración Global
          </Button>
        </Modal>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            Visión General de Madurez
            <Badge variant={scoreBadge.variant}>{scoreBadge.title}</Badge>
          </h2>
          <p className="text-muted mt-1">
            Sigue la evolución SEO de tu publicación desde la auditoría hasta la autoridad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!googleUser ? (
            <>
              <button
                onClick={() => setShowGscConfig(true)}
                className="p-2 text-muted hover:text-foreground"
              >
                <Settings size={20} />
              </button>
              <Button onClick={() => login()} variant="secondary">
                <LogIn size={16} className="icon-tone-primary" />
                <span>Login con Google</span>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3 bg-surface border border-border rounded-lg p-1.5 pr-4 shadow-sm">
              <div className="relative">
                <img
                  src={googleUser.picture}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-border"
                />
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-success border-2 border-surface rounded-full"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground leading-tight">
                  {googleUser.name}
                </span>
                <span className="text-[10px] text-muted leading-tight">{googleUser.email}</span>
              </div>
              <button onClick={handleLogoutGsc} className="ml-2 text-muted hover:text-danger">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="mx-2 hidden h-8 w-px bg-border md:block"></div>
          <Button onClick={handleExport} variant="secondary">
            <Download size={16} /> Exportar
          </Button>
        </div>
      </header>

      <Card className="h-16 w-full max-w-2xl p-2 flex items-center gap-2">
        <Button
          onClick={simulateVoiceRecording}
          size="sm"
          className={`rounded-lg p-3 transition-colors ${isRecording ? 'bg-danger-soft text-danger animate-pulse' : 'bg-surface-alt text-muted'}`}
        >
          <Mic size={20} />
        </Button>
        <Input
          type="text"
          value={quickTask}
          onChange={(e) => setQuickTask(e.target.value)}
          placeholder={isRecording ? 'Escuchando...' : 'Nota rápida...'}
          className="flex-1 border-0 bg-transparent"
        />
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <HeroMetric
          title="Score global"
          value={`${Math.round(effectiveGlobalScore)}%`}
          description={`Estructural ${hybridGlobalScore.structuralSubscore}% · Rendimiento ${hybridGlobalScore.performanceSubscore}% · Variación ${hybridGlobalScore.variationVsPrevious >= 0 ? '+' : ''}${hybridGlobalScore.variationVsPrevious}.`}
          tone="bg-gradient-to-br from-slate-900 to-slate-700 text-on-primary"
          onClick={() => navigate('/app/roadmap')}
          ctaLabel="Abrir roadmap"
        />
        <HeroMetric
          title="Rendimiento GSC"
          value={`${formatNumberSafe(performanceSummary.current.clicks, '0')} clics`}
          description={`Impresiones ${formatNumberSafe(performanceSummary.current.impressions, '0')} · CTR ${performanceSummary.current.ctr.toFixed(2)}% · Posición ${performanceSummary.current.position.toFixed(1) || 'N/A'}.`}
          tone="bg-gradient-to-br from-blue-500 to-indigo-600 text-on-primary"
          onClick={() => setSelectedCategory('opportunity')}
          ctaLabel="Ver oportunidades"
        />
        <HeroMetric
          title="Brand vs Non-brand"
          value={`${brandDeltaSummary.current.brand.toLocaleString()} / ${brandDeltaSummary.current.nonBrand.toLocaleString()}`}
          description={`Δ Brand ${brandDeltaSummary.delta.brand >= 0 ? '+' : ''}${brandDeltaSummary.delta.brand.toLocaleString()} · Δ Non-brand ${brandDeltaSummary.delta.nonBrand >= 0 ? '+' : ''}${brandDeltaSummary.delta.nonBrand.toLocaleString()} clics.`}
          tone="bg-gradient-to-br from-emerald-500 to-teal-600 text-on-primary"
          onClick={() => setTrafficSegmentFilter('non-brand')}
          ctaLabel="Filtrar non-brand"
        />
        <HeroMetric
          title="Cobertura de análisis"
          value={`${visibleSelectedGscSite ? 1 : 0}/${Math.max(1, filteredGscSites.length)}`}
          description={`${newInsightsCount} insights nuevos · ${comparisonPeriod ? GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode] : 'sin comparativa'} · ${comparisonSummary}`}
          tone="bg-gradient-to-br from-rose-500 to-red-700 text-on-primary"
          onClick={() => setSelectedStatus('new')}
          ctaLabel="Ver insights nuevos"
        />
      </section>

      <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-lg">Centro de decisión SEO</h3>
            <p className="text-sm text-muted mt-1">
              Lectura ejecutiva contextual: dato GSC → insight → tarea validable según tipología y sector.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral" className="text-xs">
              Contexto: {contextLabel}
            </Badge>
            <Badge variant="neutral" className="text-xs">
              Propiedad: {visibleSelectedGscSite || 'sin seleccionar'}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-alt p-4 text-xs text-muted">
          <div className="font-semibold text-foreground text-sm">Prioridades activas</div>
          <div className="mt-1">
            {contextProfile.focusAreas.join(' · ')}
          </div>
          <div className="mt-2">{contextProfile.sectorExamples}</div>
        </div>

        <div className="rounded-xl border border-border bg-surface-alt p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-semibold text-foreground text-sm">Ponderación aplicada al score</div>
            {projectScoreContext?.fallbackUsed ? <Badge variant="warning">Fallback genérico</Badge> : <Badge variant="success">Configuración contextual</Badge>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            {(projectScoreContext?.appliedWeights || []).slice(0, 5).map((entry) => (
              <div key={entry.moduleId} className="rounded-lg border border-border bg-surface p-2">
                <div className="text-muted">M{entry.moduleId}</div>
                <div className="font-semibold text-foreground">{entry.weight}%</div>
                <div className="text-[10px] text-muted">origen: {entry.source}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted">
            Score actual ponderado: <strong className="text-foreground">{projectScoreContext?.score ?? globalScore}%</strong> · Contexto: {activeProjectType} / {activeSector} / {activeGeoScope}
          </div>
          <div className="space-y-1 text-xs text-muted">
            <div className="font-medium text-foreground">Módulos críticos para este contexto</div>
            {weightedCriticalModules.length === 0 ? (
              <div>Sin módulos críticos calculados.</div>
            ) : (
              weightedCriticalModules.map((item) => (
                <div key={item.moduleId}>
                  M{item.moduleId} · {item.title} — peso {item.weight}% · madurez {item.maturity}%
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-alt p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold text-foreground text-sm">Score híbrido (estructura + rendimiento real)</div>
            {hybridGlobalScore.fallbackUsed ? (
              <Badge variant="warning">Sin GSC suficiente · fallback activo</Badge>
            ) : (
              <Badge variant="success">Híbrido con señal GSC</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-muted">Score Global</div>
              <div className="text-xl font-bold text-foreground">{hybridGlobalScore.globalScore}%</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-muted">Subscore estructural</div>
              <div className="text-xl font-bold text-foreground">{hybridGlobalScore.structuralSubscore}%</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-muted">Subscore rendimiento</div>
              <div className="text-xl font-bold text-foreground">{hybridGlobalScore.performanceSubscore}%</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-muted">Variación vs anterior</div>
              <div className="text-xl font-bold text-foreground">
                {hybridGlobalScore.variationVsPrevious >= 0 ? '+' : ''}
                {hybridGlobalScore.variationVsPrevious}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-success/30 bg-success-soft p-3">
              <div className="font-medium text-foreground">Qué lo sube</div>
              {hybridGlobalScore.driversUp.length === 0 ? (
                <div className="mt-1 text-muted">Sin señales positivas destacadas en este periodo.</div>
              ) : (
                hybridGlobalScore.driversUp.slice(0, 3).map((driver) => (
                  <div key={driver.key} className="mt-1 text-muted">
                    <strong className="text-foreground">{driver.label}</strong>: {driver.detail}
                  </div>
                ))
              )}
            </div>
            <div className="rounded-lg border border-danger/30 bg-danger-soft p-3">
              <div className="font-medium text-foreground">Qué lo baja</div>
              {hybridGlobalScore.driversDown.length === 0 ? (
                <div className="mt-1 text-muted">Sin señales de caída relevantes.</div>
              ) : (
                hybridGlobalScore.driversDown.slice(0, 3).map((driver) => (
                  <div key={driver.key} className="mt-1 text-muted">
                    <strong className="text-foreground">{driver.label}</strong>: {driver.detail}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="text-[11px] text-muted">
            Trazabilidad: {hybridGlobalScore.trace.propertyId} · actual {hybridGlobalScore.trace.periodCurrent} · anterior {hybridGlobalScore.trace.periodPrevious} · módulo {hybridGlobalScore.trace.module} · ts {new Date(hybridGlobalScore.trace.timestamp).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted">Oportunidades</div>
            <div className="mt-1 text-2xl font-bold text-foreground">{actionableTopOpportunities.length}</div>
            <div className="mt-1 text-xs text-muted line-clamp-2">{actionableTopOpportunities[0]?.title || contextProfile.opportunitiesHint}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted">Riesgos</div>
            <div className="mt-1 text-2xl font-bold text-foreground">{actionableTopRisks.length}</div>
            <div className="mt-1 text-xs text-muted line-clamp-2">{actionableTopRisks[0]?.title || contextProfile.risksHint}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted">Quick wins</div>
            <div className="mt-1 text-2xl font-bold text-foreground">{prioritizedQuickWins.length}</div>
            <div className="mt-1 text-xs text-muted">{contextProfile.quickWinsHint}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted">Anomalías</div>
            <div className="mt-1 text-2xl font-bold text-foreground">{prioritizedAnomalies.length}</div>
            <div className="mt-1 text-xs text-muted">Detectadas con señal priorizada para {activeProjectType.toLowerCase()}.</div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary-soft p-4">
            <div className="text-[11px] uppercase tracking-wide text-primary">Siguiente acción recomendada</div>
            <div className="mt-1 text-sm font-semibold text-foreground line-clamp-2">{recommendedAction?.title || 'Configura propiedad y periodo para generar acción recomendada.'}</div>
            <div className="mt-1 text-xs text-muted line-clamp-3">{recommendedAction?.action || contextProfile.nextActionHint}</div>
            {recommendedAction && (
              <div className="mt-2 space-y-1 text-[10px] text-muted">
                <div>Origen: {recommendedAction.trace.source}</div>
                <div>Propiedad: {recommendedAction.trace.property}</div>
                <div>Query: {recommendedAction.trace.query}</div>
                <div>URL: {recommendedAction.trace.url}</div>
                <div>Módulo: {recommendedAction.trace.module}</div>
                <div>Timestamp: {new Date(recommendedAction.trace.timestamp).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      </section>


      <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-lg">Quick wins y anomalías automáticas (GSC)</h3>
            <p className="text-sm text-muted mt-1">
              Hallazgos accionables adaptados a {contextLabel} con fallback genérico para análisis cruzado.
            </p>
          </div>
          <Badge variant="neutral" className="text-xs">
            Umbrales centralizados por tipología/sector
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/40 p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground">Quick wins</h4>
              <Badge variant="success">{prioritizedQuickWins.length}</Badge>
            </div>
            <div className="mt-3 space-y-3">
              {prioritizedQuickWins.length > 0 ? prioritizedQuickWins.map((insight) => (
                <button
                  key={insight.id}
                  onClick={() => setSelectedInsight(insight)}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-left hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground line-clamp-2">{insight.title}</div>
                    <Badge variant={priorityVariant[insight.priority]} className="text-[10px]">{priorityLabel[insight.priority]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted line-clamp-2">{insight.summary}</p>
                  <div className="mt-1 text-[11px] text-muted">{insight.appliesBecause}</div>
                  <div className="mt-2 text-[11px] text-muted">Score {insight.score} · {insight.affectedCount} filas · regla {insight.ruleKey}</div>
                </button>
              )) : <div className="text-xs text-muted">Sin quick wins detectados en este periodo.</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200/50 bg-rose-50/40 p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground">Anomalías</h4>
              <Badge variant="danger">{prioritizedAnomalies.length}</Badge>
            </div>
            <div className="mt-3 space-y-3">
              {prioritizedAnomalies.length > 0 ? prioritizedAnomalies.map((insight) => (
                <button
                  key={insight.id}
                  onClick={() => setSelectedInsight(insight)}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-left hover:border-danger/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground line-clamp-2">{insight.title}</div>
                    <Badge variant={severityVariant[insight.severity]} className="text-[10px]">{insight.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted line-clamp-2">{insight.summary}</p>
                  <div className="mt-1 text-[11px] text-muted">{insight.appliesBecause}</div>
                  <div className="mt-2 text-[11px] text-muted">Score {insight.score} · {insight.affectedCount} filas · regla {insight.ruleKey}</div>
                </button>
              )) : <div className="text-xs text-muted">Sin anomalías críticas detectadas en este periodo.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg">Motor de insights SEO</h3>
            <p className="text-sm text-muted mt-1">
              Del dato GSC al diagnóstico: origen, regla, prioridad y acción quedan trazados en una
              estructura homogénea.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleExportInsightsWorkbook}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm font-medium text-success hover:border-success/50"
            >
              <Download size={16} /> Exportar análisis detallado Excel
            </button>
            <button
              type="button"
              onClick={() => setShowInsightsHelp(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-sm font-medium text-primary hover:border-primary/50"
            >
              <HelpCircle size={16} /> Ayuda
            </button>
            <select
              className="px-3 py-2 rounded-lg border border-border bg-surface-alt text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as SeoInsightCategory | 'all')}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-border bg-surface-alt text-sm"
              value={selectedPriority}
              onChange={(e) =>
                setSelectedPriority(e.target.value as 'all' | 'high' | 'medium' | 'low')
              }
            >
              <option value="all">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-border bg-surface-alt text-sm"
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              <option value="all">Todos los módulos</option>
              {Array.from(new Set(actionableInsights.map((insight) => String(insight.moduleId || '')).filter(Boolean))).map((moduleValue) => (
                <option key={moduleValue} value={moduleValue}>Módulo {moduleValue}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-border bg-surface-alt text-sm"
              value={selectedBrandType}
              onChange={(e) => setSelectedBrandType(e.target.value as 'all' | SeoInsightBrandType)}
            >
              <option value="all">Brand + Non-brand</option>
              <option value="brand">Brand</option>
              <option value="non-brand">Non-brand</option>
              <option value="mixed">Mixed</option>
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-border bg-surface-alt text-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | SeoInsightLifecycleStatus)}
            >
              <option value="all">Todos los estados</option>
              <option value="new">new</option>
              <option value="triaged">triaged</option>
              <option value="planned">planned</option>
              <option value="in_progress">in_progress</option>
              <option value="done">done</option>
              <option value="ignored">ignored</option>
              <option value="postponed">postponed</option>
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-border bg-surface-alt text-sm"
              value={selectedRuleScope}
              onChange={(e) => setSelectedRuleScope(e.target.value as 'all' | 'generic' | 'project_type' | 'sector')}
            >
              <option value="all">Todas las reglas</option>
              <option value="generic">Genéricas</option>
              <option value="project_type">Específicas tipología</option>
              <option value="sector">Específicas sector</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredInsights.length > 0 ? (
            filteredInsights.map((insight) => (
              <div key={insight.id}>
                <InsightCard insight={insight} />
              </div>
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-border p-10 text-center text-muted">
              No hay insights que coincidan con los filtros seleccionados.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {actionableGroupedInsights.map((group) => (
            <div
              key={group.category}
              className="rounded-2xl bg-surface-alt/50 border border-border p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="font-bold text-foreground">{group.label}</h4>
                <Badge variant={priorityVariant[group.topPriority]} className="text-xs font-bold">
                  Prioridad {priorityLabel[group.topPriority]}
                </Badge>
              </div>
              <p className="text-sm text-muted">{group.description}</p>
              <div className="mt-4 space-y-3">
                {group.insights.slice(0, 3).map((insight) => (
                  <button
                    key={insight.id}
                    onClick={() => setSelectedInsight(insight)}
                    className="w-full text-left rounded-xl bg-surface border border-border p-4 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {insight.title}
                        </div>
                        <div className="text-xs text-muted mt-1 line-clamp-2">
                          {insight.summary}
                        </div>
                        <div className="mt-1 text-[11px] text-muted line-clamp-2">
                          {insight.appliesBecause}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{insight.score}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted">
                          score
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ErrorBoundary
            title="Se interrumpió el panel de Search Console"
            message="Falló la carga de datos de Search Console. Puedes reintentar sin perder el resto del Dashboard."
          >
            {gscAccessToken ? (
              <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                <Search size={200} />
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-primary/30 bg-primary-soft p-2.5 text-primary shadow-sm">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Rendimiento en Búsqueda
                    </h3>
                    <div className="flex items-center gap-1 text-xs font-medium text-muted">
                      <span className="w-2 h-2 rounded-full bg-success"></span>
                      Datos reales de Search Console
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs font-medium text-foreground"
                    value={selectedPerformanceMetric}
                    onChange={(event) => setSelectedPerformanceMetric(event.target.value as PerformanceMetric)}
                    aria-label="Métrica principal del gráfico"
                  >
                    {Object.entries(PERFORMANCE_METRIC_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs font-medium text-foreground"
                    value={trafficSegmentFilter}
                    onChange={(event) =>
                      setTrafficSegmentFilter(event.target.value as QueryBrandFilter)
                    }
                  >
                    <option value="all">Tráfico total</option>
                    <option value="brand">Solo brand</option>
                    <option value="non-brand">Solo non-brand</option>
                  </select>
                  <select
                    className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs font-medium text-foreground"
                    value={queryCategoryFilter}
                    onChange={(event) => setQueryCategoryFilter(event.target.value as QueryCategoryFilter)}
                  >
                    <option value="all">Categoría: todas</option>
                    <option value="informational">Informacional</option>
                    <option value="commercial">Comercial</option>
                    <option value="navigational">Navegacional</option>
                    <option value="local">Local</option>
                    <option value="other">Otras</option>
                  </select>
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={showRoadmapAnnotations}
                      onChange={(event) => setShowRoadmapAnnotations(event.target.checked)}
                    />
                    Hitos roadmap
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setProjectSectorDraft(currentClient?.sector || 'Otro');
                      setBrandTermsDraft((currentClient?.brandTerms || []).join('\n'));
                      setAnalysisProjectTypesDraft(
                        currentClient?.analysisProjectTypes || (currentClient?.projectType ? [currentClient.projectType] : ['MEDIA']),
                      );
                      setShowBrandConfigModal(true);
                    }}
                  >
                    <Settings size={14} />
                    Configurar brand
                  </Button>
                  <GSCDateRangeControl
                    startDate={startDate}
                    endDate={endDate}
                    onRangeChange={(start, end) => {
                      setStartDate(start);
                      setEndDate(end);
                    }}
                  />
                  <div className="flex flex-col gap-2 bg-surface-alt p-2 rounded-lg border border-border min-w-[240px]">
                    <select
                      className="w-full rounded-md border border-border bg-surface px-2 py-2 text-xs font-medium text-foreground"
                      value={comparisonMode}
                      onChange={(e) => setComparisonMode(e.target.value as GSCComparisonMode)}
                      aria-label="Tipo de comparativa GSC"
                    >
                      <option value="previous_period">Comparar con periodo pasado</option>
                      <option value="previous_year">Comparar con año pasado</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Search size={14} className="ml-1 text-muted" />
                      <input
                        type="search"
                        value={gscSiteQuery}
                        onChange={(e) => setGscSiteQuery(e.target.value)}
                        placeholder="Buscar propiedad"
                        aria-label="Buscar propiedad de Search Console"
                        className="w-full bg-transparent p-1 text-xs font-medium text-foreground outline-none placeholder:text-muted"
                      />
                    </div>
                    <div className="flex items-center gap-2 border-t border-border pt-2">
                      <Globe size={14} className="ml-1 text-muted" />
                      <select
                        className="w-full bg-transparent text-xs font-medium p-1.5 outline-none text-foreground"
                        value={visibleSelectedGscSite}
                        onChange={(e) => setSelectedSite(e.target.value)}
                      >
                        {filteredGscSites.length > 0 ? (
                          <>
                            {!visibleSelectedGscSite && (
                              <option value="" disabled>
                                Selecciona una propiedad
                              </option>
                            )}
                            {filteredGscSites.map((site) => (
                              <option key={site.siteUrl} value={site.siteUrl}>
                                {(site.siteUrl || '').replace('sc-domain:', '') || 'Propiedad sin URL'}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value="" disabled>
                            No hay propiedades que coincidan
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 text-xs text-muted relative z-10">
                Periodo actual: <strong>{startDate}</strong> a <strong>{endDate}</strong>
                {comparisonPeriod && (
                  <>
                    {' '}
                    · {GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode]}:{' '}
                    <strong>{comparisonPeriod.previous.startDate}</strong> a{' '}
                    <strong>{comparisonPeriod.previous.endDate}</strong>
                  </>
                )}
                {' '}· Propiedad activa: <strong>{(selectedSite || '').replace('sc-domain:', '') || 'Sin propiedad'}</strong> · Segmento: <strong>{trafficSegmentFilter}</strong> · Categoría: <strong>{queryCategoryFilter}</strong>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface-alt p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Δ Clics</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {performanceSummary.delta.clicks >= 0 ? '+' : ''}
                    {performanceSummary.delta.clicks.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface-alt p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Δ Impresiones</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {performanceSummary.delta.impressions >= 0 ? '+' : ''}
                    {performanceSummary.delta.impressions.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface-alt p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Δ CTR</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {performanceSummary.delta.ctr >= 0 ? '+' : ''}
                    {performanceSummary.delta.ctr.toFixed(2)} pp
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface-alt p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Δ Posición</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {performanceSummary.delta.position >= 0 ? '+' : ''}
                    {performanceSummary.delta.position.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted">Negativo es mejora (menos posición media).</div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface-alt p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Total</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {formatNumberSafe(topQuerySummary.total.clicks, '0')} clics
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface-alt p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Brand</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {formatNumberSafe(topQuerySummary.brand.clicks, '0')} clics
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface-alt p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Non-brand</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {formatNumberSafe(topQuerySummary.nonBrand.clicks, '0')} clics
                  </div>
                  <div className="text-[11px] text-muted">
                    {topQuerySummary.reviewCount} queries en revisión (mixed)
                  </div>
                </div>
              </div>

              <div className="mb-3 rounded-xl border border-border bg-surface-alt p-3 text-xs text-muted">
                <strong className="text-foreground">Lectura ejecutiva:</strong>{' '}
                {performanceSummary.delta.clicks >= 0
                  ? 'el tráfico orgánico crece'
                  : 'el tráfico orgánico cae'}{' '}
                {Math.abs(performanceSummary.delta.clicks).toFixed(1)}% mientras que las impresiones{' '}
                {performanceSummary.delta.impressions >= 0 ? 'suben' : 'bajan'}{' '}
                {Math.abs(performanceSummary.delta.impressions).toFixed(1)}%. Revisa la relación CTR/posición para priorizar snippet, intención y enlazado interno.
              </div>

              <div className="h-72 w-full">
                {isLoadingGsc ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
                    <Spinner size={32} />
                    <Skeleton width="60%" height="20px" />
                    <span className="text-sm">Sincronizando datos de Google...</span>
                  </div>
                ) : gscChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={gscChartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                        opacity={0.5}
                      />
                      <XAxis dataKey="label" hide axisLine={false} tickLine={false} />
                      <YAxis
                        yAxisId="metric"
                        tick={{ fontSize: 10, fill: '#3b82f6' }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          fontFamily: 'Inter, sans-serif',
                        }}
                        labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Area
                        type="monotone"
                        dataKey="currentMetricValue"
                        yAxisId="metric"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorClicks)"
                        name={`${PERFORMANCE_METRIC_LABELS[selectedPerformanceMetric]} actual`}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="comparisonMetricValue"
                        yAxisId="metric"
                        stroke="#0f766e"
                        strokeWidth={2}
                        fillOpacity={0}
                        strokeDasharray="6 6"
                        name={
                          comparisonPeriod
                            ? `${PERFORMANCE_METRIC_LABELS[selectedPerformanceMetric]} ${GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode]}`
                            : 'Serie comparada'
                        }
                      />
                      {showRoadmapAnnotations &&
                        roadmapAnnotations.map((annotation) => (
                          <ReferenceLine
                            key={annotation.id}
                            x={annotation.date}
                            stroke="#f59e0b"
                            strokeDasharray="3 3"
                            label={{ value: 'Hito', position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
                          />
                        ))}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted bg-surface-alt/50 rounded-xl border border-dashed border-border">
                    <Search size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">Sin datos disponibles para este periodo.</p>
                    <p className="text-xs opacity-70">
                      Prueba cambiando de propiedad o verifica tu Search Console.
                    </p>
                  </div>
                )}
              </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-primary-soft rounded-lg text-primary">
                        <CheckCircle2 size={24} />
                      </div>
                    </div>
                    <p className="text-muted text-sm font-medium">
                      Tareas Completadas
                    </p>
                    <h3 className="text-3xl font-bold mt-1">
                      {modules.reduce(
                        (acc, m) => acc + m.tasks.filter((t) => t.status === 'completed').length,
                        0,
                      )}
                      <span className="text-muted/70 text-lg ml-2 font-normal">
                        / {modules.reduce((acc, m) => acc + m.tasks.length, 0)}
                      </span>
                    </h3>
                  </div>
                  <div className="w-full bg-surface-alt h-1.5 rounded-full mt-4">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${effectiveGlobalScore}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-warning-soft rounded-lg text-warning">
                        <AlertTriangle size={24} />
                      </div>
                      <span className="bg-danger-soft text-danger text-xs font-bold px-2 py-1 rounded-full">
                        Acción Requerida
                      </span>
                    </div>
                    <p className="text-muted text-sm font-medium">
                      Próxima Prioridad
                    </p>
                    <h3 className="text-xl font-bold mt-1 line-clamp-2">
                      {nextModule ? nextModule.title : 'Todo Limpio'}
                    </h3>
                  </div>
                  {nextModule && (
                    <button
                      onClick={() => navigate(`/app/module/${nextModule.id}`)}
                      className="mt-4 text-sm font-semibold text-primary hover:text-primary flex items-center gap-1"
                    >
                      Ir al Módulo <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </ErrorBoundary>

          <div className="bg-surface p-6 md:p-8 rounded-2xl shadow-sm border border-border">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold">Madurez por Módulo</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#334155"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
            <h3 className="font-bold mb-4">Qué revisar ahora</h3>
            <div className="space-y-3">
              {reviewNowActions.length > 0 ? (
                reviewNowActions.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedInsight(item.insight)}
                    className="w-full rounded-lg border border-border bg-surface-alt/40 p-3 text-left hover:border-primary/40"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Acción {index + 1}</div>
                    <div className="mt-1 text-sm font-semibold text-foreground line-clamp-2">{item.action}</div>
                    <div className="mt-1 text-xs text-muted line-clamp-2">{item.title}</div>
                    <div className="mt-1 text-[11px] text-muted">{item.context}</div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-surface-alt/20 p-3 text-xs text-muted">
                  No hay insights suficientes para sugerir 3 acciones. Conecta una propiedad GSC y amplía el rango de fechas para generar recomendaciones accionables.
                </div>
              )}
            </div>
          </div>

          {topQueriesNormalized.length > 0 ? (
            <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Flame className="text-warning" size={20} /> Top Consultas
                <span className="text-[10px] bg-primary-soft text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                  GSC Data
                </span>
              </h3>
              <div className="mb-3 text-xs text-muted">
                Tabla contextualizada por propiedad, periodo y filtros activos (brand/categoría). Desde cada query puedes abrir insight o convertir en tarea.
              </div>
              <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-surface-alt sticky top-0">
                    <tr className="text-left text-muted">
                      <th className="px-3 py-2">Query</th>
                      <th className="px-3 py-2">URL dominante</th>
                      <th className="px-3 py-2">Clicks</th>
                      <th className="px-3 py-2">Impr.</th>
                      <th className="px-3 py-2">CTR</th>
                      <th className="px-3 py-2">Pos.</th>
                      <th className="px-3 py-2">Δ vs prev.</th>
                      <th className="px-3 py-2">Tag</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topQueriesNormalized.map((row) => (
                      <tr key={`${row.query}-${row.dominantUrl}`} className="border-t border-border hover:bg-surface-alt/50">
                        <td className="px-3 py-2 font-semibold text-foreground">{row.query}</td>
                        <td className="px-3 py-2 max-w-[210px]">
                          <a
                            href={row.dominantUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-1 text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {row.dominantUrl}
                            <ExternalLink size={12} />
                          </a>
                        </td>
                        <td className="px-3 py-2">{formatNumberSafe(row.clicks, '0')}</td>
                        <td className="px-3 py-2">{formatNumberSafe(row.impressions, '0')}</td>
                        <td className="px-3 py-2">{row.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-2">{formatPositionSafe(row.position)}</td>
                        <td className="px-3 py-2 font-semibold">
                          {row.deltaClicksPct >= 0 ? '+' : ''}
                          {row.deltaClicksPct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              row.brandSegment === 'brand'
                                ? 'success'
                                : row.brandSegment === 'non-brand'
                                  ? 'primary'
                                  : 'warning'
                            }
                            className="text-[10px]"
                          >
                            {row.brandSegment === 'brand'
                              ? 'Brand'
                              : row.brandSegment === 'non-brand'
                                ? 'Non-brand'
                                : 'Mixed'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openQueryInsight(row)}>
                              Insight
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => createTaskFromQuery(row)}>
                              Tarea
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border opacity-60">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Flame className="text-muted" size={20} /> Top Consultas
              </h3>
              <div className="text-sm text-muted text-center py-4">
                Sin datos de consultas recientes.
              </div>
            </div>
          )}

          {trendingUrls.length > 0 ? (
            <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="text-primary" size={20} /> URLs en tendencia
                <span className="text-[10px] bg-primary-soft text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                  Pico detectado
                </span>
              </h3>
              <div className="space-y-3">
                {trendingUrls.map((trend, i) => (
                  <div key={`${trend.url}-${i}`} className="rounded-lg border border-border p-3 bg-surface-alt/40">
                    <div className="text-sm font-semibold text-foreground line-clamp-1">{trend.url}</div>
                    <div className="mt-1 text-xs text-muted">
                      Pico el <strong>{trend.peakDate}</strong> · +{Math.round(trend.clickIncrease).toLocaleString()} clics
                      vs base ({Math.max(0, Math.round(trend.baselineClicks)).toLocaleString()}).
                    </div>
                    <div className="mt-1 text-xs font-medium text-primary">
                      Multiplicó x{trend.surgeRatio.toFixed(1)} en pocos días.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border opacity-60">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="text-muted" size={20} /> URLs en tendencia
              </h3>
              <div className="text-sm text-muted text-center py-4">
                No se detectaron picos considerables con el periodo actual.
              </div>
            </div>
          )}

          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#64748b" opacity={0.3} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Madurez"
                    dataKey="A"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((m) => {
          const completedCount = m.tasks.filter((t) => t.status === 'completed').length;
          const totalCount = m.tasks.length;
          const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

          return (
            <div
              key={m.id}
              onClick={() => navigate(`/app/module/${m.id}`)}
              className="group cursor-pointer rounded-2xl border border-border bg-surface p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">
                  Nivel {m.levelRange}
                </span>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${progress === 100 ? 'bg-success-soft text-success' : 'bg-surface-alt text-muted group-hover:bg-primary-soft group-hover:text-primary'}`}
                >
                  M{m.id}
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                {m.title}
              </h3>
              <p className="text-sm text-muted mt-2 line-clamp-2 h-10">
                {m.description}
              </p>

              <div className="mt-6">
                <div className="flex justify-between text-xs font-medium text-muted mb-1">
                  <span>Progreso</span>
                  <span>
                    {completedCount}/{totalCount}
                  </span>
                </div>
                <div className="w-full bg-surface-alt h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
