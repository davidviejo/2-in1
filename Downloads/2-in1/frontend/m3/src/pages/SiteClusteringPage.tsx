import React, { useMemo, useState } from 'react';
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

const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 27);
  return {
    endDate: end.toISOString().split('T')[0],
    startDate: start.toISOString().split('T')[0],
  };
};

const getPathname = (url: string): string => {
  const trimmedUrl = (url || '').trim();
  if (!trimmedUrl) return '';

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
  if (!path) return '/sin-ruta';

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  return `/${segments.slice(0, level).join('/')}`;
};

const parseRegexPattern = (rawPattern: string): RegExp | null => {
  const trimmed = rawPattern.trim();
  const regexMatch = trimmed.match(/^\/(.*)\/([a-z]*)$/i);
  if (!regexMatch) return null;
  try {
    return new RegExp(regexMatch[1], regexMatch[2]);
  } catch {
    return null;
  }
};

const matchesManualPattern = (url: string, pattern: string): boolean => {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) return false;

  const parsedRegex = parseRegexPattern(trimmedPattern);
  if (parsedRegex) {
    return parsedRegex.test(url);
  }

  return url.toLowerCase().includes(trimmedPattern.toLowerCase());
};

const resolveClusterName = (
  url: string,
  level: number,
  manualClusters: Array<{ name?: string; urls?: string[] }>,
): string => {
  for (const cluster of manualClusters) {
    if (!cluster?.name || !Array.isArray(cluster.urls)) continue;
    const hasMatch = cluster.urls.some((pattern) => matchesManualPattern(url, pattern));
    if (hasMatch) return cluster.name;
  }

  return toPathClusterByLevel(url, level);
};

const buildRowsByLevel = (
  gscData: Array<{ keys?: string[]; clicks?: number; impressions?: number; position?: number }>,
  level: number,
  manualClusters: Array<{ name?: string; urls?: string[] }>,
): ClusterRow[] => {
  const bucket = new Map<string, { urls: Set<string>; clicks: number; impressions: number; posWeighted: number; topQuery: string; topClicks: number }>();

  for (const row of gscData) {
    const page = row.keys?.[0] || '';
    const query = row.keys?.[1] || '';
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

  const { gscAccessToken, googleUser, login, handleLogoutGsc } = useGSCAuth();
  const { currentClient } = useProject();
  const { gscSites, selectedSite, setSelectedSite, gscData, isLoadingGsc } = useGSCData(gscAccessToken, startDate, endDate, 'previous_period', {
    autoRun: false,
    runKey,
  });

  const handleStartAnalysis = () => {
    setHasStartedAnalysis(true);
    setRunKey((prev) => prev + 1);
  };

  const maxDepth = useMemo(() => {
    let depth = 1;
    for (const row of gscData) {
      const page = row.keys?.[0] || '';
      try {
        const segments = new URL(page).pathname.split('/').filter(Boolean).length;
        depth = Math.max(depth, segments || 1);
      } catch {
        depth = Math.max(depth, 1);
      }
    }
    return Math.min(Math.max(depth, 1), 6);
  }, [gscData]);

  const levelData = useMemo<LevelData[]>(() => {
    if (!hasStartedAnalysis) {
      return [];
    }
    return Array.from({ length: maxDepth }, (_, i) => ({
      level: i + 1,
      rows: buildRowsByLevel(gscData, i + 1, currentClient?.seoClusters || []),
    }));
  }, [currentClient?.seoClusters, gscData, hasStartedAnalysis, maxDepth]);

  const selectedLevelRows = levelData.find((item) => item.level === selectedLevel)?.rows || [];
  const selectedClustersForChart = selectedLevelRows.slice(0, 10);

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
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Reglas manuales</label>
          <textarea
            className="w-full min-h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
            value={manualClusterRules}
            onChange={(e) => setManualClusterRules(e.target.value)}
            placeholder="Una regla por línea. Ej: /blog/* => cluster: contenido"
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
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={selectedClustersForChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cluster" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="clicks" name="Clics" stroke="#334155" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="impressions" name="Impresiones" stroke="#64748b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {levelData.map((level) => (
        <section key={level.level} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Tabla clústeres nivel {level.level}</h2>
            <span className="text-xs text-slate-500">{level.rows.length} clústeres</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-2 pr-3">Clúster</th><th className="py-2 pr-3">URLs</th><th className="py-2 pr-3">Clics</th><th className="py-2 pr-3">Impresiones</th><th className="py-2 pr-3">Pos. media</th><th className="py-2 pr-3">Top query</th>
                </tr>
              </thead>
              <tbody>
                {level.rows.slice(0, 50).map((row) => (
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
        </section>
      ))}
    </div>
  );
};

export default SiteClusteringPage;
