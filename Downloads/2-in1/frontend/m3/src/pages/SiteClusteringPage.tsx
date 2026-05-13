import React, { useMemo, useState } from 'react';
import { useSeoChecklist } from '@/hooks/useSeoChecklist';
import { Network, RefreshCw, ShieldCheck } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGSCAuth } from '@/hooks/useGSCAuth';
import { useGSCData } from '@/hooks/useGSCData';
import { useProject } from '@/context/ProjectContext';

type ClusterRow = {
  cluster: string;
  urls: number;
  clicks: number;
  impressions: number;
  avgPosition: number;
  topQuery: string;
};

type LevelData = {
  level: number;
  rows: ClusterRow[];
};

type ClusterTimePoint = {
  week: string;
  cluster: string;
  clicks: number;
  impressions: number;
};

const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 27);
  return {
    endDate: end.toISOString().split('T')[0],
    startDate: start.toISOString().split('T')[0],
  };
};

export const getPathname = (url: string): string => {
  const trimmedUrl = (url || '').trim();
  if (!trimmedUrl) return '';
  if (!trimmedUrl.startsWith('/') && !/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedUrl)) return '';

  const looksLikeAbsoluteUrl = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedUrl);

  try {
    if (looksLikeAbsoluteUrl) {
      return new URL(trimmedUrl).pathname;
    }

    return new URL(trimmedUrl, 'https://placeholder.local').pathname;
  } catch {
    if (trimmedUrl.startsWith('/')) return trimmedUrl;
    return '';
  }
};

const toPathClusterByLevel = (url: string, level: number): string => {
  const path = getPathname(url).replace(/\/+$/, '');
  if (!path) return 'Sin cluster';

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  return `/${segments.slice(0, level).join('/')}`;
};

export const isLikelyPageKey = (value: string): boolean => {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.pathname.startsWith('/');
    } catch {
      return false;
    }
  }
  if (trimmed.startsWith('/')) return true;
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) return false;
  return false;
};

const parseRegexPattern = (rawPattern: string): RegExp | null => {
  const trimmed = rawPattern.trim();
  const regexMatch = trimmed.match(/^\/(.*)\/([a-z]*)$/i);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch {
      return null;
    }
  }

  const looksLikeRegex = /[\^$]|\(\?[:!=<]/.test(trimmed);
  if (!looksLikeRegex) return null;

  try {
    return new RegExp(trimmed, 'i');
  } catch {
    return null;
  }
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type ManualClusterRule = {
  name: string;
  urls: string[];
  level?: number;
};
const UNASSIGNED_CLUSTER = 'Sin cluster';

export const parseManualClusterRules = (rulesText: string): ManualClusterRule[] =>
  rulesText
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes('=>')) {
        const [left, right] = line.split('=>').map((part) => part.trim());
        if (!left || !right) return null;

        const clusterName = right.replace(/^cluster\s*:\s*/i, '').trim();
        if (!clusterName) return null;

        return {
          name: clusterName,
          urls: [left],
        };
      }

      const [namePart, levelPart, patternsPart] = line.split('|').map((part) => part.trim());
      if (!namePart || !patternsPart) return null;
      const level = Number(levelPart);

      return {
        name: namePart,
        level: Number.isFinite(level) && level > 0 ? Math.floor(level) : undefined,
        urls: patternsPart
          .split(',')
          .map((pattern) => pattern.trim())
          .filter(Boolean),
      };
    })
    .filter((item): item is ManualClusterRule => Boolean(item) && item.urls.length > 0);

const matchesManualPattern = (url: string, pattern: string): boolean => {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) return false;

  const parsedRegex = parseRegexPattern(trimmedPattern);
  if (parsedRegex) {
    return parsedRegex.test(url);
  }

  const pathname = getPathname(url) || url;
  const normalizedPattern = trimmedPattern.toLowerCase();

  if (normalizedPattern.includes('*')) {
    const wildcardRegex = new RegExp(`^${escapeRegExp(normalizedPattern).replace(/\\\*/g, '.*')}$`, 'i');
    return wildcardRegex.test(pathname.toLowerCase()) || wildcardRegex.test(url.toLowerCase());
  }

  return pathname.toLowerCase().includes(normalizedPattern) || url.toLowerCase().includes(normalizedPattern);
};

