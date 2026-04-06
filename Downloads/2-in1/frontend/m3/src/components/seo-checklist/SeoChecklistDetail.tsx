import React, { useState } from 'react';
import {
  SeoPage,
  CHECKLIST_POINTS,
  ChecklistKey,
  ChecklistItem as IChecklistItem,
} from '../../types/seoChecklist';
import { ChecklistItem } from './ChecklistItem';
import { runPageAnalysis } from '../../utils/seoUtils';
import { normalizeSeoUrl } from '../../utils/seoUrlNormalizer';
import { isBrandTermMatch } from '../../utils/brandTerms';
import { useSeoChecklistSettings } from '../../hooks/useSeoChecklistSettings';
import { validateChecklistWithAI, SeoChecklistAiSummary } from '../../services/seoChecklistAIValidator';
import {
  Play,
  Loader2,
  ArrowLeft,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Server,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  page: SeoPage;
  onUpdatePage: (id: string, updates: Partial<SeoPage>) => void;
  onUpdateChecklistItem: (
    pageId: string,
    key: ChecklistKey,
    updates: Partial<IChecklistItem>,
  ) => void;
  onBack: () => void;
}

export const SeoChecklistDetail: React.FC<Props> = ({
  page,
  onUpdatePage,
  onUpdateChecklistItem,
  onBack,
}) => {
  const { settings } = useSeoChecklistSettings();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAiValidating, setIsAiValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'completed' | 'error'>('idle');
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<SeoChecklistAiSummary | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    url: page.url,
    kwPrincipal: page.kwPrincipal,
    isBrandKeyword: page.isBrandKeyword || false,
    pageType: page.pageType,
    cluster: page.cluster || '',
    competitors: page.competitors || [],
  });

  const [newCompetitor, setNewCompetitor] = useState('');

  const handleEdit = () => {
    setEditForm({
      url: page.url,
      kwPrincipal: page.kwPrincipal,
      isBrandKeyword: page.isBrandKeyword || false,
      pageType: page.pageType,
      cluster: page.cluster || '',
      competitors: page.competitors || [],
    });
    setNewCompetitor('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    const matchesBrandTerm = isBrandTermMatch(editForm.kwPrincipal, settings.brandTerms);
    const isBrandKeyword = matchesBrandTerm ? true : editForm.isBrandKeyword;

    onUpdatePage(page.id, {
      url: normalizeSeoUrl(editForm.url),
      kwPrincipal: isBrandKeyword ? '' : editForm.kwPrincipal,
      isBrandKeyword,
      pageType: editForm.pageType,
      cluster: editForm.cluster,
      competitors: editForm.competitors,
    });
    setIsEditing(false);
  };

  const addCompetitor = () => {
    if (newCompetitor.trim()) {
      setEditForm((prev) => ({
        ...prev,
        competitors: [...(prev.competitors || []), newCompetitor.trim()],
      }));
      setNewCompetitor('');
    }
  };

  const removeCompetitor = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      competitors: (prev.competitors || []).filter((_, i) => i !== index),
    }));
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const analysisConfig = {
        mode: settings.serp.enabled ? 'advanced' : 'basic',
        serp: {
          ...settings.serp,
          confirmed: settings.serp.enabled,
        },
        budgets: settings.budgets,
      };

      const updates = await runPageAnalysis(page, analysisConfig, settings);
      onUpdatePage(page.id, updates);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el motor de análisis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleValidateWithAI = async () => {
    setIsAiValidating(true);
    setAiStatus('analyzing');
    setAiFeedback('Analizando…');
    setAiSummary(null);

    try {
      const summary = await validateChecklistWithAI(page);
      summary.updatedChecks.forEach((item) => {
        onUpdateChecklistItem(page.id, item.key, {
          status_manual: item.status,
          notes_manual: item.notes,
          evaluationMeta: item.evaluationMeta,
        });
      });
      setAiSummary(summary);
      setAiStatus('completed');
      setAiFeedback(`Completado: ${summary.updatedChecks.length} checks actualizados (${summary.heuristicResolvedChecks.length} heurística, ${summary.attempted} IA).`);
    } catch (err: any) {
      setAiStatus('error');
      setAiFeedback(err.message || 'Error validando con IA.');
    } finally {
      setIsAiValidating(false);
    }
  };

  const calculateStatusMetrics = () => {
    const items = Object.values(page.checklist) as IChecklistItem[];
    const siCount = items.filter((i) => i.status_manual === 'SI').length;
    const siIaCount = items.filter((i) => i.status_manual === 'SI_IA').length;
    const progress = Math.round((siCount / items.length) * 100);
    return { progress, siIaCount };
  };
  const statusMetrics = calculateStatusMetrics();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 overflow-hidden">
          {isEditing ? (
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase">URL</label>
                <input
                  type="text"
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 font-semibold uppercase">Keyword</label>
                  <input
                    type="text"
                    value={editForm.kwPrincipal}
                    onChange={(e) => setEditForm({ ...editForm, kwPrincipal: e.target.value })}
                    disabled={editForm.isBrandKeyword}
                    placeholder={
                      editForm.isBrandKeyword ? 'Sin keyword principal por tratarse de marca' : ''
                    }
                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={editForm.isBrandKeyword}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          isBrandKeyword: e.target.checked,
                          kwPrincipal: e.target.checked ? '' : prev.kwPrincipal,
                        }))
                      }
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    Excluir asignación de KW principal porque es una keyword de marca
                  </label>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 font-semibold uppercase">Tipo</label>
                  <input
                    type="text"
                    value={editForm.pageType}
                    onChange={(e) => setEditForm({ ...editForm, pageType: e.target.value })}
                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 font-semibold uppercase">Cluster</label>
                  <input
                    type="text"
                    value={editForm.cluster}
                    onChange={(e) => setEditForm({ ...editForm, cluster: e.target.value })}
                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-2">
                  Competidores Manuales
                </label>
                <div className="space-y-2">
                  {editForm.competitors &&
                    editForm.competitors.map((comp, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={comp}
                          readOnly
                          className="flex-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 text-sm text-slate-600 dark:text-slate-400"
                        />
                        <button
                          onClick={() => removeCompetitor(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCompetitor}
                      onChange={(e) => setNewCompetitor(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                      placeholder="https://competidor.com"
                      className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={addCompetitor}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                      title="Añadir"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleCancel}
                  className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  title="Cancelar"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleSave}
                  className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  title="Guardar cambios"
                >
                  <Check size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative pr-8">
              <h1
                className="text-xl font-bold text-slate-900 dark:text-white truncate"
                title={page.url}
              >
                {page.url}
              </h1>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-bold">
                  {page.isBrandKeyword
                    ? 'KW de marca'
                    : page.kwPrincipal || 'Sin keyword principal'}
                </span>
                <span>{page.pageType}</span>
                {page.cluster && <span>• {page.cluster}</span>}
                <span>• Clics GSC: {page.gscMetrics?.clicks?.toLocaleString('es-ES') || 0}</span>
                <span>
                  • Impresiones GSC: {page.gscMetrics?.impressions?.toLocaleString('es-ES') || 0}
                </span>
              </div>
              <button
                onClick={handleEdit}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Editar detalles"
              >
                <Pencil size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Progreso
            </div>
            <div className="font-mono font-bold text-lg text-slate-700 dark:text-slate-200">
              {statusMetrics.progress}%
            </div>
            <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold">
              SI (IA): {statusMetrics.siIaCount}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
            <span className="hidden sm:inline">Analizar con Motor</span>
          </button>
          <button
            onClick={handleValidateWithAI}
            disabled={isAiValidating}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isAiValidating ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
            <span className="hidden sm:inline">Validar con IA</span>
          </button>
        </div>
      </div>

      {aiFeedback && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium ${
            aiStatus === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300'
              : aiStatus === 'completed'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300'
          }`}
        >
          {aiFeedback}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {aiSummary && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm space-y-2">
          <div className="font-bold text-slate-700 dark:text-slate-200">Resumen validación IA</div>
          <div className="text-slate-600 dark:text-slate-300">
            Checks actualizados: <strong>{aiSummary.updatedChecks.length}</strong> · Resueltos por
            heurística: <strong>{aiSummary.heuristicResolvedChecks.length}</strong> · Pendientes de IA:
            <strong>{aiSummary.pendingForAiChecks.length}</strong> · Omitidos por estar en SI:{' '}
            <strong>{aiSummary.omittedBySi}</strong>
          </div>
          {aiSummary.detectedErrors.length > 0 && (
            <ul className="list-disc pl-5 text-red-600 dark:text-red-300">
              {aiSummary.detectedErrors.map((errorMessage, index) => (
                <li key={`${errorMessage}-${index}`}>{errorMessage}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Engine Metadata Block */}
      {page.engineMeta && (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-sm">
          <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
            <Server size={14} />
            Motor de Análisis
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">
                Provider Solicitado
              </div>
              <div className="font-mono text-slate-700 dark:text-slate-300">
                {page.engineMeta.requestedProvider}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Provider Usado</div>
              <div
                className={`font-mono font-bold ${page.engineMeta.usedProvider === page.engineMeta.requestedProvider ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
              >
                {page.engineMeta.usedProvider}
              </div>
            </div>
          </div>

          {page.engineMeta.fallbackChain && page.engineMeta.fallbackChain.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Fallback Chain</div>
              <div className="flex items-center gap-2 flex-wrap">
                {page.engineMeta.fallbackChain.map((p, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 font-mono"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {page.engineMeta.providerFailureReasons &&
            Object.keys(page.engineMeta.providerFailureReasons).length > 0 && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs uppercase mb-2">
                  <AlertTriangle size={12} />
                  Fallos de Provider
                </div>
                <div className="space-y-1">
                  {Object.entries(page.engineMeta.providerFailureReasons).map(
                    ([provider, reason], i) => (
                      <div key={i} className="text-xs">
                        <span className="font-bold text-red-700 dark:text-red-300">
                          {provider}:
                        </span>{' '}
                        <span className="text-red-600/80 dark:text-red-400/80">{reason}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
        </div>
      )}

      <div className="space-y-3">
        {CHECKLIST_POINTS.map((point) => (
          <ChecklistItem
            key={point.key}
            item={page.checklist[point.key]}
            onChange={(updates) => onUpdateChecklistItem(page.id, point.key, updates)}
          />
        ))}
      </div>
    </div>
  );
};
