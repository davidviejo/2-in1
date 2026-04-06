import React, { useMemo, useState } from 'react';
import { Loader2, Newspaper, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { DashboardStats } from '../features/trends-media/components/DashboardStats';
import { BriefGenerator, PipelineStatus } from '../features/trends-media/components/BriefGenerator';
import { Settings } from '../features/trends-media/components/Settings';
import { MOCK_TRENDS } from '../features/trends-media/constants';
import { analyzeNewsWithGemini } from '../features/trends-media/services/gemini';
import { processNews } from '../features/trends-media/services/newsProcessor';
import { fetchSerpResults } from '../features/trends-media/services/serp';
import { getSettings } from '../features/trends-media/services/storage';
import { AppSettings, DashboardStats as StatsType, NewsCluster, NewsPriority } from '../features/trends-media/types';
import { useSettings } from '../context/SettingsContext';

const viewOptions = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'brief', label: 'Brief diario' },
  { id: 'settings', label: 'Configuración' },
] as const;

type ViewId = (typeof viewOptions)[number]['id'];

const TrendsMediaPage: React.FC = () => {
  const { settings: appSettings } = useSettings();
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [newsClusters, setNewsClusters] = useState<NewsCluster[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [stats, setStats] = useState<StatsType>({
    sourcesScanned: 0,
    itemsFound: 0,
    highPriority: 0,
    duplicatesRemoved: 0,
  });

  const headline = useMemo(() => {
    if (currentView === 'brief') return 'Generador de Contenido';
    if (currentView === 'settings') return 'Configuración';
    return 'Panel de Control';
  }, [currentView]);

  const runPipeline = async () => {
    try {
      setPipelineStatus('fetching');
      setStatusMessage(`Escaneando Google News (${settings.searchQueries.length} queries)...`);
      if (currentView === 'dashboard') setCurrentView('brief');

      const rawArticles = await fetchSerpResults(settings);
      setStatusMessage('Procesando: deduplicando y calculando scores...');
      const processedClusters = processNews(rawArticles);

      setPipelineStatus('analyzing');
      setStatusMessage(`Analizando ${processedClusters.length} temas con Gemini AI...`);
      const analyzedClusters = await analyzeNewsWithGemini(
        processedClusters,
        appSettings.geminiApiKey || '',
      );

      setNewsClusters(analyzedClusters);
      setPipelineStatus('done');
      const p1Count = analyzedClusters.filter((cluster) => cluster.ai_analysis?.priority === NewsPriority.P1).length;
      setStats((previous) => ({
        ...previous,
        sourcesScanned: previous.sourcesScanned + rawArticles.length,
        itemsFound: analyzedClusters.length,
        highPriority: p1Count,
        duplicatesRemoved: rawArticles.length - processedClusters.length,
      }));
    } catch (error) {
      console.error(error);
      setPipelineStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Error desconocido');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white shadow-xl">
        <div className="flex flex-col gap-6 px-8 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
              <Newspaper className="h-3.5 w-3.5" />
              Trends media integrado
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{headline}</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">El antiguo standalone <code>Tendencias-medios-main/Tendencias-medios-main</code> fue consolidado en este módulo canónico para compartir frontend, despliegue y dependencias sin código duplicado.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {viewOptions.map((view) => (
              <button key={view.id} type="button" onClick={() => setCurrentView(view.id)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${currentView === view.id ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {view.label}
              </button>
            ))}
            <button onClick={runPipeline} disabled={pipelineStatus === 'fetching' || pipelineStatus === 'analyzing'} className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-500">
              {pipelineStatus === 'fetching' || pipelineStatus === 'analyzing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span>{newsClusters.length > 0 ? 'Actualizar SERPs' : 'Analizar SERPs'}</span>
            </button>
            <button type="button" onClick={() => setCurrentView('settings')} className="rounded-full border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/20">
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {currentView === 'dashboard' && (
        <div className="space-y-8">
          <DashboardStats stats={stats} trends={MOCK_TRENDS} />
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-800">Últimas Noticias Detectadas</h3>
              {newsClusters.length > 0 && <span className="text-xs font-medium text-slate-500">{newsClusters.length} clusters</span>}
            </div>
            {newsClusters.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <p className="mb-4">No hay datos analizados todavía.</p>
                <button onClick={runPipeline} className="mx-auto flex items-center justify-center font-medium text-blue-600 hover:underline">Ejecutar análisis ahora</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-500">
                    <tr>
                      <th className="w-24 px-6 py-3">Prio</th>
                      <th className="px-6 py-3">Score</th>
                      <th className="px-6 py-3">Titular Sugerido</th>
                      <th className="px-6 py-3">Cluster</th>
                      <th className="px-6 py-3">Fuente Top</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {newsClusters.slice(0, 5).map((item) => (
                      <tr key={item.cluster_id} className="hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <span className={`rounded px-2 py-0.5 text-xs font-bold ${item.ai_analysis?.priority === NewsPriority.P1 ? 'bg-red-100 text-red-700' : item.ai_analysis?.priority === NewsPriority.P2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{item.ai_analysis?.priority}</span>
                        </td>
                        <td className="px-6 py-3 font-mono text-xs font-bold text-blue-600">{item.score}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">{item.ai_analysis?.suggestedTitle}</td>
                        <td className="px-6 py-3 text-slate-500">{item.ai_analysis?.category}</td>
                        <td className="px-6 py-3 text-slate-400">{item.top_source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {newsClusters.length > 5 && (
                  <div className="border-t border-slate-100 p-3 text-center">
                    <button onClick={() => setCurrentView('brief')} className="text-xs font-medium text-blue-600 hover:text-blue-800">Ver todos ({newsClusters.length}) →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'brief' && (
        <BriefGenerator
          items={newsClusters}
          pipelineStatus={pipelineStatus}
          statusMessage={statusMessage}
          onRunPipeline={runPipeline}
          onNavigateToSettings={() => {
            window.location.href = '/app/settings';
          }}
        />
      )}

      {currentView === 'settings' && <Settings onSettingsChanged={setSettings} />}
    </div>
  );
};

export default TrendsMediaPage;
