import React, { useState } from 'react';
import {
  Layers,
  ChevronRight,
  Target,
  BarChart,
  CheckCircle2,
  AlertCircle,
  Hash,
  Search,
  ExternalLink,
} from 'lucide-react';

interface Props {
  data: any;
}

export const ClusteringAnalysis: React.FC<Props> = ({ data }) => {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  // If no clusters data, show the placeholder message
  if (!data?.clusters || !Array.isArray(data.clusters) || data.clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center">
        <Layers className="text-slate-300 dark:text-slate-600 mb-2" size={32} />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Activa clustering SERP para obtener intenciones de búsqueda
        </p>
      </div>
    );
  }

  const { summary, clusters } = data;

  const toggleCluster = (clusterId: string) => {
    const newExpanded = new Set(expandedClusters);
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId);
    } else {
      newExpanded.add(clusterId);
    }
    setExpandedClusters(newExpanded);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 text-center">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {summary.totalClusters || 0}
            </div>
            <div className="text-[10px] font-bold uppercase text-blue-600/70 dark:text-blue-400 tracking-wider">
              Total Clusters
            </div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800 text-center">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {summary.ownedClusters || 0}
            </div>
            <div className="text-[10px] font-bold uppercase text-emerald-600/70 dark:text-emerald-400 tracking-wider">
              Owned
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800 text-center">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {summary.opportunityClusters || 0}
            </div>
            <div className="text-[10px] font-bold uppercase text-amber-600/70 dark:text-amber-400 tracking-wider">
              Opportunity
            </div>
          </div>
        </div>
      )}

      {/* Clusters List */}
      <div className="space-y-3">
        {clusters.map((cluster: any, index: number) => {
          const isExpanded = expandedClusters.has(cluster.clusterId || index.toString());
          const isOwned = cluster.coverage === 'OWNED';

          return (
            <div
              key={cluster.clusterId || index}
              className={`border rounded-lg overflow-hidden transition-all ${
                isOwned
                  ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              {/* Header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => toggleCluster(cluster.clusterId || index.toString())}
              >
                <div
                  className={`p-1 rounded transition-transform duration-200 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                >
                  <ChevronRight size={16} className="text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                      {cluster.kwObjetivo}
                    </span>
                    {cluster.intent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 uppercase font-bold tracking-wide">
                        {cluster.intent}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Hash size={10} />
                      {cluster.clusterId}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-bold ${
                        isOwned
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isOwned ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {cluster.coverage || 'OPPORTUNITY'}
                    </span>
                    {cluster.variations && (
                      <span className="flex items-center gap-1">
                        <Target size={12} />
                        {cluster.variations.length} Variaciones
                      </span>
                    )}
                  </div>
                </div>

                {cluster.runId && (
                  <div className="hidden sm:block text-[10px] text-slate-400 font-mono">
                    Run: {cluster.runId.slice(0, 8)}
                  </div>
                )}
              </div>

              {/* Content */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700/50 p-3 bg-slate-50/50 dark:bg-slate-900/30 text-sm">
                  {/* Variations */}
                  {cluster.variations && cluster.variations.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <Target size={12} /> Keywords (Variaciones)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {cluster.variations.map((kw: any, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-600 dark:text-slate-300"
                          >
                            {typeof kw === 'string' ? kw : kw.keyword || JSON.stringify(kw)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top URLs Sample */}
                  {(cluster.topUrlsSample || cluster.urls) && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <Search size={12} /> Top URLs SERP
                      </h4>
                      <div className="space-y-1">
                        {(cluster.topUrlsSample || cluster.urls)
                          .slice(0, 5)
                          .map((url: string, i: number) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                            >
                              <ExternalLink size={10} className="shrink-0" />
                              {url}
                            </a>
                          ))}
                        {(cluster.topUrlsSample || cluster.urls).length > 5 && (
                          <span className="text-xs text-slate-400 italic pl-5">
                            ... y {(cluster.topUrlsSample || cluster.urls).length - 5} más
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer / Actions */}
                  {/* Could add specific export button for this cluster here if needed */}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