export const resolveClusterName = (
  url: string,
  level: number,
  manualClusters: Array<{ name?: string; urls?: string[]; level?: number }>,
): string => {
  const hasManualRules = manualClusters.some((cluster) => Array.isArray(cluster?.urls) && cluster.urls.length > 0);
  for (const cluster of manualClusters) {
    if (!cluster?.name || !Array.isArray(cluster.urls)) continue;
    if (typeof cluster.level === 'number' && cluster.level > 0 && cluster.level !== level) continue;
    const hasMatch = cluster.urls.some((pattern) => matchesManualPattern(url, pattern));
    if (hasMatch) return cluster.name;
  }

  if (hasManualRules) return UNASSIGNED_CLUSTER;
  return toPathClusterByLevel(url, level);
};



const extractPageFromRow = (row: { keys?: string[]; page?: string; url?: string }): string => {
  const keyA = row.keys?.[0] || '';
  const keyB = row.keys?.[1] || '';
  const keyALooksLikePage = isLikelyPageKey(keyA);
  const keyBLooksLikePage = isLikelyPageKey(keyB);

  const pageFromKeys = keyBLooksLikePage ? keyB : keyALooksLikePage ? keyA : '';
  const pageField = isLikelyPageKey(row.page || '') ? row.page || '' : '';
  const urlField = isLikelyPageKey(row.url || '') ? row.url || '' : '';

  return (pageField || urlField || pageFromKeys || '').trim();
};

export const getMaxDepthFromRows = (rows: Array<{ keys?: string[]; page?: string; url?: string }>): number => {
  let depth = 1;

  for (const row of rows) {
    const page = extractPageFromRow(row);
    if (!page) continue;

    const segments = getPathname(page).split('/').filter(Boolean).length;
    depth = Math.max(depth, segments || 1);
  }

  return Math.min(Math.max(depth, 1), 6);
};
export const buildRowsByLevel = (
  gscData: Array<{ keys?: string[]; page?: string; url?: string; query?: string; clicks?: number; impressions?: number; position?: number }>,
  level: number,
  manualClusters: Array<{ name?: string; urls?: string[]; level?: number }>,
): ClusterRow[] => {
  const bucket = new Map<string, { urls: Set<string>; clicks: number; impressions: number; posWeighted: number; topQuery: string; topClicks: number }>();

  for (const row of gscData) {
    const keyA = row.keys?.[0] || '';
    const keyB = row.keys?.[1] || '';
    const keyBLooksLikePage = isLikelyPageKey(keyB);
    const page = extractPageFromRow(row);
    const query = (row.query || (keyBLooksLikePage ? keyA : keyB) || '').trim();
    const cluster = resolveClusterName(page, level, manualClusters);
    const existing = bucket.get(cluster) || {
      urls: new Set<string>(),
      clicks: 0,
      impressions: 0,
      posWeighted: 0,
      topQuery: '-',
      topClicks: -1,
    };

    if (page) existing.urls.add(page);
    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    existing.clicks += clicks;
    existing.impressions += impressions;
    existing.posWeighted += (row.position || 0) * Math.max(impressions, 1);

    if (clicks > existing.topClicks && query) {
      existing.topClicks = clicks;
      existing.topQuery = query;
    }
    bucket.set(cluster, existing);
  }

  return Array.from(bucket.entries())
    .map(([cluster, data]) => ({
      cluster,
      urls: data.urls.size,
      clicks: Math.round(data.clicks),
      impressions: Math.round(data.impressions),
      avgPosition: data.impressions > 0 ? Number((data.posWeighted / data.impressions).toFixed(2)) : 0,
      topQuery: data.topQuery,
    }))
    .sort((a, b) => b.clicks - a.clicks);
};

const getWeekStart = (dateValue: string): string => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateValue;
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().split('T')[0];
};

