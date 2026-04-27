import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  SeoPage,
  ChecklistItem,
  CHECKLIST_POINTS,
  Capabilities,
  AnalysisConfigPayload,
} from '../../types/seoChecklist';
import {
  Trash2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Search,
  Download,
  Play,
  Layers,
  Loader2,
  Settings,
  Zap,
  AlertTriangle,
  Server,
} from 'lucide-react';
import { runPageAnalysis } from '../../utils/seoUtils';
import { useSeoChecklistSettings } from '../../hooks/useSeoChecklistSettings';
import { SeoChecklistSettingsModal } from './SeoChecklistSettingsModal';
import { BatchAnalysisConfirmationModal } from './BatchAnalysisConfirmationModal';
import { runBatchWithConcurrency, BatchProgress } from '../../utils/batchProcessor';
import { useProject } from '../../context/ProjectContext';
import { validateChecklistWithAI } from '../../services/seoChecklistAIValidator';

interface Props {
  pages: SeoPage[];
  onSelect: (page: SeoPage) => void;
  onDelete: (id: string) => void;
  onBulkUpdate: (updates: { id: string; changes: Partial<SeoPage> }[]) => void;
  onBulkDelete: (ids: string[]) => void;
  capabilities: Capabilities | null;
  onRunBatch?: (pages: SeoPage[], config: AnalysisConfigPayload) => void;
  allowKwAutoSelectInBasic: boolean;
  onAllowKwAutoSelectInBasicChange: (enabled: boolean) => void;
}

