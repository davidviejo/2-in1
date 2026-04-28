import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
import { GSCDimensionFilterGroup, GSCRow, ModuleData, SeoPerformanceSnapshot } from '../types';
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
import { getGSCDimensionDateData, getGSCPageDateData } from '../services/googleSearchConsole';
import ContextNoteButton from '@/components/ContextNoteButton';
import { openContextualNotes } from '@/utils/noteEvents';

const GSC_COMPARISON_MODE_LABELS: Record<GSCComparisonMode, string> = {
  previous_period: 'Periodo anterior',
  previous_year: 'Mismo periodo del año pasado',
};

const GOOGLE_SHEETS_MAX_CELLS = 10_000_000;
const GOOGLE_SHEETS_SAFE_CELLS = 9_200_000;
const GOOGLE_SHEETS_MAX_CELL_CHARACTERS = 50_000;
const GOOGLE_SHEETS_SAFE_CELL_CHARACTERS = 49_000;
const DASHBOARD_INSIGHT_TABLE_LIMIT_DEFAULT = 200;
const DASHBOARD_INSIGHT_TABLE_LIMIT_HARD_LIMIT = 5000;
const DASHBOARD_INSIGHT_TABLE_LIMIT_MIN = 50;
const DASHBOARD_GSC_ANALYSIS_MAX_ROWS_DEFAULT = 320000;
const DASHBOARD_GSC_ANALYSIS_MAX_ROWS_HARD_LIMIT = 4000000;
const DASHBOARD_GSC_ANALYSIS_MAX_ROWS_MIN = 25000;
const TRENDING_ANALYSIS_MAX_ROWS_DEFAULT = 25000;
const TRENDING_ANALYSIS_MAX_ROWS_HARD_LIMIT = 4000000;
const TRENDING_ANALYSIS_MAX_ROWS_MIN = 1000;

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
  periodKey: UrlTrendWindowKey;
  periodLabel: string;
  peakRange: string;
  currentClicks: number;
  baselineClicks: number;
  clickIncrease: number;
  clickChangePct: number;
  surgeRatio: number;
  impressions: number;
  ctr: number;
  position: number;
  statusLabel: string;
  score: number;
}

type UrlTrendWindowKey = '24h' | '7d' | '30d' | '3m' | '6m' | '12m';

interface UrlTrendWindowReport {
  key: UrlTrendWindowKey;
  label: string;
  statusLabel: string;
  currentRange: string;
  baselineRange: string;
  days: number;
  available: boolean;
  availabilityMessage?: string;
  rows: UrlTrendSignal[];
}

type PerformanceMetric = 'clicks' | 'impressions' | 'ctr' | 'position';
type QueryCategoryFilter = 'all' | 'informational' | 'commercial' | 'navigational' | 'local' | 'other';
type ForecastEntityType = 'url' | 'query';

interface ForecastSeriesPoint {
  date: string;
  clicks: number;
}

interface ForecastResult {
  points: Array<{
    label: string;
    actualClicks: number | null;
    forecastBase: number | null;
    forecastOptimized: number | null;
  }>;
  totalBase: number;
  totalOptimized: number;
  growthPct: number;
}