const buildClusterTimeline = (
  pageDateData: Array<{ keys?: string[]; page?: string; url?: string; date?: string; clicks?: number; impressions?: number }>,
  level: number,
  manualClusters: Array<{ name?: string; urls?: string[] }>,
): ClusterTimePoint[] => {
  const bucket = new Map<string, { clicks: number; impressions: number }>();
  for (const row of pageDateData) {
    const pageFromKeys = isLikelyPageKey(row.keys?.[0] || '') ? row.keys?.[0] || '' : '';
    const pageField = isLikelyPageKey(row.page || '') ? row.page || '' : '';
    const urlField = isLikelyPageKey(row.url || '') ? row.url || '' : '';
    const page = (pageField || urlField || pageFromKeys || '').trim();
    const rawDate = (row.date || row.keys?.[1] || '').trim();
    if (!page || !rawDate) continue;

    const week = getWeekStart(rawDate);
    const cluster = resolveClusterName(page, level, manualClusters);
    const key = `${week}::${cluster}`;
    const current = bucket.get(key) || { clicks: 0, impressions: 0 };
    current.clicks += row.clicks || 0;
    current.impressions += row.impressions || 0;
    bucket.set(key, current);
  }

  return Array.from(bucket.entries())
    .map(([key, value]) => {
      const [week, cluster] = key.split('::');
      return {
        week,
        cluster,
        clicks: Math.round(value.clicks),
        impressions: Math.round(value.impressions),
      };
    })
    .sort((a, b) => a.week.localeCompare(b.week));
};



