import React, { useEffect, useState } from 'react';
import { AlertTriangle, DollarSign, Check } from 'lucide-react';
import { SeoChecklistSettings, Capabilities } from '../../types/seoChecklist';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedCount: number;
  settings: SeoChecklistSettings;
  capabilities: Capabilities | null;
  analysisMode: 'basic' | 'advanced';
}

const COST_PER_PROVIDER_FALLBACK: Record<string, number> = {
  serpapi: 0.01,
  dataforseo: 0.002,
  internal: 0,
};

export const BatchAnalysisConfirmationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  settings,
  capabilities,
  analysisMode,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const { serp, budgets } = settings;
  const isAdvancedMode = analysisMode === 'advanced';

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setConfirmed(false);
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [isOpen]);

  if (!isOpen) return null;
  const estimatedKeywords = selectedCount * serp.maxKeywordsPerUrl;

  let costPerKeyword = 0;
  let providerAvailable = true;

  if (isAdvancedMode) {
    if (capabilities) {
      if (!capabilities.serpProviders[serp.provider]) {
        providerAvailable = false;
      }

      if (capabilities.costModel[serp.provider]) {
        costPerKeyword = capabilities.costModel[serp.provider].estimatedCostPerQuery;
      } else {
        costPerKeyword = COST_PER_PROVIDER_FALLBACK[serp.provider] || 0;
      }
    } else {
      costPerKeyword = COST_PER_PROVIDER_FALLBACK[serp.provider] || 0;
    }
  }

  const estimatedCost = estimatedKeywords * costPerKeyword;
  const isOverBudget = isAdvancedMode && estimatedCost > budgets.maxEstimatedCostPerBatch;
  const isOverDaily = isAdvancedMode && estimatedCost > budgets.dailyBudget;
  const needsConfirmation = isAdvancedMode && providerAvailable && !isOverBudget && !isOverDaily;
  const isConfirmDisabled =
    (needsConfirmation && !confirmed) || isOverBudget || isOverDaily || (isAdvancedMode && !providerAvailable);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="text-emerald-500" />
            Confirmar Análisis en Lote
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span>URLs seleccionadas:</span>
              <span className="font-medium">{selectedCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Keywords estimadas:</span>
              <span className="font-medium">{estimatedKeywords}</span>
            </div>
            {!isAdvancedMode ? (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 font-medium">
                Análisis básico sin coste SERP
              </div>
            ) : (
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-slate-100 dark:border-slate-800">
                <span>Coste Estimado:</span>
                <span
                  className={
                    estimatedCost > budgets.maxEstimatedCostPerBatch
                      ? 'text-red-500'
                      : 'text-emerald-500'
                  }
                >
                  €{estimatedCost.toFixed(3)}
                </span>
              </div>
            )}
          </div>

          {isAdvancedMode && !providerAvailable && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-xl text-sm flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Proveedor No Disponible</p>
                <p>
                  El proveedor seleccionado ({serp.provider}) no está disponible en este momento.
                </p>
              </div>
            </div>
          )}

          {isAdvancedMode && providerAvailable && (isOverBudget || isOverDaily) && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-xl text-sm flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Presupuesto Excedido</p>
                <p>
                  {isOverBudget
                    ? `El coste estimado supera el límite por lote (€${budgets.maxEstimatedCostPerBatch}).`
                    : `El coste estimado supera el presupuesto diario (€${budgets.dailyBudget}).`}
                </p>
                <p className="mt-2 text-xs opacity-80">
                  Por favor, reduce el número de URLs o ajusta los límites en Configuración.
                </p>
              </div>
            </div>
          )}

          {needsConfirmation && (
            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Confirmo ejecutar el análisis con un coste estimado de{' '}
                <strong>€{estimatedCost.toFixed(3)}</strong>.
              </span>
            </label>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
          {needsConfirmation && !confirmed && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400 text-right">
              Marca la confirmación para continuar
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirmDisabled}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check size={18} />
              Ejecutar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