const parseUrlConditionLines = (rawValue: string) =>
  Array.from(
    new Set(
      rawValue
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  );

const parseBoundedInteger = (rawValue: string, fallback: number, minAllowed: number, maxAllowed: number) => {
  const normalized = rawValue.trim().replace(/[.,\s]/g, '');
  if (!/^\d+$/.test(normalized)) {
    return fallback;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  const bounded = Math.min(Math.floor(parsed), maxAllowed);
  return Math.max(bounded, minAllowed);
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (dateString: string, deltaDays: number) => {
  const baseDate = new Date(`${dateString}T00:00:00Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + deltaDays);
  return toIsoDate(baseDate);
};

const buildForecast = (
  series: ForecastSeriesPoint[],
  horizonDays: number,
  upliftPct: number,
): ForecastResult => {
  const safeSeries = [...series]
    .filter((point) => Boolean(point.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (safeSeries.length === 0) {
    return { points: [], totalBase: 0, totalOptimized: 0, growthPct: 0 };
  }

  const values = safeSeries.map((point) => Math.max(0, Number(point.clicks || 0)));
  const count = values.length;
  const xMean = (count - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    const centered = index - xMean;
    numerator += centered * (value - yMean);
    denominator += centered * centered;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  const upliftMultiplier = 1 + upliftPct / 100;
  const lastDate = safeSeries[safeSeries.length - 1].date;

  const actualPoints = safeSeries.map((point) => ({
    label: point.date,
    actualClicks: Number(point.clicks || 0),
    forecastBase: null,
    forecastOptimized: null,
  }));

  const forecastPoints = Array.from({ length: Math.max(0, horizonDays) }, (_, offset) => {
    const nextIndex = count + offset;
    const baseForecast = Math.max(0, intercept + slope * nextIndex);
    const optimizedForecast = baseForecast * upliftMultiplier;
    return {
      label: addDays(lastDate, offset + 1),
      actualClicks: null,
      forecastBase: Number(baseForecast.toFixed(2)),
      forecastOptimized: Number(optimizedForecast.toFixed(2)),
    };
  });

  const totalBase = forecastPoints.reduce((sum, point) => sum + (point.forecastBase || 0), 0);
  const totalOptimized = forecastPoints.reduce((sum, point) => sum + (point.forecastOptimized || 0), 0);
  const recentWindow = values.slice(Math.max(0, values.length - 14));
  const baselineRecentTotal = recentWindow.reduce((sum, value) => sum + value, 0);
  const growthPct = baselineRecentTotal > 0 ? ((totalBase - baselineRecentTotal) / baselineRecentTotal) * 100 : 0;

  return {
    points: [...actualPoints, ...forecastPoints],
    totalBase,
    totalOptimized,
    growthPct,
  };
};

const buildUrlConditionFilterGroups = (
  includeTerms: string[],
  excludeTerms: string[],
): GSCDimensionFilterGroup[] | undefined => {
  const groups: GSCDimensionFilterGroup[] = [];

  if (includeTerms.length > 0) {
    groups.push({
      groupType: 'or',
      filters: includeTerms.map((term) => ({
        dimension: 'page',
        operator: 'contains',
        expression: term,
      })),
    });
  }

  if (excludeTerms.length > 0) {
    groups.push({
      groupType: 'and',
      filters: excludeTerms.map((term) => ({
        dimension: 'page',
        operator: 'notContains',
        expression: term,
      })),
    });
  }

  return groups.length ? groups : undefined;
};

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

type ModuleExecutionTag = 'crítico' | 'en progreso' | 'validando impacto' | 'estable';

interface ModuleMaturityDetail {
  moduleId: number;
  moduleTitle: string;
  moduleDescription: string;
  score: number;
  openTasks: number;
  completedTasks: number;
  openInsights: number;
  quickWins: number;
  gscImpact: number | null;
  insights: SeoInsight[];
  keyTasks: ModuleData['tasks'];
  tag: ModuleExecutionTag;
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
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WINDOWS: Array<{ key: UrlTrendWindowKey; label: string; statusLabel: string; days: number }> = [
    { key: '24h', label: 'Últimas 24 horas', statusLabel: 'pico puntual', days: 1 },
    { key: '7d', label: 'Últimos 7 días', statusLabel: 'tendencia semanal', days: 7 },
    { key: '30d', label: 'Últimos 30 días', statusLabel: 'tendencia mensual', days: 30 },
    { key: '3m', label: 'Últimos 3 meses', statusLabel: 'tendencia trimestral', days: 90 },
    { key: '6m', label: 'Últimos 6 meses', statusLabel: 'tendencia semestral', days: 180 },
    { key: '12m', label: 'Últimos 12 meses', statusLabel: 'patrón anual', days: 365 },
  ];

  const groupedByUrl = new Map<string, Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>>();
  const allDates = new Set<string>();

  rows.forEach((row) => {
    const url = row.keys?.[0];
    const date = row.keys?.[1];
    if (!url || !date) return;

    const bucket = groupedByUrl.get(url) || [];
    bucket.push({
      date,
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      ctr: Number(row.ctr) || 0,
      position: Number(row.position) || 0,
    });
    groupedByUrl.set(url, bucket);
    allDates.add(date);
  });

  const sortedDates = Array.from(allDates).sort((a, b) => a.localeCompare(b));
  const newestDate = sortedDates[sortedDates.length - 1];
  if (!newestDate) return [];

  const sortedDateMs = sortedDates.map((date) => new Date(`${date}T00:00:00Z`).getTime());
  const getRangeDates = (endMs: number, days: number, offsetDays: number) => {
    const effectiveEndMs = endMs - offsetDays * DAY_MS;
    const startMs = effectiveEndMs - (days - 1) * DAY_MS;
    return {
      start: new Date(startMs).toISOString().slice(0, 10),
      end: new Date(effectiveEndMs).toISOString().slice(0, 10),
    };
  };

  const formatRange = (start: string, end: string) => (start === end ? start : `${start} → ${end}`);

  const resultsByWindow = WINDOWS.flatMap((windowDef) => {
    const requiredDays = windowDef.days * 2;
    if (sortedDates.length < requiredDays) {
      return [];
    }

    const bestTrendByUrl = new Map<string, UrlTrendSignal>();
    const anchorStartIndex = requiredDays - 1;
    const anchorEndIndex = sortedDateMs.length - 1;

    for (let anchorIndex = anchorStartIndex; anchorIndex <= anchorEndIndex; anchorIndex += 1) {
      const anchorDateMs = sortedDateMs[anchorIndex];
      const current = getRangeDates(anchorDateMs, windowDef.days, 0);
      const baseline = getRangeDates(anchorDateMs, windowDef.days, windowDef.days);

      groupedByUrl.forEach((entries, url) => {
        const currentRows = entries.filter((entry) => entry.date >= current.start && entry.date <= current.end);
        const baselineRows = entries.filter((entry) => entry.date >= baseline.start && entry.date <= baseline.end);
        if (currentRows.length === 0 || baselineRows.length === 0) return;

        const currentClicks = currentRows.reduce((sum, row) => sum + row.clicks, 0);
        const baselineClicks = baselineRows.reduce((sum, row) => sum + row.clicks, 0);
        const clickIncrease = currentClicks - baselineClicks;
        const clickChangePct = baselineClicks > 0 ? (clickIncrease / baselineClicks) * 100 : currentClicks > 0 ? 999 : 0;
        const surgeRatio = baselineClicks > 0 ? currentClicks / baselineClicks : currentClicks > 0 ? 99 : 0;

        const impressions = currentRows.reduce((sum, row) => sum + row.impressions, 0);
        const ctr = impressions > 0 ? (currentClicks / impressions) * 100 : 0;
        const position = impressions > 0
          ? currentRows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions
          : 0;

        const strongPct = clickChangePct >= 80 && clickIncrease >= (windowDef.days === 1 ? 10 : 20);
        const strongMultiplier = surgeRatio >= 2 && clickIncrease >= (windowDef.days === 1 ? 8 : 15);
        const strongAbsolute = clickIncrease >= Math.max(25, windowDef.days * 1.5);
        const hasPeak = clickIncrease > 0 && (strongPct || strongMultiplier || strongAbsolute);
        if (!hasPeak) return;

        const score = clickIncrease * Math.max(1, surgeRatio) + Math.max(0, clickChangePct);
        const candidateTrend: UrlTrendSignal = {
          url,
          periodKey: windowDef.key,
          periodLabel: windowDef.label,
          peakRange: formatRange(current.start, current.end),
          currentClicks,
          baselineClicks,
          clickIncrease,
          clickChangePct,
          surgeRatio,
          impressions,
          ctr,
          position,
          statusLabel: windowDef.statusLabel,
          score,
        };

        const existingTrend = bestTrendByUrl.get(url);
        if (!existingTrend || candidateTrend.score > existingTrend.score) {
          bestTrendByUrl.set(url, candidateTrend);
        }
      });
    }

    return Array.from(bestTrendByUrl.values());
  });

  return resultsByWindow.sort((a, b) => b.score - a.score);
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

const OPEN_INSIGHT_STATUSES: SeoInsightLifecycleStatus[] = [
  'new',
  'triaged',
  'planned',
  'in_progress',
  'postponed',
  'actionable',
  'watch',
  'investigate',
];

const resolveModuleExecutionTag = (input: {
  score: number;
  openTasks: number;
  openInsights: number;
  completedTasks: number;
  gscImpact: number | null;
}): ModuleExecutionTag => {
  if (input.score < 45 || input.openInsights >= 3) return 'crítico';
  if (input.openTasks > 0 || input.openInsights > 0) return 'en progreso';
  if (input.completedTasks > 0 && input.gscImpact !== null) return 'validando impacto';
  return 'estable';
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

const buildUniqueSheetName = (baseName: string, fallback: string, usedNames: Set<string>) => {
  const base = sanitizeSheetName(baseName, fallback);
  let candidate = base;
  let counter = 2;

  while (usedNames.has(candidate)) {
    const suffix = `_${counter}`;
    const maxBaseLength = Math.max(1, 31 - suffix.length);
    candidate = `${base.slice(0, maxBaseLength)}${suffix}`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
};

const sanitizeCellValueForSheets = (value: unknown): string | number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : '';
  }
  if (typeof value === 'string') {
    if (value.length <= GOOGLE_SHEETS_SAFE_CELL_CHARACTERS) {
      return value;
    }
    return `${value.slice(0, GOOGLE_SHEETS_SAFE_CELL_CHARACTERS - 1)}…`;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === null || value === undefined) {
    return '';
  }

  const serialized = String(value);
  if (serialized.length <= GOOGLE_SHEETS_SAFE_CELL_CHARACTERS) {
    return serialized;
  }

  return `${serialized.slice(0, GOOGLE_SHEETS_SAFE_CELL_CHARACTERS - 1)}…`;
};

const sanitizeRowsForSheets = (rows: Array<Record<string, unknown>>) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, sanitizeCellValueForSheets(value)]),
    ),
  );

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

type InsightRowBaselineMetrics = {
  previousClicks: number;
  previousImpressions: number;
  previousCtr: number;
  previousPosition: number;
};

const buildInsightBaselineMap = (rows: GSCRow[]) =>
  rows.reduce((acc, row) => {
    const query = row.keys?.[0] || '';
    const url = row.keys?.[1] || '';
    const key = `${query}|||${url}`;
    const previous = acc.get(key) || { clicks: 0, impressions: 0, positionWeighted: 0 };
    const clicks = Number(row.clicks || 0);
    const impressions = Number(row.impressions || 0);
    const position = Number(row.position || 0);
    previous.clicks += clicks;
    previous.impressions += impressions;
    previous.positionWeighted += position * impressions;
    acc.set(key, previous);
    return acc;
  }, new Map<string, { clicks: number; impressions: number; positionWeighted: number }>());

const getInsightBaselineMetrics = (
  row: SeoInsight['relatedRows'][number],
  baselineByQueryUrl: Map<string, { clicks: number; impressions: number; positionWeighted: number }>,
): InsightRowBaselineMetrics => {
  const query = row.query ?? row.keys?.[0] ?? '';
  const url = row.url ?? row.page ?? row.keys?.[1] ?? '';
  const key = `${query}|||${url}`;
  const baseline = baselineByQueryUrl.get(key) || { clicks: 0, impressions: 0, positionWeighted: 0 };
  const previousCtr = baseline.impressions > 0 ? (baseline.clicks / baseline.impressions) * 100 : 0;
  const previousPosition = baseline.impressions > 0 ? baseline.positionWeighted / baseline.impressions : 0;

  return {
    previousClicks: baseline.clicks,
    previousImpressions: baseline.impressions,
    previousCtr: Number(previousCtr.toFixed(2)),
    previousPosition: Number(previousPosition.toFixed(2)),
  };
};

const formatInsightEvidence = (insight: SeoInsight) =>
  insight.evidence
    .map((item) => `${item.label}: ${item.value}${item.context ? ` (${item.context})` : ''}`)
    .join(' || ');

const formatInsightTrace = (insight: SeoInsight) =>
  JSON.stringify({
    source: insight.trace?.source || '',
    query: insight.trace?.query || '',
    url: insight.trace?.url || '',
    propertyId: insight.trace?.propertyId || '',
    moduleId: insight.trace?.moduleId ?? '',
  });

const buildInsightExportRows = (
  insight: SeoInsight,
  baselineByQueryUrl: Map<string, { clicks: number; impressions: number; positionWeighted: number }>,
) => {
  const evidenceDetalle = formatInsightEvidence(insight);
  const traceDetalle = formatInsightTrace(insight);
  const metadataDetalle = JSON.stringify({
    sourceType: insight.sourceType,
    sourceId: insight.sourceId,
    affectedCount: insight.affectedCount,
    potentialTraffic: insight.potentialTraffic ?? '',
    findingFamily: insight.findingFamily || '',
  });

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
        affectedCount: insight.affectedCount,
        potentialTraffic: insight.potentialTraffic ?? '',
        sourceType: insight.sourceType,
        sourceId: insight.sourceId,
        findingFamily: insight.findingFamily || '',
        evidenciaDetalle: evidenceDetalle,
        traceDetalle,
        metadataDetalle,
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
    ...(() => {
      const baseline = getInsightBaselineMetrics(row, baselineByQueryUrl);
      const currentClicks = Number(row.clicks || 0);
      const currentImpressions = Number(row.impressions || 0);
      const currentCtrPct = Number(((row.ctr || 0) * 100).toFixed(2));
      const currentPosition = Number((row.position || 0).toFixed(2));
      return {
        previousClicks: baseline.previousClicks,
        deltaClicks: currentClicks - baseline.previousClicks,
        previousImpressions: baseline.previousImpressions,
        deltaImpressions: currentImpressions - baseline.previousImpressions,
        previousCtrPct: baseline.previousCtr,
        deltaCtrPp: Number((currentCtrPct - baseline.previousCtr).toFixed(2)),
        previousPosition: baseline.previousPosition,
        deltaPosition: Number((currentPosition - baseline.previousPosition).toFixed(2)),
      };
    })(),
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
    affectedCount: insight.affectedCount,
    potentialTraffic: insight.potentialTraffic ?? '',
    sourceType: insight.sourceType,
    sourceId: insight.sourceId,
    findingFamily: insight.findingFamily || '',
    evidenciaDetalle: evidenceDetalle,
    traceDetalle,
    metadataDetalle,
    ...mapInsightRowForExport(row),
  }));
};

const sumGscRows = (rows: GSCRow[]) => {
  const clicks = rows.reduce((sum, row) => sum + (Number(row.clicks) || 0), 0);
  const impressions = rows.reduce((sum, row) => sum + (Number(row.impressions) || 0), 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const position = impressions > 0
    ? rows.reduce((sum, row) => sum + (Number(row.position) || 0) * (Number(row.impressions) || 0), 0) / impressions
    : 0;

  return {
    clicks,
    impressions,
    ctr: Number(ctr.toFixed(2)),
    position: Number(position.toFixed(2)),
  };
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
  const GSC_DATA_DELAY_DAYS = 2;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { success: showSuccess, error: showError, info: showInfo } = useToast();
  const { currentClient, updateCurrentClientProfile, addTask, projectScoreContext, saveClientSnapshot } = useProject();
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
  const [showTrendingPanel, setShowTrendingPanel] = useState(false);
  const [forecastEntityType, setForecastEntityType] = useState<ForecastEntityType>('url');
  const [selectedForecastEntity, setSelectedForecastEntity] = useState('');
  const [forecastWeeks, setForecastWeeks] = useState<4 | 6 | 8>(6);
  const [forecastUpliftPct, setForecastUpliftPct] = useState(15);
  const [forecastSeriesCurrent, setForecastSeriesCurrent] = useState<ForecastSeriesPoint[]>([]);
  const [forecastSeriesPrevious, setForecastSeriesPrevious] = useState<ForecastSeriesPoint[]>([]);
  const [isLoadingForecastSeries, setIsLoadingForecastSeries] = useState(false);
  const [selectedModuleDetailId, setSelectedModuleDetailId] = useState<number | null>(null);
  const [projectSectorDraft, setProjectSectorDraft] = useState('');
  const [brandTermsDraft, setBrandTermsDraft] = useState('');
  const [analysisProjectTypesDraft, setAnalysisProjectTypesDraft] = useState<ProjectType[]>([]);
  const [historyScopeFilter, setHistoryScopeFilter] = useState<'all' | 'client' | 'property' | 'module'>('all');
  const [syncClock, setSyncClock] = useState(() => Date.now());
  const [isExportingTrendingUrls, setIsExportingTrendingUrls] = useState(false);
  const [isRunningTrendingAnalysis, setIsRunningTrendingAnalysis] = useState(false);
  const [trendingIncludeRaw, setTrendingIncludeRaw] = useState('');
  const [trendingExcludeRaw, setTrendingExcludeRaw] = useState('');
  const [trendingMaxRows, setTrendingMaxRows] = useState<number>(TRENDING_ANALYSIS_MAX_ROWS_DEFAULT);
  const [trendingUseCustomPeriod, setTrendingUseCustomPeriod] = useState(false);
  const [trendingStartDate, setTrendingStartDate] = useState('');
  const [trendingEndDate, setTrendingEndDate] = useState('');
  const [trendingAnalysisRows, setTrendingAnalysisRows] = useState<GSCRow[] | null>(null);
  const [gscIncludeRaw, setGscIncludeRaw] = useState('');
  const [gscExcludeRaw, setGscExcludeRaw] = useState('');
  const [gscRunKey, setGscRunKey] = useState(0);
  const [hasTriggeredGscRun, setHasTriggeredGscRun] = useState(false);
  const [gscRunAnalysisProjectTypes, setGscRunAnalysisProjectTypes] = useState<ProjectType[]>([]);
  const [gscRunIncludeTerms, setGscRunIncludeTerms] = useState<string[]>([]);
  const [gscRunExcludeTerms, setGscRunExcludeTerms] = useState<string[]>([]);
  const [gscAnalysisMaxRowsInput, setGscAnalysisMaxRowsInput] = useState<string>(() => {
    try {
      const persisted = localStorage.getItem('mediaflow_gsc_analysis_max_rows');
      if (!persisted) {
        return String(DASHBOARD_GSC_ANALYSIS_MAX_ROWS_DEFAULT);
      }
      const parsed = parseBoundedInteger(
        persisted,
        DASHBOARD_GSC_ANALYSIS_MAX_ROWS_DEFAULT,
        DASHBOARD_GSC_ANALYSIS_MAX_ROWS_MIN,
        DASHBOARD_GSC_ANALYSIS_MAX_ROWS_HARD_LIMIT,
      );
      return String(parsed);
    } catch (error) {
      console.warn('[Dashboard] No se pudo leer mediaflow_gsc_analysis_max_rows.', error);
      return String(DASHBOARD_GSC_ANALYSIS_MAX_ROWS_DEFAULT);
    }
  });
  const [insightTableLimitInput, setInsightTableLimitInput] = useState<string>(() => {
    try {
      const persisted = localStorage.getItem('mediaflow_gsc_insight_table_limit');
      if (!persisted) {
        return String(DASHBOARD_INSIGHT_TABLE_LIMIT_DEFAULT);
      }
      const parsed = parseBoundedInteger(
        persisted,
        DASHBOARD_INSIGHT_TABLE_LIMIT_DEFAULT,
        DASHBOARD_INSIGHT_TABLE_LIMIT_MIN,
        DASHBOARD_INSIGHT_TABLE_LIMIT_HARD_LIMIT,
      );
      return String(parsed);
    } catch (error) {
      console.warn('[Dashboard] No se pudo leer mediaflow_gsc_insight_table_limit.', error);
      return String(DASHBOARD_INSIGHT_TABLE_LIMIT_DEFAULT);
    }
  });
  const [trendingAnalysisScope, setTrendingAnalysisScope] = useState<{
    includeTerms: string[];
    excludeTerms: string[];
    rowsLoaded: number;
    periodStart: string;
    periodEnd: string;
    maxRowsRequested: number;
  } | null>(null);
  const gscAnalysisMaxRows = useMemo(
    () =>
      parseBoundedInteger(
        gscAnalysisMaxRowsInput,
        DASHBOARD_GSC_ANALYSIS_MAX_ROWS_DEFAULT,
        DASHBOARD_GSC_ANALYSIS_MAX_ROWS_MIN,
        DASHBOARD_GSC_ANALYSIS_MAX_ROWS_HARD_LIMIT,
      ),
    [gscAnalysisMaxRowsInput],
  );
  const insightTableLimit = useMemo(
    () =>
      parseBoundedInteger(
        insightTableLimitInput,
        DASHBOARD_INSIGHT_TABLE_LIMIT_DEFAULT,
        DASHBOARD_INSIGHT_TABLE_LIMIT_MIN,
        DASHBOARD_INSIGHT_TABLE_LIMIT_HARD_LIMIT,
      ),
    [insightTableLimitInput],
  );

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - GSC_DATA_DELAY_DAYS - 28);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - GSC_DATA_DELAY_DAYS);
    return d.toISOString().split('T')[0];
  });

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
    comparisonPeriod,
    isLoadingGsc,
    syncProgress,
    insights: { insights, groupedInsights },
  } = useGSCData(gscAccessToken, startDate, endDate, comparisonMode, {
    propertyId: currentClient?.id,
    brandTerms: currentClient?.brandTerms || [],
    projectType: currentClient?.projectType,
    analysisProjectTypes: gscRunAnalysisProjectTypes,
    sector: currentClient?.sector || 'Generico',
    geoScope: currentClient?.geoScope || 'global',
    deferTrendPageDateFetch: true,
    urlIncludeTerms: gscRunIncludeTerms,
    urlExcludeTerms: gscRunExcludeTerms,
    analysisMaxRows: gscAnalysisMaxRows,
    evolutionMaxRows: gscAnalysisMaxRows,
    autoRun: false,
    runKey: gscRunKey,
  });

  useEffect(() => {
    try {
      localStorage.setItem('mediaflow_gsc_analysis_max_rows', String(gscAnalysisMaxRows));
    } catch (error) {
      console.warn('[Dashboard] No se pudo guardar mediaflow_gsc_analysis_max_rows.', error);
    }
  }, [gscAnalysisMaxRows]);

  useEffect(() => {
    try {
      localStorage.setItem('mediaflow_gsc_insight_table_limit', String(insightTableLimit));
    } catch (error) {
      console.warn('[Dashboard] No se pudo guardar mediaflow_gsc_insight_table_limit.', error);
    }
  }, [insightTableLimit]);

  useEffect(() => {
    setTrendingAnalysisRows(null);
    setTrendingAnalysisScope(null);
  }, [selectedSite, startDate, endDate, comparisonMode]);

  useEffect(() => {
    if (trendingUseCustomPeriod) return;
    setTrendingStartDate(startDate);
    setTrendingEndDate(endDate);
  }, [startDate, endDate, trendingUseCustomPeriod]);

  useEffect(() => {
    setHasTriggeredGscRun(false);
    setGscRunKey(0);
  }, [selectedSite, startDate, endDate, comparisonMode, gscAccessToken]);

  useEffect(() => {
    setGscRunAnalysisProjectTypes(
      currentClient?.analysisProjectTypes || (currentClient?.projectType ? [currentClient.projectType] : ['MEDIA']),
    );
  }, [currentClient?.analysisProjectTypes, currentClient?.projectType]);

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
  const gscSyncPercent = useMemo(() => {
    if (!syncProgress.totalSteps) {
      return 0;
    }
    return Math.min(
      99,
      Math.max(0, Math.round((syncProgress.completedSteps / syncProgress.totalSteps) * 100)),
    );
  }, [syncProgress.completedSteps, syncProgress.totalSteps]);
  useEffect(() => {
    if (!isLoadingGsc) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setSyncClock(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoadingGsc]);
  const gscSyncElapsedSeconds = useMemo(() => {
    if (!isLoadingGsc || !syncProgress.startedAt) {
      return 0;
    }
    return Math.max(1, Math.round((syncClock - syncProgress.startedAt) / 1000));
  }, [isLoadingGsc, syncClock, syncProgress.startedAt]);

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

  const exportableActionableInsights = useMemo(
    () =>
      insights
        .map((insight) => {
          const visibleRows = insight.relatedRows.filter((row) => !isIgnored(row));
          const totalRows = visibleRows.length;
          return {
            ...insight,
            status: getInsightStatus(insight),
            relatedRows: visibleRows,
            affectedCount: totalRows,
          };
        })
        .filter((insight) => insight.relatedRows.length > 0),
    [insights, isIgnored, getInsightStatus],
  );

  const actionableInsights = useMemo(
    () =>
      exportableActionableInsights.map((insight) => ({
        ...insight,
        relatedRows: insight.relatedRows.slice(0, insightTableLimit),
      })),
    [exportableActionableInsights, insightTableLimit],
  );

  const moduleMaturityDetails = useMemo<ModuleMaturityDetail[]>(
    () =>
      modules.map((module) => {
        const completedTasks = module.tasks.filter((task) => task.status === 'completed').length;
        const openTasks = module.tasks.length - completedTasks;
        const structuralScore = module.tasks.length > 0
          ? Math.round((completedTasks / module.tasks.length) * 100)
          : 0;
        const score = Math.round(projectScoreContext?.moduleMaturity[module.id] ?? structuralScore);
        const relatedInsights = actionableInsights.filter((insight) => insight.moduleId === module.id);
        const openInsights = relatedInsights.filter((insight) => OPEN_INSIGHT_STATUSES.includes(insight.status)).length;
        const quickWins = relatedInsights.filter((insight) => insight.findingFamily === 'quick_win').length;
        const gscImpact = relatedInsights.length
          ? Number(
            (
              relatedInsights.reduce((sum, insight) => sum + Number(insight.impact || 0), 0) /
              relatedInsights.length
            ).toFixed(1),
          )
          : null;
        const keyTasks = [...module.tasks]
          .filter((task) => task.status !== 'completed')
          .sort((a, b) => {
            const impactOrder = { High: 3, Medium: 2, Low: 1 };
            return (impactOrder[b.impact] || 0) - (impactOrder[a.impact] || 0);
          })
          .slice(0, 3);

        return {
          moduleId: module.id,
          moduleTitle: module.title,
          moduleDescription: module.description,
          score,
          openTasks,
          completedTasks,
          openInsights,
          quickWins,
          gscImpact,
          insights: relatedInsights,
          keyTasks,
          tag: resolveModuleExecutionTag({ score, openTasks, openInsights, completedTasks, gscImpact }),
        };
      }),
    [actionableInsights, modules, projectScoreContext?.moduleMaturity],
  );

  const chartData = useMemo(
    () =>
      moduleMaturityDetails.map((item) => ({
        moduleId: item.moduleId,
        name: `M${item.moduleId}`,
        fullTitle: item.moduleTitle,
        score: item.score,
        color: item.score === 100 ? '#10b981' : item.score > 60 ? '#3b82f6' : '#f59e0b',
      })),
    [moduleMaturityDetails],
  );

  const selectedModuleDetail = useMemo(
    () => moduleMaturityDetails.find((item) => item.moduleId === selectedModuleDetailId) || moduleMaturityDetails[0] || null,
    [moduleMaturityDetails, selectedModuleDetailId],
  );

  const consumedInsightParamIdsRef = useRef<Set<string>>(new Set());
  const insightIdParam = searchParams.get('insightId') || '';

  useEffect(() => {
    if (!insightIdParam || actionableInsights.length === 0) return;
    if (consumedInsightParamIdsRef.current.has(insightIdParam)) return;

    const matched = actionableInsights.find((insight) => insight.id === insightIdParam);
    if (!matched) return;

    consumedInsightParamIdsRef.current.add(insightIdParam);
    setSelectedInsight(matched);

    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      nextParams.delete('insightId');
      return nextParams;
    }, { replace: true });
  }, [actionableInsights, insightIdParam, setSearchParams]);

  useEffect(() => {
    setSelectedModuleDetailId((prev) => {
      if (moduleMaturityDetails.length === 0) {
        return prev === null ? prev : null;
      }

      if (prev && moduleMaturityDetails.some((item) => item.moduleId === prev)) {
        return prev;
      }

      const firstModuleId = moduleMaturityDetails[0].moduleId;
      return prev === firstModuleId ? prev : firstModuleId;
    });
  }, [moduleMaturityDetails]);

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
              const totalRows = visibleRows.length;
              return {
                ...insight,
                relatedRows: visibleRows.slice(0, insightTableLimit),
                affectedCount: totalRows,
              };
            })
            .filter((insight) => insight.relatedRows.length > 0),
        }))
        .filter((group) => group.insights.length > 0),
    [groupedInsights, insightTableLimit, isIgnored],
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

  const forecastEntityOptions = useMemo(() => {
    if (forecastEntityType === 'query') {
      return topQueriesNormalized.map((row) => row.query).filter(Boolean).slice(0, 25);
    }

    const byUrl = (queryPageData || []).reduce((acc, row) => {
      const url = row.keys?.[1] || '';
      if (!url) return acc;
      const previous = acc.get(url) || 0;
      acc.set(url, previous + Number(row.clicks || 0));
      return acc;
    }, new Map<string, number>());

    return Array.from(byUrl.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([url]) => url)
      .slice(0, 25);
  }, [forecastEntityType, queryPageData, topQueriesNormalized]);

  useEffect(() => {
    if (!forecastEntityOptions.includes(selectedForecastEntity)) {
      setSelectedForecastEntity(forecastEntityOptions[0] || '');
    }
  }, [forecastEntityOptions, selectedForecastEntity]);

  useEffect(() => {
    if (!gscAccessToken || !selectedSite || !selectedForecastEntity || !hasTriggeredGscRun) {
      setForecastSeriesCurrent([]);
      setForecastSeriesPrevious([]);
      return;
    }

    const dimension = forecastEntityType === 'url' ? 'page' : 'query';
    const dimensionFilterGroups: GSCDimensionFilterGroup[] = [
      {
        groupType: 'and',
        filters: [{ dimension, operator: 'equals', expression: selectedForecastEntity }],
      },
    ];

    setIsLoadingForecastSeries(true);
    Promise.all([
      getGSCDimensionDateData(
        gscAccessToken,
        selectedSite,
        startDate,
        endDate,
        dimension,
        25000,
        'web',
        { dimensionFilterGroups, maxRows: 50000 },
      ),
      comparisonPeriod
        ? getGSCDimensionDateData(
          gscAccessToken,
          selectedSite,
          comparisonPeriod.previous.startDate,
          comparisonPeriod.previous.endDate,
          dimension,
          25000,
          'web',
          { dimensionFilterGroups, maxRows: 50000 },
        )
        : Promise.resolve({ rows: [] as GSCRow[] }),
    ])
      .then(([currentResponse, previousResponse]) => {
        const normalize = (rows: GSCRow[]): ForecastSeriesPoint[] =>
          rows
            .map((row) => ({
              date: row.keys?.[1] || '',
              clicks: Number(row.clicks || 0),
            }))
            .filter((row) => row.date)
            .sort((a, b) => a.date.localeCompare(b.date));
        setForecastSeriesCurrent(normalize(currentResponse.rows || []));
        setForecastSeriesPrevious(normalize(previousResponse.rows || []));
      })
      .catch((error) => {
        console.error('Forecast series error:', error);
        setForecastSeriesCurrent([]);
        setForecastSeriesPrevious([]);
      })
      .finally(() => setIsLoadingForecastSeries(false));
  }, [
    comparisonPeriod,
    endDate,
    forecastEntityType,
    gscAccessToken,
    hasTriggeredGscRun,
    selectedForecastEntity,
    selectedSite,
    startDate,
  ]);

  const trendingSourceRows = useMemo(() => trendingAnalysisRows || [], [trendingAnalysisRows]);
  const trendingUrls = useMemo(() => detectTrendingUrls(trendingSourceRows), [trendingSourceRows]);

  const trendingWindows = useMemo<UrlTrendWindowReport[]>(() => {
    const windowConfig: Array<{ key: UrlTrendWindowKey; label: string; statusLabel: string; days: number }> = [
      { key: '24h', label: 'Últimas 24 horas', statusLabel: 'pico puntual', days: 1 },
      { key: '7d', label: 'Últimos 7 días', statusLabel: 'tendencia semanal', days: 7 },
      { key: '30d', label: 'Últimos 30 días', statusLabel: 'tendencia mensual', days: 30 },
      { key: '3m', label: 'Últimos 3 meses', statusLabel: 'tendencia trimestral', days: 90 },
      { key: '6m', label: 'Últimos 6 meses', statusLabel: 'tendencia semestral', days: 180 },
      { key: '12m', label: 'Últimos 12 meses', statusLabel: 'patrón anual', days: 365 },
    ];

    const dates = Array.from(new Set(trendingSourceRows.map((row) => row.keys?.[1]).filter(Boolean)));
    const availableDays = dates.length;
    const newestDate = dates.sort((a, b) => a!.localeCompare(b!))[dates.length - 1];
    const latest = newestDate ? new Date(`${newestDate}T00:00:00Z`) : null;
    const fmt = (date: Date) => date.toISOString().slice(0, 10);
    const fmtRange = (start: Date, end: Date) => {
      const startStr = fmt(start);
      const endStr = fmt(end);
      return startStr === endStr ? startStr : `${startStr} → ${endStr}`;
    };

    return windowConfig.map((windowDef) => {
      const requiredDays = windowDef.days * 2;
      const available = availableDays >= requiredDays && Boolean(latest);
      const currentEnd = latest ? new Date(latest) : null;
      const currentStart = currentEnd ? new Date(currentEnd.getTime() - (windowDef.days - 1) * 24 * 60 * 60 * 1000) : null;
      const baselineEnd = currentStart ? new Date(currentStart.getTime() - 24 * 60 * 60 * 1000) : null;
      const baselineStart = baselineEnd
        ? new Date(baselineEnd.getTime() - (windowDef.days - 1) * 24 * 60 * 60 * 1000)
        : null;

      return {
        key: windowDef.key,
        label: windowDef.label,
        statusLabel: windowDef.statusLabel,
        currentRange: currentStart && currentEnd ? fmtRange(currentStart, currentEnd) : '—',
        baselineRange: baselineStart && baselineEnd ? fmtRange(baselineStart, baselineEnd) : '—',
        days: windowDef.days,
        available,
        availabilityMessage: available
          ? undefined
          : `Datos insuficientes para ${windowDef.label.toLowerCase()} (se requieren ~${requiredDays} días; disponibles: ${availableDays}).`,
        rows: trendingUrls.filter((trend) => trend.periodKey === windowDef.key),
      };
    });
  }, [trendingSourceRows, trendingUrls]);

  const trendingSummary = useMemo(() => {
    const countsByWindow = trendingWindows.reduce<Record<string, number>>((acc, window) => {
      acc[window.key] = window.rows.length;
      return acc;
    }, {});
    const topRelevant = [...trendingUrls].slice(0, 10);
    const sustainedMap = new Map<string, { count: number; totalIncrease: number }>();
    trendingUrls.forEach((trend) => {
      const current = sustainedMap.get(trend.url) || { count: 0, totalIncrease: 0 };
      current.count += 1;
      current.totalIncrease += trend.clickIncrease;
      sustainedMap.set(trend.url, current);
    });
    const sustained = Array.from(sustainedMap.entries())
      .filter(([, value]) => value.count >= 2)
      .sort((a, b) => b[1].count - a[1].count || b[1].totalIncrease - a[1].totalIncrease)
      .slice(0, 8);
    return { countsByWindow, topRelevant, sustained };
  }, [trendingUrls, trendingWindows]);

  const panelTrendingUrlCount = useMemo(
    () => new Set(trendingUrls.map((trend) => trend.url)).size,
    [trendingUrls],
  );

  const totalUrlsWithGscData = useMemo(
    () => new Set((queryPageData || []).map((row) => row.keys?.[1]).filter(Boolean)).size,
    [queryPageData],
  );

  const insightAffectedUrlCount = useMemo(() => {
    const urls = new Set<string>();
    actionableInsights.forEach((insight) => {
      insight.relatedRows?.forEach((row: any) => {
        const urlCandidate = typeof row?.url === 'string' ? row.url : row?.keys?.[1];
        if (typeof urlCandidate === 'string' && urlCandidate) {
          urls.add(urlCandidate);
        }
      });
    });
    return urls.size;
  }, [actionableInsights]);

  const hasTrendingReport = useMemo(
    () => trendingWindows.some((window) => window.rows.length > 0 || !window.available),
    [trendingWindows],
  );


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

  const forecastHorizonDays = forecastWeeks * 7;
  const forecastResult = useMemo(
    () => buildForecast(forecastSeriesCurrent, forecastHorizonDays, forecastUpliftPct),
    [forecastHorizonDays, forecastSeriesCurrent, forecastUpliftPct],
  );
  const previousSeriesTotalClicks = useMemo(
    () => forecastSeriesPrevious.reduce((sum, point) => sum + point.clicks, 0),
    [forecastSeriesPrevious],
  );

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
  const snapshotHistory = (currentClient?.seoSnapshots || []) as SeoPerformanceSnapshot[];

  const currentMetricBlock = useMemo(() => sumGscRows(gscData), [gscData]);
  const currentBrandMetricBlock = useMemo(() => {
    const brandClicks = brandDeltaSummary.current.brand;
    const nonBrandClicks = brandDeltaSummary.current.nonBrand;
    const totalClicks = brandClicks + nonBrandClicks || 1;
    const brandRatio = brandClicks / totalClicks;
    const nonBrandRatio = nonBrandClicks / totalClicks;
    return {
      brand: {
        clicks: brandClicks,
        impressions: Number((performanceSummary.current.impressions * brandRatio).toFixed(0)),
        ctr: performanceSummary.current.ctr,
        position: performanceSummary.current.position,
      },
      nonBrand: {
        clicks: nonBrandClicks,
        impressions: Number((performanceSummary.current.impressions * nonBrandRatio).toFixed(0)),
        ctr: performanceSummary.current.ctr,
        position: performanceSummary.current.position,
      },
    };
  }, [brandDeltaSummary.current.brand, brandDeltaSummary.current.nonBrand, performanceSummary.current.ctr, performanceSummary.current.impressions, performanceSummary.current.position]);

  const moduleScoresMap = useMemo(
    () =>
      moduleMaturityDetails.reduce<Record<number, number>>((acc, moduleDetail) => {
        acc[moduleDetail.moduleId] = moduleDetail.score;
        return acc;
      }, {}),
    [moduleMaturityDetails],
  );

  const openTasksCount = useMemo(
    () => modules.reduce((sum, module) => sum + module.tasks.filter((task) => task.status !== 'completed').length, 0),
    [modules],
  );
  const openInsightsCount = useMemo(
    () => actionableInsights.filter((insight) => OPEN_INSIGHT_STATUSES.includes(insight.status)).length,
    [actionableInsights],
  );

  const snapshotPeriod = useMemo(() => ({
    currentStart: startDate,
    currentEnd: endDate,
    previousStart: comparisonPeriod?.previous.startDate,
    previousEnd: comparisonPeriod?.previous.endDate,
    comparisonLabel: comparisonPeriod ? GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode] : undefined,
  }), [comparisonPeriod, endDate, startDate]);

  const createSnapshotsPayload = useCallback((captureType: 'auto' | 'manual') => {
    if (!currentClient) {
      return [] as Omit<SeoPerformanceSnapshot, 'id' | 'timestamp'>[];
    }

    const baseSnapshot = {
      property: selectedSite || 'Sin propiedad GSC',
      period: snapshotPeriod,
      metrics: currentMetricBlock,
      brandMetrics: currentBrandMetricBlock,
      globalScore: Math.round(effectiveGlobalScore),
      moduleScores: moduleScoresMap,
      openInsights: openInsightsCount,
      openTasks: openTasksCount,
      captureType,
      trace: {
        clientId: currentClient.id,
        projectType: currentClient.projectType || 'MEDIA',
        sector: currentClient.sector || 'Otro',
        geoScope: currentClient.geoScope || 'global',
        timestamp: Date.now(),
      },
    };

    const moduleSnapshots = moduleMaturityDetails.map((moduleDetail) => ({
      ...baseSnapshot,
      scope: 'module' as const,
      scopeId: `${currentClient.id}:module:${moduleDetail.moduleId}`,
      scopeLabel: `M${moduleDetail.moduleId} · ${moduleDetail.moduleTitle}`,
      moduleId: moduleDetail.moduleId,
      openInsights: moduleDetail.openInsights,
      openTasks: moduleDetail.openTasks,
      globalScore: moduleDetail.score,
      trace: {
        ...baseSnapshot.trace,
        module: moduleDetail.moduleTitle,
      },
    }));

    return [
      {
        ...baseSnapshot,
        scope: 'client' as const,
        scopeId: currentClient.id,
        scopeLabel: currentClient.name,
      },
      {
        ...baseSnapshot,
        scope: 'property' as const,
        scopeId: `${currentClient.id}:${selectedSite || 'no-property'}`,
        scopeLabel: selectedSite || 'Sin propiedad GSC',
      },
      {
        ...baseSnapshot,
        scope: 'portfolio' as const,
        scopeId: `${currentClient.id}:portfolio`,
        scopeLabel: `${currentClient.name} · Portfolio`,
      },
      ...moduleSnapshots,
    ];
  }, [currentBrandMetricBlock, currentClient, currentMetricBlock, effectiveGlobalScore, moduleMaturityDetails, moduleScoresMap, openInsightsCount, openTasksCount, selectedSite, snapshotPeriod]);

  const handleCaptureSnapshot = useCallback((captureType: 'auto' | 'manual' = 'manual') => {
    const snapshots = createSnapshotsPayload(captureType);
    snapshots.forEach((snapshot) => saveClientSnapshot(snapshot));
    if (captureType === 'manual') {
      showSuccess(`Snapshot manual guardado (${snapshots.length} ámbitos).`);
    }
  }, [createSnapshotsPayload, saveClientSnapshot, showSuccess]);

  const filteredSnapshotHistory = useMemo(() => {
    const base = historyScopeFilter === 'all'
      ? snapshotHistory
      : snapshotHistory.filter((snapshot) => snapshot.scope === historyScopeFilter);
    return base.slice(0, 80);
  }, [historyScopeFilter, snapshotHistory]);

  const latestClientSnapshot = useMemo(
    () => snapshotHistory.find((snapshot) => snapshot.scope === 'client'),
    [snapshotHistory],
  );
  const comparisonWindows = useMemo(() => {
    const dayMs = 86400000;
    const now = Date.now();
    const evaluateWindow = (days: number) => {
      const cutoff = now - days * dayMs;
      const candidate = snapshotHistory.find(
        (snapshot) => snapshot.scope === 'client' && snapshot.timestamp <= cutoff,
      );
      if (!candidate) {
        return { days, available: false as const };
      }

      return {
        days,
        available: true as const,
        deltaClicks: currentMetricBlock.clicks - candidate.metrics.clicks,
        deltaImpressions: currentMetricBlock.impressions - candidate.metrics.impressions,
        deltaCtr: Number((currentMetricBlock.ctr - candidate.metrics.ctr).toFixed(2)),
        deltaPosition: Number((currentMetricBlock.position - candidate.metrics.position).toFixed(2)),
      };
    };

    return [evaluateWindow(7), evaluateWindow(28), evaluateWindow(90)];
  }, [currentMetricBlock.clicks, currentMetricBlock.ctr, currentMetricBlock.impressions, currentMetricBlock.position, snapshotHistory]);

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
    if (exportableActionableInsights.length === 0) {
      showSuccess('No hay puntos para exportar en este momento.');
      return;
    }

    const exportDate = new Date().toISOString().slice(0, 10);
    const rawUrlRows = sanitizeRowsForSheets(
      queryPageData.map((row) => ({
        query: row.keys?.[0] || '',
        url: row.keys?.[1] || '',
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctrPct: Number(((row.ctr || 0) * 100).toFixed(2)),
        position: Number((row.position || 0).toFixed(2)),
      })),
    );
    const allSummaryRows = sanitizeRowsForSheets(
      actionableInsights.map((insight) => ({
        insightId: insight.id,
        titulo: insight.title,
        categoria: insight.category,
        prioridad: insight.priority,
        severidad: insight.severity,
        score: insight.score,
        estado: insight.status,
        propiedad: insight.propertyId,
        relatedRows: insight.relatedRows.length,
        affectedCount: insight.affectedCount,
      })),
    );
    const baselineByQueryUrl = buildInsightBaselineMap(comparisonQueryPageData || []);
    const allDetailRows = sanitizeRowsForSheets(
      exportableActionableInsights.flatMap((insight) => buildInsightExportRows(insight, baselineByQueryUrl)),
    );
    const summaryColumnCount = Math.max(1, Object.keys(allSummaryRows[0] || {}).length);
    const detailColumnCount = Math.max(1, Object.keys(allDetailRows[0] || {}).length);
    const summaryCellCount = (allSummaryRows.length + 1) * summaryColumnCount;
    const remainingCellsForDetail = Math.max(1, GOOGLE_SHEETS_SAFE_CELLS - summaryCellCount);
    const maxDetailRowsPerFile = Math.max(1, Math.floor(remainingCellsForDetail / detailColumnCount));
    const preparedInsights = exportableActionableInsights.map((insight, index) => ({
      summaryRow: allSummaryRows[index],
      detailRows: sanitizeRowsForSheets(buildInsightExportRows(insight, baselineByQueryUrl)),
      analysisType: insight.category || 'General',
    }));
    const filePlans: Array<{
      start: number;
      end: number;
      summaryRows: Array<Record<string, string | number>>;
      detailGroups: Record<string, Array<Record<string, string | number>>>;
    }> = [];
    let cursor = 0;

    while (cursor < preparedInsights.length) {
      const start = cursor;
      const summaryRows: Array<Record<string, string | number>> = [];
      const detailGroups: Record<string, Array<Record<string, string | number>>> = {};
      let detailRowsCount = 0;

      while (cursor < preparedInsights.length) {
        const candidate = preparedInsights[cursor];
        const candidateRowsCount = Math.max(1, candidate.detailRows.length);
        if (detailRowsCount > 0 && detailRowsCount + candidateRowsCount > maxDetailRowsPerFile) {
          break;
        }

        summaryRows.push(candidate.summaryRow);
        if (!detailGroups[candidate.analysisType]) {
          detailGroups[candidate.analysisType] = [];
        }
        detailGroups[candidate.analysisType].push(...candidate.detailRows);
        detailRowsCount += candidateRowsCount;
        cursor += 1;
      }

      filePlans.push({ start, end: cursor, summaryRows, detailGroups });
    }

    const totalFiles = filePlans.length;

    filePlans.forEach((plan, part) => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(plan.summaryRows), 'Resumen');

      const usedNames = new Set<string>(['Resumen']);
      if (part === 0 && rawUrlRows.length > 0) {
        const rawSheetName = buildUniqueSheetName('URLs_GSC_Bruto', `URLs_GSC_${part + 1}`, usedNames);
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rawUrlRows), rawSheetName);
      }
      Object.entries(plan.detailGroups).forEach(([analysisType, rows], groupIndex) => {
        if (rows.length === 0) return;
        const sheetName = buildUniqueSheetName(
          `Detalle_${analysisType}`,
          `Detalle_${part + 1}_${groupIndex + 1}`,
          usedNames,
        );
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
      });

      const fileSuffix = totalFiles > 1 ? `_parte_${part + 1}` : '';
      XLSX.writeFile(workbook, `SEO_Insights_Detallados_${exportDate}${fileSuffix}.xlsx`);
    });

    if (cursor < preparedInsights.length) {
      const remainingInsights = preparedInsights.length - cursor;
      showSuccess(
        `Se exportaron ${totalFiles} archivos optimizados por límite de celdas. Aún quedan ${remainingInsights} insight(s) sin exportar; aplica más filtros para reducir volumen.`,
      );
      return;
    }

    if (totalFiles === 1) {
      showSuccess(`Excel exportado con pestañas de detalle por tipo de análisis + 1 resumen, respetando el límite de Google Sheets (${GOOGLE_SHEETS_MAX_CELLS.toLocaleString()} celdas y ${GOOGLE_SHEETS_MAX_CELL_CHARACTERS.toLocaleString()} caracteres por celda).`);
      return;
    }

    showSuccess(`Se exportaron ${totalFiles} archivos optimizados para Google Sheets con el menor número de pestañas posible.`);
  };

  const runTrendingAnalysis = () => {
    if (!gscAccessToken || !selectedSite) {
      showError('Conecta Search Console y selecciona una propiedad antes de ejecutar el análisis.');
      return;
    }

    const includeTerms = parseUrlConditionLines(trendingIncludeRaw);
    const excludeTerms = parseUrlConditionLines(trendingExcludeRaw);
    const dimensionFilterGroups = buildUrlConditionFilterGroups(includeTerms, excludeTerms);
    const normalizedMaxRows = Math.min(
      TRENDING_ANALYSIS_MAX_ROWS_HARD_LIMIT,
      Math.max(TRENDING_ANALYSIS_MAX_ROWS_MIN, Number.isFinite(trendingMaxRows) ? Math.floor(trendingMaxRows) : TRENDING_ANALYSIS_MAX_ROWS_DEFAULT),
    );
    const analysisStartDate = trendingUseCustomPeriod ? trendingStartDate : startDate;
    const analysisEndDate = trendingUseCustomPeriod ? trendingEndDate : endDate;

    if (!analysisStartDate || !analysisEndDate || analysisStartDate > analysisEndDate) {
      showError('Define un rango válido para el análisis de URLs en tendencia.');
      return;
    }

    showInfo('Ejecutando análisis GSC con filtros de URL. Puede tardar en propiedades grandes.');
    setIsRunningTrendingAnalysis(true);
    getGSCPageDateData(gscAccessToken, selectedSite, analysisStartDate, analysisEndDate, 25000, 'web', {
      dimensionFilterGroups,
      maxRows: normalizedMaxRows,
    })
      .then((response) => {
        setTrendingAnalysisRows(response.rows || []);
        setTrendingAnalysisScope({
          includeTerms,
          excludeTerms,
          rowsLoaded: response.rows?.length || 0,
          periodStart: analysisStartDate,
          periodEnd: analysisEndDate,
          maxRowsRequested: normalizedMaxRows,
        });
        showSuccess(`Análisis completado con ${response.rows?.length || 0} filas cargadas.`);
      })
      .catch((error) => {
        console.error('Trending analysis error:', error);
        showError('No se pudo ejecutar el análisis filtrado. Reintenta en unos minutos.');
      })
      .finally(() => {
        setIsRunningTrendingAnalysis(false);
      });
  };

  const runMainGscSearch = () => {
    if (!gscAccessToken || !selectedSite) {
      showError('Conecta Search Console y selecciona una propiedad antes de iniciar la búsqueda.');
      return;
    }

    const includeTerms = parseUrlConditionLines(gscIncludeRaw);
    const excludeTerms = parseUrlConditionLines(gscExcludeRaw);

    setGscRunIncludeTerms(includeTerms);
    setGscRunExcludeTerms(excludeTerms);
    setHasTriggeredGscRun(true);
    setGscRunKey((prev) => prev + 1);
    showInfo('Iniciando análisis de Search Console con filtros y tipologías seleccionadas.');
  };

  const handleExportTrendingUrls = () => {
    if (!trendingAnalysisRows || trendingAnalysisRows.length === 0) {
      showError('Primero ejecuta el análisis con las condiciones de URL para poder exportar.');
      return;
    }

    setIsExportingTrendingUrls(true);
    try {
      const fullTrendingSignals = detectTrendingUrls(trendingAnalysisRows);
      const rows = fullTrendingSignals.map((trend) => ({
        ventana: trend.periodLabel,
        rangoPico: trend.peakRange,
        url: trend.url,
        clicksActuales: Math.round(trend.currentClicks),
        clicksBaseline: Math.round(Math.max(0, trend.baselineClicks)),
        incrementoClicksAbs: Math.round(trend.clickIncrease),
        incrementoClicksPct: Number(trend.clickChangePct.toFixed(1)),
        multiplicador: Number(trend.surgeRatio.toFixed(2)),
        impresiones: Math.round(trend.impressions),
        ctrPct: Number(trend.ctr.toFixed(2)),
        posicion: Number(trend.position.toFixed(2)),
        estado: trend.statusLabel,
      }));

      if (rows.length === 0) {
        showSuccess('No hay URLs con pico para exportar con las condiciones aplicadas.');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'URLs en tendencia');
      XLSX.writeFile(workbook, `URLs_Tendencia_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showSuccess(`Exportación completada con ${rows.length} filas filtradas.`);
    } finally {
      setIsExportingTrendingUrls(false);
    }
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
            const scopeId = insight.propertyId || insight.id;
            const scopeType = insight.propertyId ? 'property' : 'insight';
            openContextualNotes({
              scopeType,
              scopeId,
              title: insight.title,
              tags: ['dashboard', insight.category, insight.priority],
              suggestedContent: `Insight: ${insight.title}\nAcción sugerida: ${insight.suggestedAction || 'Pendiente'}`,
            });
          }}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted"
        >
          Añadir nota
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setInsightStatus(insight, 'ignored');
          }}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:border-danger/40"
        >
          Ignorar
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setInsightStatus(insight, 'postponed');
          }}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted"
        >
          Posponer
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setInsightStatus(insight, 'planned');
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
            setInsightStatus(insight, 'done');
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
      <div className="mb-3 flex justify-end">
        <ContextNoteButton
          scopeType="module"
          scopeId={`dashboard:${currentClient?.id || 'global'}`}
          title="Panel de control"
          tags={['dashboard', activeProjectType, activeSector]}
          suggestedContent={`Revisión dashboard ${startDate}..${endDate} · propiedad ${selectedSite || 'sin-propiedad'}`}
        />
      </div>
      {selectedInsight && (
        <div className="overlay-backdrop animate-fade-in">
          <ErrorBoundary>
            <InsightDetailModal
              insight={selectedInsight}
              comparisonRows={comparisonQueryPageData}
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

      <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">Histórico de snapshots SEO</h3>
            <p className="text-sm text-muted">
              Base para reporting before/after por cliente, propiedad y módulo.
            </p>
          </div>
          <Button onClick={() => handleCaptureSnapshot('manual')} variant="secondary">
            Guardar snapshot manual
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <Card className="p-3">
            <div className="text-xs text-muted">Snapshots guardados</div>
            <div className="text-xl font-bold">{snapshotHistory.length}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted">Último snapshot vs actual</div>
            <div className="text-sm font-semibold">
              {latestClientSnapshot
                ? `${currentMetricBlock.clicks - latestClientSnapshot.metrics.clicks >= 0 ? '+' : ''}${(currentMetricBlock.clicks - latestClientSnapshot.metrics.clicks).toLocaleString()} clics`
                : 'Sin histórico'}
            </div>
          </Card>
          {comparisonWindows.map((window) => (
            <Card key={window.days} className="p-3">
              <div className="text-xs text-muted">Comparativa {window.days}d</div>
              <div className="text-sm font-semibold">
                {window.available ? `${window.deltaClicks >= 0 ? '+' : ''}${window.deltaClicks.toLocaleString()} clics` : 'Sin baseline'}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'client', label: 'Cliente' },
            { key: 'property', label: 'Propiedad' },
            { key: 'module', label: 'Módulo' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              className={`rounded-brand-md border px-3 py-1 text-xs font-semibold ${
                historyScopeFilter === option.key ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted'
              }`}
              onClick={() => setHistoryScopeFilter(option.key as 'all' | 'client' | 'property' | 'module')}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filteredSnapshotHistory.length === 0 ? (
          <Card className="p-4 text-sm text-muted">
            Aún no hay snapshots para este alcance. Conecta propiedad GSC y guarda el primer snapshot.
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted border-b border-border">
                  <th className="py-2 pr-3">Ámbito</th>
                  <th className="py-2 pr-3">Periodo</th>
                  <th className="py-2 pr-3">Clics</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Insights/Tareas</th>
                  <th className="py-2 pr-3">Trazabilidad</th>
                </tr>
              </thead>
              <tbody>
                {filteredSnapshotHistory.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{snapshot.scopeLabel}</div>
                      <div className="text-xs text-muted">{snapshot.scope}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {snapshot.period.currentStart} → {snapshot.period.currentEnd}
                    </td>
                    <td className="py-2 pr-3">
                      {snapshot.metrics.clicks.toLocaleString()}
                      <div className="text-xs text-muted">
                        Imp {snapshot.metrics.impressions.toLocaleString()} · CTR {snapshot.metrics.ctr.toFixed(2)}%
                      </div>
                    </td>
                    <td className="py-2 pr-3">{snapshot.globalScore}%</td>
                    <td className="py-2 pr-3 text-xs">
                      {snapshot.openInsights} / {snapshot.openTasks}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted">
                      {snapshot.property} · {snapshot.trace.projectType} · {new Date(snapshot.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <div className="mt-1 text-[11px] text-muted">
                    Impacto esperado: {Math.round(insight.impact)} · Acción: {insight.action}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    Módulo afectado: {insight.moduleId ? `M${insight.moduleId}` : 'Sin módulo'}
                  </div>
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
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">
                Base analizada: {(queryPageData.length + comparisonQueryPageData.length).toLocaleString()} filas
              </Badge>
              <Badge variant="outline">
                Base objetivo máx.: {gscAnalysisMaxRows.toLocaleString()} filas
              </Badge>
              <Badge variant="outline">
                Tabla por insight: máx. {insightTableLimit.toLocaleString()} filas
              </Badge>
            </div>
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

              <div className="mb-4 rounded-xl border border-border bg-surface-alt/40 p-3 text-xs space-y-3">
                <div className="font-semibold text-foreground">
                  La búsqueda no se ejecuta automáticamente. Define filtros y pulsa “Iniciar búsqueda”.
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary-soft/40 p-3 text-[11px] text-muted">
                  <p className="font-semibold text-foreground">Control de gran migración con datos GSC</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    <li>
                      Define el periodo <strong>pre-migración</strong> y compara con periodo pasado/año pasado
                      para tener una línea base de clics, impresiones, CTR y posición.
                    </li>
                    <li>
                      Usa filtros de <strong>Incluir/Excluir URL</strong> para monitorizar solo carpetas
                      migradas, plantillas críticas o grupos de landing pages.
                    </li>
                    <li>
                      Activa <strong>Hitos roadmap</strong> para cruzar despliegues con variaciones del
                      gráfico y validar impacto real tras cada release.
                    </li>
                    <li>
                      Repite la corrida por oleadas (por tipología) y sigue los insights para detectar
                      caídas, canibalizaciones o pérdidas de cobertura rápidamente.
                    </li>
                  </ol>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Incluir URL contiene</span>
                    <textarea
                      value={gscIncludeRaw}
                      onChange={(e) => setGscIncludeRaw(e.target.value)}
                      placeholder="/servicios/\n/blog/"
                      className="mt-1 h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Excluir URL contiene</span>
                    <textarea
                      value={gscExcludeRaw}
                      onChange={(e) => setGscExcludeRaw(e.target.value)}
                      placeholder="/tag/\n?utm_"
                      className="mt-1 h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Base analizada máx. (filas)</span>
                    <input
                      type="number"
                      min={DASHBOARD_GSC_ANALYSIS_MAX_ROWS_MIN}
                      max={DASHBOARD_GSC_ANALYSIS_MAX_ROWS_HARD_LIMIT}
                      step={1}
                      value={gscAnalysisMaxRowsInput}
                      onChange={(e) => setGscAnalysisMaxRowsInput(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="mt-1 block text-[10px] text-muted">
                      Rango: 25.000 a {DASHBOARD_GSC_ANALYSIS_MAX_ROWS_HARD_LIMIT.toLocaleString('es-ES')} filas.
                    </span>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Tabla por insight máx. (filas)</span>
                    <input
                      type="number"
                      min={DASHBOARD_INSIGHT_TABLE_LIMIT_MIN}
                      max={DASHBOARD_INSIGHT_TABLE_LIMIT_HARD_LIMIT}
                      step={1}
                      value={insightTableLimitInput}
                      onChange={(e) => setInsightTableLimitInput(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="mt-1 block text-[10px] text-muted">
                      Rango: 50 a {DASHBOARD_INSIGHT_TABLE_LIMIT_HARD_LIMIT.toLocaleString('es-ES')} filas.
                    </span>
                  </label>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Tipologías para esta corrida</div>
                  <div className="flex flex-wrap gap-2">
                    {(['MEDIA', 'ECOM', 'LOCAL', 'NATIONAL', 'INTERNATIONAL'] as ProjectType[]).map((type) => (
                      <label key={`gsc-run-type-${type}`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={gscRunAnalysisProjectTypes.includes(type)}
                          onChange={() =>
                            setGscRunAnalysisProjectTypes((prev) => {
                              if (prev.includes(type)) {
                                return prev.filter((value) => value !== type);
                              }
                              return [...prev, type];
                            })
                          }
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={runMainGscSearch} disabled={isLoadingGsc || !selectedSite}>
                    <Search size={14} /> {isLoadingGsc ? 'Ejecutando…' : 'Iniciar búsqueda'}
                  </Button>
                  <span className="text-[11px] text-muted">
                    {hasTriggeredGscRun
                      ? `Última corrida: incluir ${gscRunIncludeTerms.length} patrón(es), excluir ${gscRunExcludeTerms.length} patrón(es), ${gscRunAnalysisProjectTypes.length} tipología(s), base máx. ${gscAnalysisMaxRows.toLocaleString('es-ES')} filas, tabla insight máx. ${insightTableLimit.toLocaleString('es-ES')} filas.`
                      : 'Aún no hay corrida. Los insights se generan solo al iniciar manualmente.'}
                  </span>
                </div>
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
                {!hasTriggeredGscRun ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted bg-surface-alt/50 rounded-xl border border-dashed border-border">
                    <Search size={30} className="mb-2 opacity-50" />
                    <p className="text-sm">Pulsa “Iniciar búsqueda” para cargar Search Console.</p>
                    <p className="text-xs opacity-70">Puedes definir patrones de URL y tipologías antes de ejecutar.</p>
                  </div>
                ) : isLoadingGsc ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
                    <Spinner size={32} />
                    <Skeleton width="60%" height="20px" />
                    <div className="w-full max-w-sm space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>
                          {syncProgress.currentStepLabel || 'Sincronizando datos de Google...'}
                        </span>
                        <span>{gscSyncPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${gscSyncPercent}%` }}
                        />
                      </div>
                      <span className="block text-center text-[11px] text-muted">
                        Tiempo transcurrido: {gscSyncElapsedSeconds}s · En propiedades grandes puede tardar varios minutos.
                      </span>
                    </div>
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
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        onClick={() => setSelectedModuleDetailId(entry.moduleId)}
                        className="cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs text-muted">
              Haz clic en una barra para abrir la ficha del módulo y conectar estructura, ejecución e impacto.
            </div>
            {selectedModuleDetail ? (
              <div className="mt-6 rounded-xl border border-border bg-surface-alt/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-primary">M{selectedModuleDetail.moduleId}</div>
                    <h4 className="text-lg font-bold">{selectedModuleDetail.moduleTitle}</h4>
                    <p className="mt-1 text-sm text-muted">{selectedModuleDetail.moduleDescription}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        selectedModuleDetail.tag === 'crítico'
                          ? 'danger'
                          : selectedModuleDetail.tag === 'en progreso'
                            ? 'warning'
                            : selectedModuleDetail.tag === 'validando impacto'
                              ? 'primary'
                              : 'success'
                      }
                    >
                      {selectedModuleDetail.tag}
                    </Badge>
                    <Badge variant="neutral">Score {selectedModuleDetail.score}%</Badge>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="text-[11px] text-muted">Tareas abiertas</div>
                    <div className="text-lg font-bold">{selectedModuleDetail.openTasks}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="text-[11px] text-muted">Tareas completadas</div>
                    <div className="text-lg font-bold">{selectedModuleDetail.completedTasks}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="text-[11px] text-muted">Insights abiertos</div>
                    <div className="text-lg font-bold">{selectedModuleDetail.openInsights}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="text-[11px] text-muted">Quick wins</div>
                    <div className="text-lg font-bold">{selectedModuleDetail.quickWins}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="text-[11px] text-muted">Impacto GSC</div>
                    <div className="text-lg font-bold">
                      {selectedModuleDetail.gscImpact === null ? 'N/D' : `${selectedModuleDetail.gscImpact.toFixed(1)}%`}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="text-[11px] text-muted">Rendimiento afectado</div>
                    <div className="text-sm font-semibold text-foreground">
                      {selectedModuleDetail.gscImpact === null
                        ? 'Sin señal GSC'
                        : selectedModuleDetail.gscImpact >= 50
                          ? 'Impacto alto'
                          : selectedModuleDetail.gscImpact >= 20
                            ? 'Impacto medio'
                            : 'Impacto bajo'}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">Tareas clave</div>
                    <div className="mt-2 space-y-2">
                      {selectedModuleDetail.keyTasks.length > 0 ? selectedModuleDetail.keyTasks.map((task) => (
                        <div key={task.id} className="rounded-lg border border-border bg-surface p-2">
                          <div className="text-sm font-semibold">{task.title}</div>
                          <div className="text-[11px] text-muted">{task.impact} · estado {task.status}</div>
                        </div>
                      )) : (
                        <div className="rounded-lg border border-dashed border-border p-2 text-xs text-muted">
                          No hay tareas abiertas en este módulo.
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">Insights clave y evolución</div>
                    <div className="mt-2 space-y-2">
                      {selectedModuleDetail.insights.slice(0, 3).map((insight) => (
                        <button
                          type="button"
                          key={insight.id}
                          onClick={() => setSelectedInsight(insight)}
                          className="w-full rounded-lg border border-border bg-surface p-2 text-left hover:border-primary/40"
                        >
                          <div className="text-sm font-semibold line-clamp-1">{insight.title}</div>
                          <div className="mt-1 text-[11px] text-muted">
                            {insight.periodPrevious?.startDate && insight.periodPrevious?.endDate
                              ? `${insight.periodPrevious.startDate}→${insight.periodPrevious.endDate}`
                              : 'Sin periodo previo'}
                            {' · '}
                            {insight.periodCurrent?.startDate && insight.periodCurrent?.endDate
                              ? `${insight.periodCurrent.startDate}→${insight.periodCurrent.endDate}`
                              : 'Sin periodo actual'}
                          </div>
                        </button>
                      ))}
                      {selectedModuleDetail.insights.length === 0 && (
                        <div className="rounded-lg border border-dashed border-border p-2 text-xs text-muted">
                          Sin insights asociados para este módulo en el periodo actual.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                  <div>
                    Trazabilidad: {visibleSelectedGscSite || selectedSite || 'Sin propiedad'} · actual {startDate}..{endDate} · anterior{' '}
                    {comparisonPeriod
                      ? `${comparisonPeriod.previous.startDate}..${comparisonPeriod.previous.endDate}`
                      : 'Sin comparativa'} · módulo M{selectedModuleDetail.moduleId} · ts {new Date().toLocaleString()}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/app/module/${selectedModuleDetail.moduleId}`)}>
                    Abrir módulo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
                Sin módulos disponibles para construir la ficha integrada.
              </div>
            )}
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

          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
            <h3 className="font-bold mb-4">Forecast de clicks por URL/Query</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs">
                <span className="font-semibold text-muted">Entidad</span>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={forecastEntityType}
                  onChange={(event) => setForecastEntityType(event.target.value as ForecastEntityType)}
                >
                  <option value="url">URL</option>
                  <option value="query">Query</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="font-semibold text-muted">{forecastEntityType === 'url' ? 'URL objetivo' : 'Query objetivo'}</span>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={selectedForecastEntity}
                  onChange={(event) => setSelectedForecastEntity(event.target.value)}
                  disabled={forecastEntityOptions.length === 0}
                >
                  {forecastEntityOptions.length === 0 ? (
                    <option value="">Sin opciones</option>
                  ) : (
                    forecastEntityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="text-xs">
                <span className="font-semibold text-muted">Horizonte</span>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={forecastWeeks}
                  onChange={(event) => setForecastWeeks(Number(event.target.value) as 4 | 6 | 8)}
                >
                  <option value={4}>4 semanas</option>
                  <option value={6}>6 semanas</option>
                  <option value={8}>8 semanas</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="font-semibold text-muted">Impacto mejora escenario optimizado (%)</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={forecastUpliftPct}
                  onChange={(event) => setForecastUpliftPct(Math.max(0, Math.min(100, Number(event.target.value || 0))))}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface-alt p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted">Forecast base ({forecastWeeks} semanas)</div>
                <div className="mt-1 text-lg font-bold text-foreground">{Math.round(forecastResult.totalBase).toLocaleString('es-ES')} clics</div>
              </div>
              <div className="rounded-xl border border-border bg-surface-alt p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted">Forecast optimizado</div>
                <div className="mt-1 text-lg font-bold text-foreground">{Math.round(forecastResult.totalOptimized).toLocaleString('es-ES')} clics</div>
              </div>
              <div className="rounded-xl border border-border bg-surface-alt p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted">Comparativa periodo anterior</div>
                <div className="mt-1 text-lg font-bold text-foreground">{Math.round(previousSeriesTotalClicks).toLocaleString('es-ES')} clics</div>
              </div>
            </div>

            <div className="mt-2 text-xs text-muted">
              Tendencia esperada en escenario base: {forecastResult.growthPct >= 0 ? '+' : ''}
              {forecastResult.growthPct.toFixed(1)}% vs los últimos 14 días observados del objetivo seleccionado.
            </div>

            <div className="mt-4 h-64 w-full">
              {isLoadingForecastSeries ? (
                <div className="h-full flex items-center justify-center text-muted">
                  <Spinner size={24} />
                </div>
              ) : forecastResult.points.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastResult.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} width={56} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="actualClicks" stroke="#2563eb" strokeWidth={2.5} fillOpacity={0.08} fill="#2563eb" name="Real (actual)" />
                    <Area type="monotone" dataKey="forecastBase" stroke="#0f766e" strokeWidth={2} strokeDasharray="5 5" fillOpacity={0} name="Forecast base" />
                    <Area type="monotone" dataKey="forecastOptimized" stroke="#a16207" strokeWidth={2} strokeDasharray="3 4" fillOpacity={0} name="Forecast optimizado" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
                  Selecciona una URL/query con datos para generar la proyección.
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="text-primary" size={20} /> URLs en tendencia
              <span className="text-[10px] bg-primary-soft text-primary px-1.5 py-0.5 rounded font-bold uppercase">Panel dedicado</span>
            </h3>
            <div className="rounded-xl border border-border bg-surface-alt/30 p-3 text-xs space-y-3">
              <div>
                <div className="font-semibold text-foreground">Configura condiciones antes del análisis</div>
                <div className="mt-1 text-muted">
                  Define patrones de URL para incluir/excluir y ejecutar el análisis por lotes o tipologías.
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface px-3 py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={trendingUseCustomPeriod ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={() => setTrendingUseCustomPeriod(false)}
                  >
                    Usar periodo global
                  </Button>
                  <Button
                    variant={trendingUseCustomPeriod ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setTrendingUseCustomPeriod(true)}
                  >
                    Periodo personalizado
                  </Button>
                </div>
                {trendingUseCustomPeriod ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Desde</span>
                        <Input type="date" value={trendingStartDate} max={trendingEndDate || undefined} onChange={(e) => setTrendingStartDate(e.target.value)} />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Hasta</span>
                        <Input type="date" value={trendingEndDate} min={trendingStartDate || undefined} onChange={(e) => setTrendingEndDate(e.target.value)} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: '12 meses', days: 365 },
                        { label: '6 meses', days: 180 },
                        { label: '3 meses', days: 90 },
                        { label: '30 días', days: 30 },
                      ].map((preset) => (
                        <Button
                          key={preset.label}
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const end = new Date();
                            end.setDate(end.getDate() - GSC_DATA_DELAY_DAYS);
                            const start = new Date(end);
                            start.setDate(end.getDate() - preset.days);
                            setTrendingStartDate(start.toISOString().split('T')[0]);
                            setTrendingEndDate(end.toISOString().split('T')[0]);
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted">
                    Se usará el rango global del dashboard: {startDate} → {endDate}.
                  </div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Incluir URL contiene (1 por línea)</span>
                  <textarea
                    value={trendingIncludeRaw}
                    onChange={(e) => setTrendingIncludeRaw(e.target.value)}
                    placeholder="/categoria/\n/producto/\n/blog/"
                    className="mt-1 h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Excluir URL contiene (1 por línea)</span>
                  <textarea
                    value={trendingExcludeRaw}
                    onChange={(e) => setTrendingExcludeRaw(e.target.value)}
                    placeholder="/tag/\n?utm_\n/filtro/"
                    className="mt-1 h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block w-full max-w-[220px]">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Máx. filas por corrida</span>
                  <Input
                    type="number"
                    min={TRENDING_ANALYSIS_MAX_ROWS_MIN}
                    max={TRENDING_ANALYSIS_MAX_ROWS_HARD_LIMIT}
                    value={trendingMaxRows}
                    onChange={(e) => setTrendingMaxRows(Number(e.target.value || TRENDING_ANALYSIS_MAX_ROWS_DEFAULT))}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {[100000, 500000, 1000000, 2000000, 4000000].map((rows) => (
                    <Button key={rows} variant="ghost" size="sm" onClick={() => setTrendingMaxRows(rows)}>
                      {rows >= 1000000 ? `${rows / 1000000}M` : `${Math.round(rows / 1000)}k`} filas
                    </Button>
                  ))}
                </div>
                <Button variant="secondary" onClick={runTrendingAnalysis} disabled={isRunningTrendingAnalysis}>
                  <TrendingUp size={16} /> {isRunningTrendingAnalysis ? 'Analizando…' : 'Ejecutar análisis con filtros'}
                </Button>
                <Button variant="ghost" onClick={handleExportTrendingUrls} disabled={isExportingTrendingUrls || !trendingAnalysisScope}>
                  <Download size={16} /> {isExportingTrendingUrls ? 'Exportando…' : 'Exportar URLs en tendencia'}
                </Button>
              </div>
              {trendingAnalysisScope ? (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted">
                  Última corrida: {trendingAnalysisScope.rowsLoaded.toLocaleString('es-ES')} filas cargadas de un máximo solicitado de {trendingAnalysisScope.maxRowsRequested.toLocaleString('es-ES')} · periodo {trendingAnalysisScope.periodStart} → {trendingAnalysisScope.periodEnd} · incluir {trendingAnalysisScope.includeTerms.length} patrón(es) · excluir {trendingAnalysisScope.excludeTerms.length} patrón(es).
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted">
                  Aún no se ejecutó el análisis filtrado. El resumen no se calcula automáticamente.
                </div>
              )}
            </div>
          </div>

          {trendingAnalysisScope ? hasTrendingReport ? (
            <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
              <div className="rounded-xl border border-border bg-surface-alt/30 p-3 text-xs">
                <div className="font-semibold text-foreground">Resumen de detección</div>
                <div className="mt-1 text-muted">
                  URLs con pico por periodo: día {trendingSummary.countsByWindow['24h'] || 0} · semana {trendingSummary.countsByWindow['7d'] || 0} · mes {trendingSummary.countsByWindow['30d'] || 0} · 3m {trendingSummary.countsByWindow['3m'] || 0} · 6m {trendingSummary.countsByWindow['6m'] || 0} · 12m {trendingSummary.countsByWindow['12m'] || 0}
                </div>
                <div className="mt-1 text-muted">
                  Magnitud: {insightAffectedUrlCount.toLocaleString('es-ES')} URLs afectadas en oportunidades/riesgos · {panelTrendingUrlCount.toLocaleString('es-ES')} URLs en tendencia en panel · {totalUrlsWithGscData.toLocaleString('es-ES')} URLs totales con datos GSC.
                </div>
                {trendingSummary.sustained.length > 0 ? (
                  <div className="mt-2 text-muted">
                    Tendencias sostenidas detectadas: {trendingSummary.sustained.map(([url, value]) => `${url} (${value.count} ventanas)`).join(' · ')}
                  </div>
                ) : (
                  <div className="mt-2 text-muted">
                    Sin tendencias sostenidas en múltiples ventanas con los datos actuales.
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setShowTrendingPanel(true)}>
                  <TrendingUp size={16} /> Abrir panel URLs en tendencia
                </Button>
              </div>
              {trendingSummary.topRelevant.length > 0 && (
                <div className="mt-3 rounded-xl border border-border bg-surface-alt/20 p-3">
                  <div className="text-xs font-semibold text-foreground">Top 5 URLs más relevantes</div>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {trendingSummary.topRelevant.slice(0, 5).map((trend, index) => (
                      <li key={`${trend.url}-${trend.periodKey}-${index}`}>
                        {index + 1}. {trend.url} · {trend.periodLabel} · +{Math.round(trend.clickIncrease).toLocaleString()} clics
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 text-[11px] text-muted">
                El detalle completo por ventanas se mueve a un panel dedicado para evitar que esta sección estire el layout.
              </div>
            </div>
          ) : (
            <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border opacity-60">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="text-muted" size={20} /> URLs en tendencia
              </h3>
              <div className="text-sm text-muted text-center py-4">
                No se detectaron picos considerables con las condiciones actuales.
              </div>
            </div>
          ) : null}

          <Modal
            isOpen={showTrendingPanel}
            onClose={() => setShowTrendingPanel(false)}
            title="Panel de URLs en tendencia"
            className="max-w-6xl"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-alt/30 p-3 text-xs">
                <div className="text-muted">
                  URLs con pico por periodo: día {trendingSummary.countsByWindow['24h'] || 0} · semana {trendingSummary.countsByWindow['7d'] || 0} · mes {trendingSummary.countsByWindow['30d'] || 0} · 3m {trendingSummary.countsByWindow['3m'] || 0} · 6m {trendingSummary.countsByWindow['6m'] || 0} · 12m {trendingSummary.countsByWindow['12m'] || 0}
                </div>
                <Button
                  variant="secondary"
                  onClick={handleExportTrendingUrls}
                  disabled={isExportingTrendingUrls || !trendingAnalysisScope}
                >
                  <Download size={16} /> {isExportingTrendingUrls ? 'Exportando…' : 'Exportar datos filtrados'}
                </Button>
              </div>
              <div className="space-y-4">
                {trendingWindows.map((window) => (
                  <div key={window.key} className="rounded-xl border border-border">
                    <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-2 bg-surface-alt/40">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{window.label}</div>
                        <div className="text-[11px] text-muted">
                          Actual: {window.currentRange} · Baseline: {window.baselineRange}
                        </div>
                      </div>
                      <Badge variant={window.available ? 'primary' : 'warning'} className="text-[10px]">
                        {window.available ? `${window.rows.length} URLs con pico` : 'No disponible'}
                      </Badge>
                    </div>
                    {!window.available ? (
                      <div className="px-3 py-3 text-xs text-muted">{window.availabilityMessage}</div>
                    ) : window.rows.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-muted">Sin picos relevantes detectados en esta ventana.</div>
                    ) : (
                      <div className="max-h-[360px] overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-surface">
                            <tr className="text-left text-muted">
                              <th className="px-3 py-2">URL</th>
                              <th className="px-3 py-2">Periodo</th>
                              <th className="px-3 py-2">Rango pico</th>
                              <th className="px-3 py-2">Clics actual</th>
                              <th className="px-3 py-2">Clics baseline</th>
                              <th className="px-3 py-2">Δ abs</th>
                              <th className="px-3 py-2">Δ %</th>
                              <th className="px-3 py-2">Multiplicador</th>
                              <th className="px-3 py-2">Impresiones</th>
                              <th className="px-3 py-2">CTR</th>
                              <th className="px-3 py-2">Posición</th>
                              <th className="px-3 py-2">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {window.rows.map((trend, i) => (
                              <tr key={`${trend.url}-${window.key}-${i}`} className="border-t border-border hover:bg-surface-alt/40">
                                <td className="px-3 py-2 max-w-[260px]">
                                  <a href={trend.url} target="_blank" rel="noreferrer" className="line-clamp-1 text-primary hover:underline">
                                    {trend.url}
                                  </a>
                                </td>
                                <td className="px-3 py-2">{trend.periodLabel}</td>
                                <td className="px-3 py-2">{trend.peakRange}</td>
                                <td className="px-3 py-2">{Math.round(trend.currentClicks).toLocaleString()}</td>
                                <td className="px-3 py-2">{Math.round(Math.max(0, trend.baselineClicks)).toLocaleString()}</td>
                                <td className="px-3 py-2 font-semibold text-primary">+{Math.round(trend.clickIncrease).toLocaleString()}</td>
                                <td className="px-3 py-2">{trend.clickChangePct.toFixed(1)}%</td>
                                <td className="px-3 py-2">x{trend.surgeRatio.toFixed(2)}</td>
                                <td className="px-3 py-2">{Math.round(trend.impressions).toLocaleString()}</td>
                                <td className="px-3 py-2">{trend.ctr.toFixed(2)}%</td>
                                <td className="px-3 py-2">{formatPositionSafe(trend.position)}</td>
                                <td className="px-3 py-2">
                                  <Badge variant="secondary" className="text-[10px]">{trend.statusLabel}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Modal>

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