export const buildAutoClustersFromChecklist = (pages: Array<{ url: string }>) => {
  const groups = new Map<string, Set<string>>();

  for (const page of pages) {
    const path = getPathname(page.url).replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) continue;

    const parentPath = `/${segments.slice(0, -1).join('/')}`;
    const leafPath = `/${segments.join('/')}`;

    if (!groups.has(parentPath)) groups.set(parentPath, new Set());
    groups.get(parentPath)?.add(leafPath);
  }

  return Array.from(groups.entries())
    .filter(([, children]) => children.size > 1)
    .map(([parentPath, children]) => {
      const childDepths = Array.from(children).map((childPath) => childPath.split('/').filter(Boolean).length);
      const clusterLevel = Math.max(...childDepths, 1);
      return {
        id: `auto-${parentPath}`,
        name: parentPath,
        level: clusterLevel,
        urls: Array.from(children).sort((a, b) => a.localeCompare(b)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

const SiteClusteringPage: React.FC = () => {
  const { startDate: defaultStartDate, endDate: defaultEndDate } = getDefaultDates();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [runKey, setRunKey] = useState(0);
  const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);
  const [manualClusterRules, setManualClusterRules] = useState('');
  const [clusterRulesFileName, setClusterRulesFileName] = useState('');
  const [minimumClicks, setMinimumClicks] = useState(10);
  const [clusterDepth, setClusterDepth] = useState(2);
  const [autoClusterStatus, setAutoClusterStatus] = useState('');

  const { gscAccessToken, googleUser, login, handleLogoutGsc } = useGSCAuth();
  const { currentClient, updateCurrentClientProfile } = useProject();
  const { pages: checklistPages } = useSeoChecklist();
  const { gscSites, selectedSite, setSelectedSite, gscData, queryPageData, pageDateData, isLoadingGsc } = useGSCData(gscAccessToken, startDate, endDate, 'previous_period', {
    autoRun: false,
    runKey,
  });

  const handleStartAnalysis = () => {
    setHasStartedAnalysis(true);
    setRunKey((prev) => prev + 1);
  };

  const maxDepth = useMemo(() => getMaxDepthFromRows(queryPageData), [queryPageData]);

  const mergedManualClusters = useMemo(() => ([
    ...(currentClient?.seoClusters || []),
    ...parseManualClusterRules(manualClusterRules),
  ]), [currentClient?.seoClusters, manualClusterRules]);

  const levelData = useMemo<LevelData[]>(() => {
    if (!hasStartedAnalysis) {
      return [];
    }
    return Array.from({ length: maxDepth }, (_, i) => ({
      level: i + 1,
      rows: buildRowsByLevel(queryPageData, i + 1, mergedManualClusters),
    }));
  }, [queryPageData, hasStartedAnalysis, maxDepth, mergedManualClusters]);



  const handleAutoGenerateNestedClusters = () => {
    if (!currentClient) return;

    const generatedClusters = buildAutoClustersFromChecklist(checklistPages);
    if (generatedClusters.length === 0) {
      setAutoClusterStatus('No se detectaron rutas anidadas con múltiples URLs hijas en el checklist.');
      return;
    }

    const existingByNameAndLevel = new Set(
      (currentClient.seoClusters || []).map((cluster) => `${cluster.name.toLowerCase()}::${cluster.level || 0}`),
    );
    const uniqueClusters = generatedClusters.filter(
      (cluster) => !existingByNameAndLevel.has(`${cluster.name.toLowerCase()}::${cluster.level || 0}`),
    );

    if (uniqueClusters.length === 0) {
      setAutoClusterStatus('Los clusters anidados detectados ya existen en la configuración actual.');
      return;
    }

    updateCurrentClientProfile({
      projectType: currentClient.projectType,
      sector: currentClient.sector,
      geoScope: currentClient.geoScope,
      brandTerms: currentClient.brandTerms || [],
      analysisProjectTypes: currentClient.analysisProjectTypes || [],
      brandedKeywords: currentClient.brandedKeywords || [],
      websiteDomain: currentClient.websiteDomain,
      nestedClusterRules: currentClient.nestedClusterRules || [],
      seoClusters: [...(currentClient.seoClusters || []), ...uniqueClusters],
    });

    setAutoClusterStatus(`Se añadieron ${uniqueClusters.length} clúster(es) automáticos desde URLs anidadas del checklist.`);
  };

  const selectedLevelRows = levelData.find((item) => item.level === selectedLevel)?.rows || [];
  const assignedRows = selectedLevelRows.filter((row) => row.cluster !== UNASSIGNED_CLUSTER);
  const unassignedRows = selectedLevelRows.filter((row) => row.cluster === UNASSIGNED_CLUSTER);
  const [selectedChartClusters, setSelectedChartClusters] = useState<string[]>([]);
  const clusterTimeline = useMemo(
    () => buildClusterTimeline(pageDateData, selectedLevel, mergedManualClusters),
    [pageDateData, selectedLevel, mergedManualClusters],
  );
  const clusterOptions = useMemo(() => assignedRows.slice(0, 15).map((row) => row.cluster), [assignedRows]);
  const activeClusters = selectedChartClusters.length > 0 ? selectedChartClusters : clusterOptions.slice(0, 5);
  const timelineChartData = useMemo(() => {
    const pointsByWeek = new Map<string, Record<string, string | number>>();
    for (const point of clusterTimeline) {
      if (!activeClusters.includes(point.cluster)) continue;
      const weekPoint = pointsByWeek.get(point.week) || { week: point.week };
      weekPoint[point.cluster] = point.clicks;
      pointsByWeek.set(point.week, weekPoint);
    }
    return Array.from(pointsByWeek.values()).sort((a, b) => String(a.week).localeCompare(String(b.week)));
  }, [clusterTimeline, activeClusters]);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-20 space-y-6">
      <header className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Network size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clustering de site</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tablas por nivel, comparación visual por clúster y selección de rango temporal desde Google Search Console.
              </p>
            </div>
          </div>

          {!gscAccessToken ? (
            <button onClick={() => login()} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold">
              Conectar GSC
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{googleUser?.email || 'Conectado a GSC'}</span>
              <button onClick={handleLogoutGsc} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm">
                Desconectar
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Propiedad GSC</label>
            <select className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm" value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} disabled={!gscAccessToken || gscSites.length === 0}>
              {gscSites.map((site) => (
                <option key={site.siteUrl} value={site.siteUrl}>{site.siteUrl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Desde</label>
            <input type="date" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Hasta</label>
            <input type="date" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nivel para gráfica</label>
            <select className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm" value={selectedLevel} onChange={(e) => setSelectedLevel(Number(e.target.value))}>
              {levelData.map((item) => <option key={item.level} value={item.level}>Nivel {item.level}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleStartAnalysis}
            disabled={!gscAccessToken || !selectedSite || isLoadingGsc}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Iniciar análisis
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} />Método: agregación jerárquica por prefijos de ruta para comparar clústeres por nivel.</div>
        {!hasStartedAnalysis && (
          <p className="text-xs text-slate-500">
            Selecciona propiedad y rango de fechas, y pulsa <strong>Iniciar análisis</strong> para ejecutar el procesamiento.
          </p>
        )}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Ajustes de clúster manual</h2>
          <p className="text-xs text-slate-500 mt-1">Configura reglas manuales e importa un archivo para ajustar el clustering sin depender de otras páginas.</p>
          <p className="text-xs text-slate-500 mt-1">También puedes autogenerar clusters cuando una ruta padre tiene un nivel inferior con varias páginas en el checklist SEO.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleAutoGenerateNestedClusters}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
          >
            Auto-generar clusters desde checklist
          </button>
          {autoClusterStatus && <span className="text-xs text-slate-500">{autoClusterStatus}</span>}
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Reglas manuales</label>
          <textarea
            className="w-full min-h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
            value={manualClusterRules}
            onChange={(e) => setManualClusterRules(e.target.value)}
            placeholder={'Una regla por línea.\nFormato oficial: Cluster|Nivel|/path1,/path2\nEj: Blog Posts|1|/blog/*,/articulos/*\nCompatible legacy: /blog/* => cluster: contenido'}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Importar reglas</label>
            <input
              type="file"
              accept=".txt,.csv,.json"
              onChange={(e) => setClusterRulesFileName(e.target.files?.[0]?.name || '')}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
            {clusterRulesFileName && <p className="text-xs text-slate-500 mt-2">Archivo cargado: {clusterRulesFileName}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Mínimo de clics</label>
            <input
              type="number"
              min={0}
              value={minimumClicks}
              onChange={(e) => setMinimumClicks(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Profundidad de clúster</label>
            <input
              type="number"
              min={1}
              max={6}
              value={clusterDepth}
              onChange={(e) => setClusterDepth(Math.min(Math.max(Number(e.target.value) || 1, 1), 6))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Comparativa gráfica (nivel {selectedLevel})</h2>
          {isLoadingGsc && <span className="text-xs text-slate-500 inline-flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Cargando…</span>}
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Clusters visibles en gráfica temporal (semanal)</label>
          <select
            multiple
            value={selectedChartClusters}
            onChange={(event) => {
              const values = Array.from(event.target.selectedOptions).map((opt) => opt.value);
              setSelectedChartClusters(values);
            }}
            className="w-full min-h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
          >
            {clusterOptions.map((cluster) => (
              <option key={cluster} value={cluster}>{cluster}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-2">Si no seleccionas ninguno, se muestran automáticamente los 5 clusters con más clics.</p>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              {activeClusters.map((cluster, index) => (
                <Line
                  key={cluster}
                  type="monotone"
                  dataKey={cluster}
                  name={cluster}
                  stroke={['#334155', '#64748b', '#0f766e', '#7c3aed', '#b45309', '#be123c'][index % 6]}
                  strokeWidth={2}
                  dot
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {levelData.map((level) => (
        <section key={level.level} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Tabla clústeres nivel {level.level}</h2>
            <span className="text-xs text-slate-500">{level.rows.filter((row) => row.cluster !== UNASSIGNED_CLUSTER).length} clústeres</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-2 pr-3">Clúster</th><th className="py-2 pr-3">URLs</th><th className="py-2 pr-3">Clics</th><th className="py-2 pr-3">Impresiones</th><th className="py-2 pr-3">Pos. media</th><th className="py-2 pr-3">Top query</th>
                </tr>
              </thead>
              <tbody>
                {level.rows.filter((row) => row.cluster !== UNASSIGNED_CLUSTER).slice(0, 50).map((row) => (
                  <tr key={`${level.level}-${row.cluster}`} className="border-b border-slate-100 dark:border-slate-700/40">
                    <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">{row.cluster}</td>
                    <td className="py-2 pr-3">{row.urls}</td>
                    <td className="py-2 pr-3">{row.clicks}</td>
                    <td className="py-2 pr-3">{row.impressions}</td>
                    <td className="py-2 pr-3">{row.avgPosition}</td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{row.topQuery}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unassignedRows.length > 0 && level.level === selectedLevel && (
            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 dark:text-white">URLs sin cluster asignado</h3>
              <p className="text-xs text-slate-500 mt-1">Estas URLs no coinciden con reglas manuales. Puedes asignarlas editando reglas en formato Cluster|Nivel|/path1,/path2.</p>
              <p className="text-xs text-slate-500 mt-2">Total de URLs agrupadas sin cluster: {unassignedRows[0].urls}</p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
};

export default SiteClusteringPage;
