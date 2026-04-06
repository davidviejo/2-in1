import React, { useState, useMemo } from 'react';
import {
  ChecklistItem as IChecklistItem,
  ChecklistStatus,
  CHECKLIST_POINTS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_OPTIONS,
} from '../../types/seoChecklist';
import {
  ChevronRight,
  Info,
  BrainCircuit,
  Map,
  Store,
  CheckCircle2,
  XCircle,
  Image,
  LocateFixed,
  AlertTriangle,
  List,
  FileText,
  Target,
  Search,
  LayoutList,
  Code,
  Copy,
} from 'lucide-react';
import { InternalLinksAnalysis } from './InternalLinksAnalysis';
import { ClusteringAnalysis } from './ClusteringAnalysis';

interface Props {
  item: IChecklistItem;
  onChange: (updates: Partial<IChecklistItem>) => void;
}

const STATUS_COLORS: Record<ChecklistStatus, string> = {
  SI: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  SI_IA: 'text-cyan-700 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
  NO: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  PARCIAL: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  ERROR_CLARO_IA:
    'text-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-200 dark:border-fuchsia-800',
  NA: 'text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
};

// Helper for JSON viewer
const JsonViewer = ({ data, title }: { data: any; title?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return 'Error: Could not stringify data';
    }
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return (
      <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-200">
        {title ? `${title}: Sin datos detectados` : 'Sin datos detectados'}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-2">
          <Code size={14} />
          {title || 'JSON Data'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="text-slate-500 hover:text-blue-600 transition-colors"
            title="Copiar"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div className={`relative ${expanded ? '' : 'max-h-40 overflow-hidden'}`}>
        <pre className="text-xs font-mono text-slate-600 dark:text-slate-400 p-3 whitespace-pre-wrap overflow-auto custom-scrollbar">
          {jsonString}
        </pre>
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-50 dark:from-slate-900 to-transparent flex items-end justify-center pb-2">
            <button
              onClick={() => setExpanded(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Ver completo
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="p-2 border-t border-slate-200 dark:border-slate-700 text-center">
          <button
            onClick={() => setExpanded(false)}
            className="text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            Colapsar
          </button>
        </div>
      )}
    </div>
  );
};

export const ChecklistItem: React.FC<Props> = ({ item, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLearning, setShowLearning] = useState(false);

  const pointDef = CHECKLIST_POINTS.find((p) => p.key === item.key);
  const typeLabel = pointDef?.type || 'MANUAL';

  const typeColor =
    typeLabel === 'AUTO'
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      : typeLabel === 'MIXED'
        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  const latestAiDecision = item.evaluationMeta;
  const latestAiDecisionTime =
    latestAiDecision?.evaluatedAt && Number.isFinite(latestAiDecision.evaluatedAt)
      ? new Date(latestAiDecision.evaluatedAt).toLocaleString('es-ES')
      : null;

  const renderAdvancedWarning = () => {
    if (
      item.autoData &&
      item.autoData.advancedExecuted === false &&
      item.autoData.advancedBlockedReason
    ) {
      return (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg text-sm mb-4 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-bold block text-xs uppercase">
              Análisis Avanzado Deshabilitado
            </span>
            {item.autoData.advancedBlockedReason}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderAutoData = () => {
    if (!item.autoData) return null;

    // 1. GEOLOCALIZACION
    if (item.key === 'GEOLOCALIZACION') {
      const { hreflangTags, htmlLang, ogLocale, googleMaps, localBusiness } = item.autoData;
      return (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase block mb-1">
                HTML Lang
              </span>
              <div className="font-mono text-sm bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 inline-block">
                {htmlLang || 'N/A'}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase block mb-1">
                OG Locale
              </span>
              <div className="font-mono text-sm bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 inline-block">
                {ogLocale || 'N/A'}
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase block mb-1">
              Hreflang Tags
            </span>
            {Array.isArray(hreflangTags) && hreflangTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {hreflangTags.map((tag: any, i: number) => (
                  <span
                    key={i}
                    className="text-xs font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded"
                  >
                    {typeof tag === 'string' ? tag : JSON.stringify(tag)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-slate-400 italic">No detectadas</span>
            )}
          </div>

          <div className="flex gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div
              className={`flex items-center gap-2 text-sm ${
                googleMaps ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            >
              <Map size={18} />
              <span className="font-medium">Google Maps Iframe</span>
              {googleMaps ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            </div>
            <div
              className={`flex items-center gap-2 text-sm ${
                localBusiness ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            >
              <Store size={18} />
              <span className="font-medium">LocalBusiness Schema</span>
              {localBusiness ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            </div>
          </div>
        </div>
      );
    }

    // 2. DATOS_ESTRUCTURADOS
    if (item.key === 'DATOS_ESTRUCTURADOS') {
      const { schemasParsed, parseErrors, competitorSchemas } = item.autoData;
      return (
        <div className="space-y-4">
          {/* Client Block */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <Target size={14} /> Cliente
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase block mb-2">
                Schemas Detectados
              </span>
              {Array.isArray(schemasParsed) && schemasParsed.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {schemasParsed.map((schema: any, i: number) => {
                    const label =
                      typeof schema === 'string'
                        ? schema
                        : schema?.['@type'] || JSON.stringify(schema);
                    return (
                      <span
                        key={i}
                        className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold border border-indigo-200 dark:border-indigo-800 truncate max-w-full"
                        title={typeof schema !== 'string' ? JSON.stringify(schema) : undefined}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-sm text-slate-400 italic">Ninguno</span>
              )}
            </div>

            {Array.isArray(parseErrors) && parseErrors.length > 0 && (
              <details className="group">
                <summary className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold cursor-pointer select-none">
                  <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
                  Errores de Parsing ({parseErrors.length})
                </summary>
                <div className="mt-2 pl-6 space-y-1 text-xs font-mono text-red-500 dark:text-red-400">
                  {parseErrors.map((err: string, i: number) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Competitors Accordion */}
          {competitorSchemas &&
            Array.isArray(competitorSchemas) &&
            competitorSchemas.length > 0 && (
              <details className="group bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <summary className="flex items-center gap-2 p-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase cursor-pointer select-none">
                  <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
                  <Target size={14} /> Competidores ({competitorSchemas.length})
                </summary>
                <div className="p-3 pt-0 border-t border-slate-200 dark:border-slate-700 mt-2 space-y-4">
                  {competitorSchemas.map((comp: any, index: number) => (
                    <div
                      key={index}
                      className="border-b border-slate-200 dark:border-slate-700 last:border-0 pb-4 last:pb-0"
                    >
                      <h4
                        className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 truncate"
                        title={comp.url}
                      >
                        {comp.domain || comp.url}
                      </h4>
                      {comp.schemasParsed && comp.schemasParsed.length > 0 ? (
                        <details className="group/inner mb-2">
                          <summary className="text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer select-none">
                            Ver {comp.schemasParsed.length} schemas
                          </summary>
                          <div className="flex flex-wrap gap-2 mt-2 pl-2">
                            {comp.schemasParsed.map((s: any, j: number) => {
                              const label =
                                typeof s === 'string' ? s : s?.['@type'] || JSON.stringify(s);
                              return (
                                <span
                                  key={j}
                                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-600 dark:text-slate-400"
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </details>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic">Sin schemas válidos</div>
                      )}

                      {comp.parseErrors && comp.parseErrors.length > 0 && (
                        <div className="mt-1">
                          <span className="text-[10px] text-red-500 font-bold">Errores:</span>
                          <ul className="list-disc list-inside text-[10px] text-red-400 pl-1">
                            {comp.parseErrors.map((e: string, k: number) => (
                              <li key={k}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

          {/* Always show robust JSON viewer */}
          <JsonViewer data={item.autoData} title="Bruto del Análisis" />
        </div>
      );
    }

    // 4. CONTENIDOS (Advanced Data)
    if (item.key === 'CONTENIDOS') {
      const { competitorUrlsUsed, gapSections, outlines } = item.autoData;
      return (
        <div className="space-y-4">
          {renderAdvancedWarning()}

          {competitorUrlsUsed && competitorUrlsUsed.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                <Target size={14} /> Competidores Analizados
              </div>
              <ul className="space-y-1 list-disc list-inside text-xs text-slate-600 dark:text-slate-300">
                {competitorUrlsUsed.map((url: string, i: number) => (
                  <li key={i} className="truncate" title={url}>
                    {url}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gapSections && gapSections.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                <FileText size={14} /> Secciones Faltantes (Gap)
              </div>
              <ul className="space-y-1 list-disc list-inside text-xs text-slate-600 dark:text-slate-300">
                {gapSections.map((section: string, i: number) => (
                  <li key={i}>{section}</li>
                ))}
              </ul>
            </div>
          )}

          {outlines && (
            <details className="group bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <summary className="flex items-center gap-2 p-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase cursor-pointer select-none">
                <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
                <LayoutList size={14} /> Outlines Sugeridos
              </summary>
              <div className="p-3 pt-0 border-t border-slate-200 dark:border-slate-700 mt-2">
                <JsonViewer data={outlines} title="Structure" />
              </div>
            </details>
          )}

          <JsonViewer data={item.autoData} title="Bruto del Análisis" />
        </div>
      );
    }

    // 12. OPORTUNIDADES (Advanced Data)
    if (item.key === 'OPORTUNIDADES') {
      const {
        gscQueries,
        kwPrincipalInGSC,
        primaryKeyword,
        isBrandKeyword,
        zeroClickHighImpressionKeywords,
        serpResults,
        clustering,
      } = item.autoData;
      const hasPrimaryKeyword =
        typeof primaryKeyword === 'string' && primaryKeyword.trim().length > 0;
      const hasGscQueries = Array.isArray(gscQueries) && gscQueries.length > 0;

      return (
        <div className="space-y-4">
          {renderAdvancedWarning()}

          <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              <Target size={14} /> Keyword principal
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">
              {hasPrimaryKeyword
                ? primaryKeyword
                : isBrandKeyword
                  ? 'KW de marca excluida del análisis principal'
                  : 'Sin keyword principal asignada'}
            </div>
          </div>

          {hasPrimaryKeyword ? (
            <div
              className={`p-3 rounded-lg border flex items-center gap-3 ${
                kwPrincipalInGSC
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
              }`}
            >
              {kwPrincipalInGSC ? <CheckCircle2 size={20} /> : <Info size={20} />}
              <div className="text-sm font-medium">
                {hasGscQueries
                  ? kwPrincipalInGSC
                    ? 'La Keyword Principal aparece en GSC (Top 50).'
                    : 'La Keyword Principal NO aparece en GSC (Top 50).'
                  : 'No hay datos de GSC para validar la keyword principal.'}
              </div>
            </div>
          ) : null}

          {/* Always show GSC Table if queries exist */}
          {hasGscQueries ? (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 font-semibold">
                  <tr>
                    <th className="px-3 py-2">Query</th>
                    <th className="px-3 py-2 text-right">Pos</th>
                    <th className="px-3 py-2 text-right">Clics</th>
                    <th className="px-3 py-2 text-right">Impr.</th>
                    <th className="px-3 py-2 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                  {gscQueries.slice(0, 10).map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td
                        className="px-3 py-2 font-medium truncate max-w-[150px]"
                        title={row.keys?.[0]}
                      >
                        {row.keys?.[0]}
                      </td>
                      <td className="px-3 py-2 text-right">{row.position?.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{row.clicks}</td>
                      <td className="px-3 py-2 text-right">{row.impressions}</td>
                      <td className="px-3 py-2 text-right">{(row.ctr * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasGscQueries && gscQueries.length > 10 && (
                <div className="bg-slate-50 dark:bg-slate-800 p-2 text-center text-xs text-slate-400 border-t border-slate-200 dark:border-slate-700">
                  Mostrando 10 de {gscQueries.length} consultas
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-200">
              No hay datos de GSC disponibles.
            </div>
          )}

          {/* Clustering Analysis with Warning if not executed */}
          {clustering && clustering.executed === false ? (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 italic text-center">
              Clustering no ejecutado: {clustering.reason || 'Razón desconocida'}
            </div>
          ) : (
            <ClusteringAnalysis data={item.autoData} />
          )}

          {/* Zero Click Opportunities */}
          {zeroClickHighImpressionKeywords && zeroClickHighImpressionKeywords.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-400 uppercase flex items-center gap-2">
                <Target size={14} /> Zero Click Keywords (High Impression / Low CTR)
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {zeroClickHighImpressionKeywords.slice(0, 5).map((kw: any, i: number) => (
                  <li
                    key={i}
                    className="px-4 py-2 text-sm flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  >
                    <span>{kw.keys?.[0]}</span>
                    <span className="text-xs font-mono text-slate-500">
                      Imp: {kw.impressions} | CTR: {(kw.ctr * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* SERP Results */}
          {serpResults && (
            <details className="group bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <summary className="flex items-center gap-2 p-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase cursor-pointer select-none">
                <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
                <Search size={14} /> Resultados SERP
              </summary>
              <div className="p-3 pt-0 border-t border-slate-200 dark:border-slate-700 mt-2">
                <JsonViewer data={serpResults} title="SERP Data" />
              </div>
            </details>
          )}

          <JsonViewer data={item.autoData} title="Bruto del Análisis" />
        </div>
      );
    }

    // 13. SEMANTICA (Advanced Data)
    if (item.key === 'SEMANTICA') {
      const { competitorTerms, semanticGapTerms } = item.autoData;
      return (
        <div className="space-y-4">
          {renderAdvancedWarning()}

          {competitorTerms && competitorTerms.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                <List size={14} /> Términos Competidores
              </div>
              <div className="flex flex-wrap gap-2">
                {competitorTerms
                  .slice(0, 15)
                  .map((item: string | { term: string; count: number }, i: number) => {
                    let display = '';
                    if (typeof item === 'string') {
                      // Legacy: remove trailing digits for display if terminos3 format
                      display = item.replace(/\s\d+$/, '');
                    } else if (item && typeof item === 'object') {
                      display = `${item.term} (${item.count})`;
                    }

                    return (
                      <span
                        key={i}
                        className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-600 dark:text-slate-300"
                      >
                        {display}
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          {semanticGapTerms && semanticGapTerms.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                <BrainCircuit size={14} /> Gap Semántico (Sugeridos)
              </div>
              <div className="flex flex-wrap gap-2">
                {semanticGapTerms
                  .slice(0, 15)
                  .map((item: string | { term: string; count: number }, i: number) => {
                    let display = '';
                    if (typeof item === 'string') {
                      display = item.replace(/\s\d+$/, '');
                    } else if (item && typeof item === 'object') {
                      display = `${item.term} (${item.count})`;
                    }
                    return (
                      <span
                        key={i}
                        className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded text-xs text-indigo-700 dark:text-indigo-300 font-medium"
                      >
                        {display}
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          <JsonViewer data={item.autoData} title="Bruto del Análisis" />
        </div>
      );
    }

    // 4. GEO_IMAGENES (Existing)
    if (item.key === 'GEO_IMAGENES') {
      const { imagesChecked, exifGPS } = item.autoData;
      return (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 mx-auto mb-2">
                <Image size={20} />
              </div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {imagesChecked || 0}
              </div>
              <div className="text-xs text-slate-400 font-bold uppercase">Revisadas</div>
            </div>
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-700"></div>
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400 mx-auto mb-2">
                <LocateFixed size={20} />
              </div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {exifGPS || 0}
              </div>
              <div className="text-xs text-slate-400 font-bold uppercase">Con GPS</div>
            </div>
          </div>
        </div>
      );
    }

    // 5. ENLAZADO_INTERNO
    if (item.key === 'ENLAZADO_INTERNO') {
      const internalLinks = item.autoData?.internal_links;

      return (
        <div className="space-y-4">
          {internalLinks && <InternalLinksAnalysis internal_links={internalLinks} />}
          <JsonViewer data={item.autoData} title="Bruto del Análisis" />
        </div>
      );
    }

    // FALLBACK
    return (
      <div className="space-y-2">
        <JsonViewer data={item.autoData} title="Bruto del Análisis" />
      </div>
    );
  };

  return (
    <div
      className={`border rounded-xl transition-all ${
        isOpen
          ? 'bg-white dark:bg-slate-800 shadow-lg'
          : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800'
      } border-slate-200 dark:border-slate-700`}
    >
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-1 rounded-lg transition-transform duration-200 ${
              isOpen ? 'rotate-90' : ''
            }`}
          >
            <ChevronRight size={18} className="text-slate-400" />
          </div>
          <div>
            <h3 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
              {item.label}
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${typeColor}`}
              >
                {typeLabel}
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <select
            value={item.status_manual}
            onChange={(e) => onChange({ status_manual: e.target.value as ChecklistStatus })}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border-2 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors ${
              STATUS_COLORS[item.status_manual]
            }`}
          >
            {CHECKLIST_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {CHECKLIST_STATUS_LABELS[opt]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Learning Block Toggle */}
          {pointDef?.learning && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowLearning(!showLearning)}
                className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 w-fit transition-colors"
              >
                <Info size={14} />
                {showLearning ? 'Ocultar información' : '¿Qué es esto?'}
              </button>

              {showLearning && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 text-sm text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2 mb-1 font-bold text-blue-700 dark:text-blue-300 text-xs uppercase">
                    <BrainCircuit size={14} />
                    Aprendizaje
                  </div>
                  {pointDef.learning}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Notas Manuales
            </label>
            <textarea
              value={item.notes_manual || ''}
              onChange={(e) => onChange({ notes_manual: e.target.value })}
              className="w-full text-sm p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300 resize-none h-24"
              placeholder="Añadir observaciones..."
            />
          </div>

          {latestAiDecision && (
            <div className="bg-cyan-50 dark:bg-cyan-900/10 rounded-lg p-3 border border-cyan-100 dark:border-cyan-900/30">
              <div className="text-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase mb-1">
                Última decisión IA
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {latestAiDecision.reason}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {latestAiDecisionTime || 'Fecha no disponible'}
              </p>
            </div>
          )}

          {(item.autoData || item.recommendation) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {item.autoData && renderAutoData()}

              {item.recommendation && (
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3 border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">
                      Recomendación
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {item.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
