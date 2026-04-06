import React from 'react';
import { AlertCircle, BarChart2, ExternalLink, FileText, Loader2, Play, RefreshCw, Send, Settings } from 'lucide-react';
import { ClusterCategory, NewsCluster, NewsPriority } from '../types';
import { useSettings } from '../../../context/SettingsContext';

export type PipelineStatus = 'idle' | 'fetching' | 'analyzing' | 'done' | 'error';

interface BriefGeneratorProps {
  items: NewsCluster[];
  pipelineStatus: PipelineStatus;
  statusMessage: string;
  onRunPipeline: () => void;
  onNavigateToSettings: () => void;
}

const PriorityBadge: React.FC<{ priority: NewsPriority }> = ({ priority }) => {
  const colors = {
    [NewsPriority.P1]: 'border-red-200 bg-red-100 text-red-700',
    [NewsPriority.P2]: 'border-amber-200 bg-amber-100 text-amber-700',
    [NewsPriority.P3]: 'border-blue-200 bg-blue-100 text-blue-700',
    [NewsPriority.DISCARD]: 'border-slate-200 bg-slate-100 text-slate-500',
  };

  return <span className={`rounded-md border px-2 py-1 text-xs font-bold ${colors[priority]}`}>{priority}</span>;
};

const ClusterBadge: React.FC<{ category: ClusterCategory }> = ({ category }) => (
  <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{category}</span>
);

export const BriefGenerator: React.FC<BriefGeneratorProps> = ({ items, pipelineStatus, statusMessage, onRunPipeline, onNavigateToSettings }) => {
  const { settings } = useSettings();
  const defaultSerpProvider = settings.defaultSerpProvider || 'dataforseo';
  const hasGlobalSerpCredentials =
    defaultSerpProvider === 'serpapi'
      ? Boolean(settings.serpApiKey?.trim())
      : Boolean(settings.dataforseoLogin?.trim() && settings.dataforseoPassword?.trim());

  if (pipelineStatus === 'fetching' || pipelineStatus === 'analyzing') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-100 opacity-75 animate-ping" />
          <div className="relative rounded-full bg-white p-4 shadow-md">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-slate-800">{pipelineStatus === 'fetching' ? 'Recopilando y Procesando...' : 'Analizando con IA...'}</h3>
          <p className="mt-2 text-sm text-slate-500">{statusMessage}</p>
        </div>
      </div>
    );
  }

  if (pipelineStatus === 'idle' && items.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="rounded-full border border-slate-100 bg-slate-50 p-6">
          <RefreshCw className="h-12 w-12 text-slate-400" />
        </div>
        <div className="max-w-md">
          <h2 className="mb-2 text-2xl font-bold text-slate-800">Generador de Briefs</h2>
          <p className="mb-6 text-slate-500">Pipeline listo. Inicia el análisis para buscar noticias en tiempo real, agruparlas por clusters y puntuarlas.</p>
          <button onClick={onRunPipeline} className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:bg-blue-700">
            <Play className="h-5 w-5" />
            <span>Iniciar Pipeline</span>
          </button>
          {!hasGlobalSerpCredentials && (
            <button type="button" onClick={onNavigateToSettings} className="mt-4 flex w-full items-center justify-center rounded bg-red-50 p-2 text-xs text-red-500 hover:bg-red-100">
              <Settings className="mr-1 h-3 w-3" />
              Configurar credenciales en Ajustes
            </button>
          )}
        </div>
      </div>
    );
  }

  const p1Items = items.filter((item) => item.ai_analysis?.priority === NewsPriority.P1);
  const p2Items = items.filter((item) => item.ai_analysis?.priority === NewsPriority.P2);
  const discardItems = items.filter(
    (item) => item.ai_analysis?.priority === NewsPriority.DISCARD || item.ai_analysis?.priority === NewsPriority.P3,
  );
  const validItems = [...p1Items, ...p2Items];

  return (
    <div className="space-y-6 pb-20">
      {pipelineStatus === 'error' && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{statusMessage || 'No se pudo completar el pipeline.'}</span>
        </div>
      )}

      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800"><span className="h-2 w-2 rounded-full bg-emerald-500" />Brief Generado</h2>
          <p className="mt-1 text-xs text-slate-500">{items.length} clusters • {p1Items.length} prioritarios • {new Date().toLocaleTimeString()}</p>
        </div>
        <button onClick={() => window.alert('Brief enviado a Slack (#redaccion-valencia) y Notion DB.')} className="flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
          <Send className="h-4 w-4" />
          <span>Enviar a Redacción</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="mb-2 flex items-center space-x-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Temas Prioritarios</h3>
          </div>
          {validItems.map((item) => (
            <div key={item.cluster_id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="mb-3 flex items-start justify-between">
                <div className="flex space-x-2">
                  <PriorityBadge priority={item.ai_analysis?.priority as NewsPriority} />
                  <ClusterBadge category={item.ai_analysis?.category as ClusterCategory} />
                </div>
                <div className="flex items-center space-x-1 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                  <BarChart2 className="h-3 w-3" />
                  <span className="font-mono font-bold">{item.score}</span>
                </div>
              </div>
              <h3 className="mb-2 text-xl font-bold leading-tight text-slate-800 transition-colors group-hover:text-blue-700">{item.ai_analysis?.suggestedTitle}</h3>
              <p className="mb-4 text-sm leading-relaxed text-slate-600">{item.ai_analysis?.summary}</p>
              <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Interés para Economía 3</p>
                <p className="text-xs italic text-slate-700">“{item.ai_analysis?.reasoning}”</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3 text-xs text-slate-400">
                <div className="flex items-center space-x-4">
                  <span>Fuente Principal: <span className="font-medium text-slate-600">{item.top_source}</span></span>
                  {item.coverage_count > 1 && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-500">+{item.coverage_count - 1} fuentes extra</span>}
                </div>
                <a href={item.articles[0]?.url} target="_blank" rel="noreferrer" className="flex items-center hover:text-blue-600">
                  Leer Original <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
          {validItems.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-400">No se encontraron noticias de alta prioridad en esta ejecución.</div>}
        </div>

        <div className="space-y-4">
          <h3 className="ml-1 text-sm font-bold uppercase tracking-wider text-slate-500">Descartados / Baja Prioridad</h3>
          <div className="max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {discardItems.length === 0 ? (
              <div className="p-6 text-center text-sm italic text-slate-400">No hay items descartados.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {discardItems.map((item) => (
                  <div key={item.cluster_id} className="p-4 transition-colors hover:bg-slate-50">
                    <div className="mb-2 flex items-start justify-between">
                      <h4 className="line-clamp-2 text-sm font-medium leading-snug text-slate-700">{item.title}</h4>
                      <div className="ml-2 shrink-0"><PriorityBadge priority={item.ai_analysis?.priority as NewsPriority} /></div>
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500">{item.top_source}</p>
                      <span className="text-xs text-slate-300">Score: {item.score}</span>
                    </div>
                    <p className="rounded border border-red-100 bg-red-50 p-2 text-xs italic text-red-500">{item.ai_analysis?.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
