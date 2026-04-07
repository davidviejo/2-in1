import React, { useEffect, useState } from 'react';
import { X, Settings, Database, DollarSign, Target, Shield, AlertTriangle } from 'lucide-react';
import { SeoChecklistSettings, Capabilities } from '../../types/seoChecklist';
import { parseBrandTerms } from '../../utils/brandTerms';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: SeoChecklistSettings;
  onSave: (settings: SeoChecklistSettings) => void;
  capabilities: Capabilities | null;
}

export const SeoChecklistSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  capabilities,
}) => {
  const [formData, setFormData] = useState<SeoChecklistSettings>(settings);
  const [brandTermsText, setBrandTermsText] = useState((settings.brandTerms || []).join('\n'));

  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
      setBrandTermsText((settings.brandTerms || []).join('\n'));
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleChange = (section: keyof SeoChecklistSettings, key: string, value: any) => {
    setFormData((prev) => {
      const base = prev;
      if (section === 'competitorsMode') {
        return { ...base, competitorsMode: value };
      }
      return {
        ...base,
        [section]: {
          ...base[section as 'serp' | 'budgets'],
          [key]: value,
        },
      };
    });
  };

  const handleSave = () => {
    onSave({
      ...formData,
      brandTerms: parseBrandTerms(brandTermsText),
    });
    onClose();
  };

  const isUsingGlobalDataforseo = formData.serp.useGlobalDataforseo !== false;
  const effectiveDataforseoLogin = formData.serp.dataforseoLogin?.trim() || '';
  const effectiveDataforseoPassword = formData.serp.dataforseoPassword?.trim() || '';
  const hasEffectiveDataforseoCredentials = Boolean(
    effectiveDataforseoLogin && effectiveDataforseoPassword,
  );
  const isDataforseoAvailable = Boolean(
    capabilities?.serpProviders['dataforseo'] || hasEffectiveDataforseoCredentials,
  );
  const maskCredential = (value: string) => {
    if (!value) return '••••••';
    if (value.length <= 4) return '••••';
    return `${value.slice(0, 2)}${'•'.repeat(Math.max(2, value.length - 4))}${value.slice(-2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Configuración Análisis SEO
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ajusta los límites y proveedores de datos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* SERP Configuration */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-lg pb-2 border-b border-slate-100 dark:border-slate-800">
              <Database size={20} className="text-blue-500" />
              <h3>SERP API & Proveedores</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Habilitar SERP API
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.serp.enabled}
                      onChange={(e) => handleChange('serp', 'enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Proveedor
                  </label>
                  <select
                    value={formData.serp.provider}
                    onChange={(e) => handleChange('serp', 'provider', e.target.value)}
                    disabled={!formData.serp.enabled}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option
                      value="dataforseo"
                      disabled={Boolean(capabilities && !isDataforseoAvailable)}
                    >
                      DataForSEO (Predeterminado){' '}
                      {capabilities && !isDataforseoAvailable
                        ? '(No disponible)'
                        : ''}
                    </option>
                    <option
                      value="serpapi"
                      disabled={capabilities && !capabilities.serpProviders['serpapi']}
                    >
                      SerpApi{' '}
                      {capabilities && !capabilities.serpProviders['serpapi']
                        ? '(No disponible)'
                        : ''}
                    </option>
                    <option
                      value="internal"
                      disabled={capabilities && !capabilities.serpProviders['internal']}
                    >
                      Internal Proxy{' '}
                      {capabilities && !capabilities.serpProviders['internal']
                        ? '(No disponible)'
                        : ''}
                    </option>
                  </select>
                  {formData.serp.provider === 'dataforseo' &&
                    capabilities &&
                    !isDataforseoAvailable && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        DataForSEO no está disponible con la configuración actual.{' '}
                        {isUsingGlobalDataforseo
                          ? 'Activa la sobrescritura del proyecto o configura credenciales globales.'
                          : 'Completa login y password del proyecto para habilitarlo.'}
                      </p>
                    )}
                </div>

                {formData.serp.provider === 'dataforseo' && (
                  <div className="space-y-4 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between bg-white/70 dark:bg-slate-900/40 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Prioridad actual:{' '}
                          <span className="font-bold text-blue-700 dark:text-blue-300">
                            {isUsingGlobalDataforseo ? 'Global' : 'Proyecto'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {isUsingGlobalDataforseo
                            ? 'Se aplican las credenciales de Ajustes globales.'
                            : 'Se aplican credenciales locales de este proyecto.'}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={!isUsingGlobalDataforseo}
                          onChange={(e) =>
                            handleChange('serp', 'useGlobalDataforseo', !e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div className="space-y-2 bg-white/70 dark:bg-slate-900/40 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Usar credenciales globales de Ajustes
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Por defecto, este proyecto hereda el login/password configurado en Ajustes.
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Sobrescribir para este proyecto
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <AlertTriangle size={14} className="mt-0.5 text-blue-500 shrink-0" />
                      <span>
                        Estas credenciales se guardan en el navegador del proyecto actual y se
                        envían al motor sólo cuando lanzas análisis avanzados desde esta pantalla.
                      </span>
                    </div>
                    {isUsingGlobalDataforseo ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            DataForSEO Login (global)
                          </label>
                          <input
                            type="text"
                            value={maskCredential(effectiveDataforseoLogin)}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            DataForSEO Password (global)
                          </label>
                          <input
                            type="text"
                            value={maskCredential(effectiveDataforseoPassword)}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 cursor-not-allowed"
                          />
                        </div>
                        <a
                          href="/app/settings"
                          className="inline-flex text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 underline"
                        >
                          Gestionar credenciales globales en Ajustes
                        </a>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            DataForSEO Login (proyecto)
                          </label>
                          <input
                            type="text"
                            value={formData.serp.dataforseoLogin || ''}
                            onChange={(e) =>
                              handleChange('serp', 'dataforseoLogin', e.target.value.trim())
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="email / login"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            DataForSEO Password (proyecto)
                          </label>
                          <input
                            type="password"
                            value={formData.serp.dataforseoPassword || ''}
                            onChange={(e) =>
                              handleChange('serp', 'dataforseoPassword', e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="password"
                          />
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Formato SERP
                        </label>
                        <select
                          value={formData.serp.dataforseoDetail || 'advanced'}
                          onChange={(e) =>
                            handleChange('serp', 'dataforseoDetail', e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="advanced">Advanced (recomendado)</option>
                          <option value="regular">Regular (top 10 básico)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Modo de ejecución
                        </label>
                        <select
                          value={formData.serp.dataforseoExecutionMode || 'live'}
                          onChange={(e) =>
                            handleChange('serp', 'dataforseoExecutionMode', e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="live">Live (tiempo real)</option>
                          <option value="standard">Standard (asíncrono)</option>
                          <option value="priority">Priority (asíncrono rápido)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Keywords por URL
                  </label>
                  <input
                    type="number"
                    value={formData.serp.maxKeywordsPerUrl}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const limit = capabilities?.limits.maxKeywordsPerUrl || Infinity;
                      if (val > limit) {
                        alert(`El valor máximo permitido es ${limit}`);
                      }
                      handleChange('serp', 'maxKeywordsPerUrl', Math.min(val, limit));
                    }}
                    disabled={!formData.serp.enabled}
                    max={capabilities?.limits.maxKeywordsPerUrl}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {capabilities?.limits.maxKeywordsPerUrl && (
                    <span className="text-xs text-slate-400 block mt-1">
                      Límite sistema: {capabilities.limits.maxKeywordsPerUrl}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Competidores por KW
                  </label>
                  <input
                    type="number"
                    value={formData.serp.maxCompetitorsPerKeyword}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const limit = capabilities?.limits.maxCompetitorsPerKeyword || Infinity;
                      if (val > limit) {
                        alert(`El valor máximo permitido es ${limit}`);
                      }
                      handleChange('serp', 'maxCompetitorsPerKeyword', Math.min(val, limit));
                    }}
                    disabled={!formData.serp.enabled}
                    max={capabilities?.limits.maxCompetitorsPerKeyword}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {capabilities?.limits.maxCompetitorsPerKeyword && (
                    <span className="text-xs text-slate-400 block mt-1">
                      Límite sistema: {capabilities.limits.maxCompetitorsPerKeyword}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Budgets & Limits */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-lg pb-2 border-b border-slate-100 dark:border-slate-800">
              <Shield size={20} className="text-emerald-500" />
              <h3>Límites y Presupuesto</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Max URLs por Lote
                </label>
                <input
                  type="number"
                  value={formData.budgets.maxUrlsPerBatch}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    const limit = capabilities?.limits.maxUrlsPerBatch || Infinity;
                    if (val > limit) {
                      alert(`El valor máximo permitido es ${limit}`);
                    }
                    handleChange('budgets', 'maxUrlsPerBatch', Math.min(val, limit));
                  }}
                  max={capabilities?.limits.maxUrlsPerBatch}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                {capabilities?.limits.maxUrlsPerBatch && (
                  <span className="text-xs text-slate-400 block mt-1">
                    Límite sistema: {capabilities.limits.maxUrlsPerBatch}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Presupuesto Diario (€)
                </label>
                <div className="relative">
                  <DollarSign
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="number"
                    value={formData.budgets.dailyBudget}
                    onChange={(e) =>
                      handleChange('budgets', 'dailyBudget', parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Coste Max Estimado / Lote
                </label>
                <div className="relative">
                  <DollarSign
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="number"
                    value={formData.budgets.maxEstimatedCostPerBatch}
                    onChange={(e) =>
                      handleChange(
                        'budgets',
                        'maxEstimatedCostPerBatch',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </section>


          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-lg pb-2 border-b border-slate-100 dark:border-slate-800">
              <Target size={20} className="text-pink-500" />
              <h3>Términos de marca</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Keywords de marca a excluir como keyword principal
              </label>
              <textarea
                value={brandTermsText}
                onChange={(e) => setBrandTermsText(e.target.value)}
                className="w-full min-h-[120px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder={"marca\nmi marca\nnombre comercial"}
              />
              <p className="text-xs text-slate-400 mt-2">
                Un término por línea o separado por comas. Se aplicará en importaciones y reasignación automática de KWs.
              </p>
            </div>

            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Permitir actualizar la KW principal al analizar
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Si está desactivado, se conserva la KW principal actual. Nunca se asignará una KW de marca como principal.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowKwPrincipalUpdate ?? true}
                  onChange={(e) => setFormData((prev) => ({ ...prev, allowKwPrincipalUpdate: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </section>

          {/* Competitors Mode */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-lg pb-2 border-b border-slate-100 dark:border-slate-800">
              <Target size={20} className="text-purple-500" />
              <h3>Modo Competidores</h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <label
                className={`flex-1 flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  formData.competitorsMode === 'autoFromSerp'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'
                }`}
              >
                <input
                  type="radio"
                  name="competitorsMode"
                  value="autoFromSerp"
                  checked={formData.competitorsMode === 'autoFromSerp'}
                  onChange={() => handleChange('competitorsMode', '', 'autoFromSerp')}
                  className="mt-1 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="block font-medium text-slate-900 dark:text-white">
                    Automático (desde SERP)
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Extrae competidores de los resultados de búsqueda. Requiere SERP API.
                  </span>
                </div>
              </label>

              <label
                className={`flex-1 flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  formData.competitorsMode === 'off'
                    ? 'border-slate-500 bg-slate-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="competitorsMode"
                  value="off"
                  checked={formData.competitorsMode === 'off'}
                  onChange={() => handleChange('competitorsMode', '', 'off')}
                  className="mt-1 text-slate-600 focus:ring-slate-500"
                />
                <div>
                  <span className="block font-medium text-slate-900 dark:text-white">
                    Desactivado
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    No analizar competidores. Ahorra costes pero reduce profundidad de análisis.
                  </span>
                </div>
              </label>
            </div>

            {!formData.serp.enabled && formData.competitorsMode === 'autoFromSerp' && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl text-sm">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <p>
                  El modo automático requiere habilitar la SERP API. Se usará la configuración por
                  defecto si se ejecuta en modo Avanzado.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