export const SeoUrlList: React.FC<Props> = ({
  pages,
  onSelect,
  onDelete,
  onBulkUpdate,
  onBulkDelete,
  capabilities,
  onRunBatch,
  allowKwAutoSelectInBasic,
  onAllowKwAutoSelectInBasicChange,
}) => {
  const MAX_URLS_PER_BATCH = 1000;
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { settings, updateSettings } = useSeoChecklistSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'basic' | 'advanced'>('basic');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [bulkAiState, setBulkAiState] = useState<'idle' | 'analyzing' | 'completed' | 'error'>('idle');
  const [bulkAiMessage, setBulkAiMessage] = useState<string | null>(null);
  const [bulkAiSummary, setBulkAiSummary] = useState<{
    updated: number;
    omittedSi: number;
    errors: string[];
  } | null>(null);
  const { currentClient } = useProject();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredPages = pages.filter(
    (p) =>
      p.url.toLowerCase().includes(filter.toLowerCase()) ||
      p.kwPrincipal.toLowerCase().includes(filter.toLowerCase()) ||
      (p.cluster && p.cluster.toLowerCase().includes(filter.toLowerCase())),
  );

  const totalPages = Math.ceil(filteredPages.length / itemsPerPage);

  const aggregatedMetrics = useMemo(() => {
    return filteredPages.reduce(
      (acc, page) => {
        acc.clicks += page.gscMetrics?.clicks || 0;
        acc.impressions += page.gscMetrics?.impressions || 0;
        return acc;
      },
      { clicks: 0, impressions: 0 },
    );
  }, [filteredPages]);

  const hasClusterOnlyFilter = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    if (!normalizedFilter) return false;
    return (
      filteredPages.length > 0 &&
      filteredPages.every((page) => (page.cluster || '').toLowerCase().includes(normalizedFilter))
    );
  }, [filter, filteredPages]);
  const displayedPages = filteredPages.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleFilterChange = (val: string) => {
    setFilter(val);
    setCurrentPage(1);
  };

  const calculateStatusMetrics = (page: SeoPage) => {
    const items = Object.values(page.checklist) as ChecklistItem[];
    const siCount = items.filter((i) => i.status_manual === 'SI').length;
    const siIaCount = items.filter((i) => i.status_manual === 'SI_IA').length;
    const progress = Math.round((siCount / items.length) * 100);
    return { progress, siIaCount };
  };

  const handleExport = () => {
    // Tab 1: Resumen
    const summaryHeaders = [
      'URL',
      'Keyword',
      'Tipo',
      'Cluster',
      ...CHECKLIST_POINTS.map((p) => p.label),
    ];
    const exportPages = pages;

    const summaryData = exportPages.map((p) => [
      p.url,
      p.kwPrincipal,
      p.pageType,
      p.cluster || '',
      ...CHECKLIST_POINTS.map((point) => p.checklist[point.key]?.status_manual || 'NA'),
    ]);

    const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryData]);

    // Tab 2: Detalle Completo
    const detailHeaders = ['URL', 'Keyword', 'Tipo', 'Cluster'];
    CHECKLIST_POINTS.forEach((p) => {
      detailHeaders.push(`${p.label} - Estado`);
      detailHeaders.push(`${p.label} - Notas`);
      detailHeaders.push(`${p.label} - Auto`);
    });

    const detailData = exportPages.map((p) => {
      const row = [p.url, p.kwPrincipal, p.pageType, p.cluster || ''];
      CHECKLIST_POINTS.forEach((point) => {
        const item = p.checklist[point.key];
        row.push(item?.status_manual || 'NA');
        row.push(item?.notes_manual || '');
        row.push(item?.autoData ? JSON.stringify(item.autoData) : '');
      });
      return row;
    });

    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailData]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Estado');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle Completo');

    // Tab 3: Clusterización (Intenciones)
    const clusterHeaders = [
      'Cliente',
      'Proyecto',
      'URL',
      'KW Objetivo (PADRE)',
      'RunId',
      'Total Clusters',
      'Owned Clusters',
      'Opportunity Clusters',
      'Cluster ID',
      'Rol',
      'Keyword',
      'Intención',
      'Cobertura',
      'URLs SERP',
    ];

    const clusterRows: any[][] = [];

    exportPages.forEach((p) => {
      const item = p.checklist.OPORTUNIDADES;
      if (item?.autoData?.clusters && Array.isArray(item.autoData.clusters)) {
        const { summary, clusters } = item.autoData;

        clusters.forEach((cluster: any) => {
          // Parent Row (KW Objetivo)
          clusterRows.push([
            currentClient?.name || '',
            currentClient?.name || '',
            p.url,
            cluster.kwObjetivo,
            cluster.runId || '',
            summary?.totalClusters || '',
            summary?.ownedClusters || '',
            summary?.opportunityClusters || '',
            cluster.clusterId,
            'PADRE',
            cluster.kwObjetivo,
            cluster.intent || '',
            cluster.coverage || 'OPPORTUNITY',
                (cluster.topUrlsSample || cluster.urls || []).join('\n'),
          ]);

          // Variations
          if (cluster.variations && Array.isArray(cluster.variations)) {
            cluster.variations.forEach((v: any) => {
              const kw = typeof v === 'string' ? v : v.keyword;
              clusterRows.push([
                currentClient?.name || '',
                currentClient?.name || '',
                p.url,
                cluster.kwObjetivo,
                cluster.runId || '',
                summary?.totalClusters || '',
                summary?.ownedClusters || '',
                summary?.opportunityClusters || '',
                cluster.clusterId,
                'VARIACIÓN',
                kw,
                cluster.intent || '',
                cluster.coverage || 'OPPORTUNITY',
                '', // URLs usually on parent
              ]);
            });
          }
        });
      }
    });

    if (clusterRows.length > 0) {
      const wsClusters = XLSX.utils.aoa_to_sheet([clusterHeaders, ...clusterRows]);
      XLSX.utils.book_append_sheet(wb, wsClusters, 'Clusterización (Intenciones)');
    } else {
      // Create empty sheet with headers if no data
      const wsClusters = XLSX.utils.aoa_to_sheet([clusterHeaders]);
      XLSX.utils.book_append_sheet(wb, wsClusters, 'Clusterización (Intenciones)');
    }

    XLSX.writeFile(wb, `SEO_Checklist_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const buildAnalysisConfig = (): AnalysisConfigPayload => {
    const currentLimits = {
      maxKeywordsPerUrl: Math.min(
        settings.serp.maxKeywordsPerUrl,
        capabilities?.limits.maxKeywordsPerUrl ?? Infinity,
      ),
      maxCompetitorsPerKeyword: Math.min(
        settings.serp.maxCompetitorsPerKeyword,
        capabilities?.limits.maxCompetitorsPerKeyword ?? Infinity,
      ),
    };

    return {
      mode: analysisMode,
      serp: {
        ...settings.serp,
        ...currentLimits,
        confirmed: analysisMode === 'advanced',
      },
      budgets: settings.budgets,
    };
  };

  // Selection Logic
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPages.length && filteredPages.length > 0) {
      setSelectedIds(new Set());
    } else {
      const nextSelected = filteredPages.slice(0, MAX_URLS_PER_BATCH).map((p) => p.id);
      if (filteredPages.length > MAX_URLS_PER_BATCH) {
        window.alert(
          `Solo puedes analizar hasta ${MAX_URLS_PER_BATCH} URLs por ejecución. Se seleccionaron las primeras ${MAX_URLS_PER_BATCH}.`,
        );
      }
      setSelectedIds(new Set(nextSelected));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk Actions
  const getPagesToAnalyze = (idsToAnalyze: Set<string>) => {
    const selectedPages = pages.filter((p) => idsToAnalyze.has(p.id));
    if (selectedPages.length <= MAX_URLS_PER_BATCH) {
      return selectedPages;
    }

    window.alert(
      `Seleccionaste ${selectedPages.length} URLs. Solo se enviarán las primeras ${MAX_URLS_PER_BATCH}.`,
    );
    return selectedPages.slice(0, MAX_URLS_PER_BATCH);
  };

  const executeBatch = async (forcedIds?: Set<string>) => {
    setIsConfirmModalOpen(false);
    setIsAnalyzing(true);
    setBatchProgress(null);

    const idsToAnalyze = forcedIds ?? selectedIds;
    const pagesToAnalyze = getPagesToAnalyze(idsToAnalyze);

    // Default concurrency or derived from somewhere? Using 3 as safe default
    const concurrency = 3;

    const analysisConfig = buildAnalysisConfig();

    try {
      await runBatchWithConcurrency(
        pagesToAnalyze,
        async (page) => {
          const effectiveSettings =
            analysisMode === 'basic'
              ? { ...settings, allowKwPrincipalUpdate: allowKwAutoSelectInBasic }
              : settings;
          const update = await runPageAnalysis(page, analysisConfig, effectiveSettings);
          onBulkUpdate([{ id: page.id, changes: update }]);
          return update;
        },
        concurrency,
        (progress) => setBatchProgress(progress),
        // Cost estimator for batch processor (optional, heuristic)
        () => {
          if (settings.serp.enabled && analysisMode === 'advanced') {
            let cost = 0;
            if (
              capabilities &&
              capabilities.costModel &&
              capabilities.costModel[settings.serp.provider]
            ) {
              cost = capabilities.costModel[settings.serp.provider].estimatedCostPerQuery;
            } else {
              // Fallback
              cost = settings.serp.provider === 'dataforseo' ? 0.002 : 0.01;
            }
            return settings.serp.maxKeywordsPerUrl * cost;
          }
          return 0;
        },
      );
    } catch (e) {
      console.error('Batch execution error', e);
    } finally {
      setIsAnalyzing(false);
      setBatchProgress(null);
      setSelectedIds(new Set());
    }
  };

  const handleServerBatch = (forcedIds?: Set<string>) => {
    if (!onRunBatch) return false;
    const idsToAnalyze = forcedIds ?? selectedIds;
    if (idsToAnalyze.size === 0) return false;

    const pagesToAnalyze = getPagesToAnalyze(idsToAnalyze);
    const analysisConfig = buildAnalysisConfig();

    onRunBatch(pagesToAnalyze, analysisConfig);
    setIsConfirmModalOpen(false);
    setSelectedIds(new Set());
    return true;
  };

  const runPreferredBatch = (forcedIds?: Set<string>) => {
    const handledByServer = handleServerBatch(forcedIds);
    if (!handledByServer) {
      executeBatch(forcedIds);
    }
  };

  const handleBulkAnalyze = () => {
    if (selectedIds.size === 0) return;

    if (analysisMode === 'advanced') {
      setIsConfirmModalOpen(true);
    } else {
      runPreferredBatch();
    }
  };

  const handleAnalyzeAll = () => {
    if (filteredPages.length === 0) return;
    const limitedPages = filteredPages.slice(0, MAX_URLS_PER_BATCH);
    if (filteredPages.length > MAX_URLS_PER_BATCH) {
      window.alert(
        `Solo puedes analizar hasta ${MAX_URLS_PER_BATCH} URLs por ejecución. Se usarán las primeras ${MAX_URLS_PER_BATCH}.`,
      );
    }
    const allIds = new Set(limitedPages.map((p) => p.id));
    setSelectedIds(allIds);

    if (analysisMode === 'basic') {
      runPreferredBatch(allIds);
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleBulkCluster = () => {
    const cluster = prompt('Ingrese el nombre del Cluster para las URLs seleccionadas:');
    if (cluster === null) return;

    const updates = Array.from(selectedIds).map((id) => ({
      id,
      changes: { cluster },
    }));
    onBulkUpdate(updates);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`¿Estás seguro de eliminar ${selectedIds.size} URLs?`)) return;
    onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkValidateWithAI = async () => {
    if (selectedIds.size === 0) return;
    setBulkAiState('analyzing');
    setBulkAiMessage('Analizando…');
    setBulkAiSummary(null);

    let updated = 0;
    let omittedSi = 0;
    const errors: string[] = [];

    try {
      const selectedPages = pages.filter((page) => selectedIds.has(page.id));
      for (const page of selectedPages) {
        const summary = await validateChecklistWithAI(page);
        omittedSi += summary.omittedBySi;
        updated += summary.updatedChecks.length;
        if (summary.detectedErrors.length > 0) {
          errors.push(...summary.detectedErrors.map((msg) => `${page.url}: ${msg}`));
        }

        if (summary.updatedChecks.length > 0) {
          const pageChecklist = { ...page.checklist };
          summary.updatedChecks.forEach((item) => {
            pageChecklist[item.key] = {
              ...pageChecklist[item.key],
              status_manual: item.status,
              notes_manual: item.notes,
              evaluationMeta: item.evaluationMeta,
            };
          });
          onBulkUpdate([{ id: page.id, changes: { checklist: pageChecklist, lastAnalyzedAt: Date.now() } }]);
        }
      }

      setBulkAiSummary({ updated, omittedSi, errors });
      setBulkAiState('completed');
      setBulkAiMessage(`Completado: ${updated} checks actualizados.`);
    } catch (error: any) {
      setBulkAiState('error');
      setBulkAiMessage(error?.message || 'Error en validación masiva con IA.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Filtrar por URL, Keyword o Cluster..."
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          />
        </div>
        <button
          onClick={handleAnalyzeAll}
          disabled={isAnalyzing || filteredPages.length === 0}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all shrink-0"
        >
          {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
          <span className="hidden sm:inline">
            {onRunBatch
              ? `Analizar Todo en servidor (${filteredPages.length})`
              : `Analizar Todo (${filteredPages.length})`}
          </span>
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-medium transition-all shrink-0"
        >
          <Settings size={18} />
          <span className="hidden sm:inline">Configuración</span>
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all shrink-0"
        >
          <Download size={18} />
          <span className="hidden sm:inline">Exportar Excel</span>
        </button>
      </div>

      <SeoChecklistSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={updateSettings}
        capabilities={capabilities}
      />

      <BatchAnalysisConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={runPreferredBatch}
        selectedCount={selectedIds.size}
        settings={settings}
        capabilities={capabilities}
        analysisMode={analysisMode}
      />

      {isAnalyzing && batchProgress && (
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl animate-in fade-in">
          <div className="flex justify-between text-sm mb-2 text-slate-600 dark:text-slate-300">
            <span className="font-bold flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} />
              Analizando URLs...
            </span>
            <span className="font-mono">
              {batchProgress.processed} / {batchProgress.total}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(batchProgress.processed / batchProgress.total) * 100}%` }}
            ></div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="text-emerald-600 font-medium">
              Completados: {batchProgress.succeeded}
            </span>
            {batchProgress.failed > 0 && (
              <span className="text-red-500 font-medium">Errores: {batchProgress.failed}</span>
            )}
            {analysisMode === 'advanced' && (
              <span>Coste est: €{batchProgress.estimatedCost.toFixed(3)}</span>
            )}
          </div>
        </div>
      )}

      {bulkAiMessage && (
        <div
          className={`border px-4 py-3 rounded-xl text-sm font-medium ${
            bulkAiState === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-300'
              : bulkAiState === 'completed'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300'
          }`}
        >
          {bulkAiMessage}
        </div>
      )}

      {bulkAiSummary && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm">
          <div>
            Checks actualizados: <strong>{bulkAiSummary.updated}</strong> · Omitidos por SI:{' '}
            <strong>{bulkAiSummary.omittedSi}</strong>
          </div>
          {bulkAiSummary.errors.length > 0 && (
            <ul className="list-disc pl-5 mt-2 text-red-600 dark:text-red-300">
              {bulkAiSummary.errors.map((message, index) => (
                <li key={`${message}-${index}`}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="text-sm text-blue-800 dark:text-blue-200 font-medium">
            {selectedIds.size} URLs seleccionadas
          </div>

          <div className="flex items-center gap-2">
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value as 'basic' | 'advanced')}
              className="px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="basic">Modo Básico (Rápido)</option>
              <option value="advanced">Modo Avanzado (SERP + IA)</option>
            </select>

            {analysisMode === 'basic' && (
              <label className="flex items-center gap-2 px-2 py-1 text-xs text-blue-900 dark:text-blue-200 bg-white/70 dark:bg-slate-900/60 border border-blue-200 dark:border-blue-800 rounded-lg">
                <input
                  type="checkbox"
                  checked={allowKwAutoSelectInBasic}
                  onChange={(event) => onAllowKwAutoSelectInBasicChange(event.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Autoasignar KW principal si GSC sugiere una mejor
              </label>
            )}

            <button
              onClick={handleBulkAnalyze}
              disabled={isAnalyzing}
              className={`flex items-center gap-2 px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${
                analysisMode === 'advanced'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
              {analysisMode === 'advanced'
                ? onRunBatch
                  ? 'Analizar (Avanzado · Servidor)'
                  : 'Analizar (Avanzado)'
                : onRunBatch
                  ? 'Analizar (Servidor)'
                  : 'Analizar'}
            </button>

            {onRunBatch && (
              <button
                onClick={handleServerBatch}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                <Server size={14} />
                Enviar al servidor (BatchJobMonitor)
              </button>
            )}

            <button
              onClick={handleBulkValidateWithAI}
              disabled={isAnalyzing || bulkAiState === 'analyzing'}
              className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {bulkAiState === 'analyzing' ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Zap size={14} />
              )}
              Validar con IA
            </button>

            <button
              onClick={handleBulkCluster}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors"
            >
              <Layers size={14} />
              Asignar Cluster
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 text-xs font-bold rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          </div>
        </div>
      )}

      {(aggregatedMetrics.clicks > 0 || aggregatedMetrics.impressions > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Clics GSC {hasClusterOnlyFilter ? 'del cluster filtrado' : 'de URLs filtradas'}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {aggregatedMetrics.clicks.toLocaleString('es-ES')}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Impresiones GSC {hasClusterOnlyFilter ? 'del cluster filtrado' : 'de URLs filtradas'}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {aggregatedMetrics.impressions.toLocaleString('es-ES')}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-xs">
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredPages.length && filteredPages.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4">URL</th>
                <th className="px-6 py-4">Keyword</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-right">Clics GSC</th>
                <th className="px-6 py-4 text-right">Impresiones GSC</th>
                <th className="px-6 py-4 text-center">Progreso</th>
                <th className="px-6 py-4 text-right">Último Análisis</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedPages.map((page) => {
                const statusMetrics = calculateStatusMetrics(page);
                return (
                  <tr
                    key={page.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${
                      selectedIds.has(page.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(page.id)}
                        onChange={() => toggleSelect(page.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 font-medium max-w-[300px] truncate" title={page.url}>
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => onSelect(page)}
                          className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                        >
                          {page.url}
                        </span>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      {page.cluster && (
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Layers size={10} />
                          {page.cluster}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {page.kwPrincipal}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">
                        {page.pageType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {(page.gscMetrics?.clicks || 0).toLocaleString('es-ES')}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {(page.gscMetrics?.impressions || 0).toLocaleString('es-ES')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${statusMetrics.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono">{statusMetrics.progress}%</span>
                        {statusMetrics.siIaCount > 0 && (
                          <span
                            className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400"
                            title="Estados Si (IA) no incluidos en progreso"
                          >
                            IA: {statusMetrics.siIaCount}
                          </span>
                        )}
                        {page.advancedBlockedReason && (
                          <div
                            title={`Análisis avanzado bloqueado: ${page.advancedBlockedReason}`}
                            className="text-amber-500 cursor-help"
                          >
                            <AlertTriangle size={14} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-slate-400">
                      {page.lastAnalyzedAt
                        ? new Date(page.lastAnalyzedAt).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onDelete(page.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          onClick={() => onSelect(page)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPages.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    {filter
                      ? 'No se encontraron URLs'
                      : 'No hay URLs en la lista. Importa algunas para empezar.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        {filteredPages.length > itemsPerPage && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Showing {displayedPages.length} of {filteredPages.length} pages
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center px-2 text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
