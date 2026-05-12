import React, { useMemo } from 'react';
import { Network, RefreshCw, ShieldCheck } from 'lucide-react';
import { useGSCAuth } from '@/hooks/useGSCAuth';
import { useGSCData } from '@/hooks/useGSCData';

type ClusterRow = {
  cluster: string;
  urls: number;
  clicks: number;
  impressions: number;
  avgPosition: number;
  topQuery: string;
};

const toPathCluster = (url: string): string => {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return '/';
    if (segments.length === 1) return `/${segments[0]}`;
    return `/${segments[0]}/${segments[1]}`;
  } catch {
    return '/sin-ruta';
  }
};

const SiteClusteringPage: React.FC = () => {
  const { gscAccessToken, googleUser, login, handleLogoutGsc } = useGSCAuth();
  const { gscSites, selectedSite, setSelectedSite, gscData, isLoadingGsc } = useGSCData(gscAccessToken);

  const clusters = useMemo<ClusterRow[]>(() => {
    const bucket = new Map<string, { urls: Set<string>; clicks: number; impressions: number; posWeighted: number; topQuery: string; topClicks: number }>();

    for (const row of gscData) {
      const page = row.keys?.[0] || '';
      const query = row.keys?.[1] || '';
      const cluster = toPathCluster(page);
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
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);
  }, [gscData]);

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
                Panel de control con datos de Google Search Console por clúster de URLs (sin módulo Impacto GSC).
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Propiedad GSC</label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              disabled={!gscAccessToken || gscSites.length === 0}
            >
              {gscSites.map((site) => (
                <option key={site.siteUrl} value={site.siteUrl}>{site.siteUrl}</option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500">Clústeres detectados</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{clusters.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500">Filas GSC analizadas</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{gscData.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={14} />
          Método: agregación por niveles de ruta (<code>/&lt;nivel-1&gt;/&lt;nivel-2&gt;</code>) para panel de control operativo.
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Ranking de clústeres</h2>
          {isLoadingGsc && <span className="text-xs text-slate-500 inline-flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Cargando…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th className="py-2 pr-3">Clúster</th><th className="py-2 pr-3">URLs</th><th className="py-2 pr-3">Clics</th><th className="py-2 pr-3">Impresiones</th><th className="py-2 pr-3">Pos. media</th><th className="py-2 pr-3">Top query</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((row) => (
                <tr key={row.cluster} className="border-b border-slate-100 dark:border-slate-700/40">
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
    </div>
  );
};

export default SiteClusteringPage;
