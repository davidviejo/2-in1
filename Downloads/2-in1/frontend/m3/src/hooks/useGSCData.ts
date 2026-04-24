import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listSites } from '../services/googleSearchConsole';
import { gscDatasetManager } from '@/services/gscDatasetManager';
import { persistGscUrlKeywordCache } from '../services/gscUrlKeywordCache';
import { runAnalysisInWorker, type GSCInsights } from '../utils/workerClient';
import { buildDashboardGscFetchPlan } from '@/utils/gscSamplingPolicy';
import { ProjectType } from '../types';
import { useToast } from '../components/ui/ToastContext';

export type GSCComparisonMode = 'previous_period' | 'previous_year';
type GscSyncProgress = {
  completedSteps: number;
  totalSteps: number;
  currentStepLabel: string;
  startedAt: number | null;
  analysis: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    currentChunk: number;
    totalChunks: number;
    percentage: number;
    label: string;
  };
};

const GSC_STEP_MAX_RETRIES = 2;
const GSC_STEP_RETRY_BASE_DELAY_MS = 1200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const WORKER_ANALYSIS_CHUNK_SIZE = 20000;
const WORKER_ANALYSIS_EXTREME_ROW_GUARDRAIL = 2000000;

const buildEmptyInsightResult = (title: string): GSCInsights['quickWins'] => ({
  title,
  description: 'Sin señales suficientes para este insight.',
  count: 0,
  items: [],
});

const EMPTY_INSIGHTS: GSCInsights = {
  insights: [],
  groupedInsights: [],
  topOpportunities: [],
  topRisks: [],
  quickWinsLayer: [],
  anomaliesLayer: [],
  quickWins: buildEmptyInsightResult('Quick wins'),
  strikingDistance: buildEmptyInsightResult('Striking distance'),
  lowCtr: buildEmptyInsightResult('CTR bajo'),
  topQueries: buildEmptyInsightResult('Top queries'),
  cannibalization: buildEmptyInsightResult('Canibalización'),
  zeroClicks: buildEmptyInsightResult('URLs con cero clics'),
  featuredSnippets: buildEmptyInsightResult('Featured snippets'),
  stagnantTraffic: buildEmptyInsightResult('Tráfico estancado'),
  seasonality: buildEmptyInsightResult('Estacionalidad'),
  stableUrls: buildEmptyInsightResult('URLs estables'),
  internalRedirects: buildEmptyInsightResult('Redirecciones internas'),
};

const normalizeTerm = (value: string) => value.trim().toLowerCase();

const applyUrlTermsFilter = (
  rows: Array<{ keys?: string[]; page?: string; url?: string }>,
  includeTerms: string[],
  excludeTerms: string[],
) => {
  if (includeTerms.length === 0 && excludeTerms.length === 0) {
    return rows;
  }

  const normalizedIncludeTerms = includeTerms.map(normalizeTerm).filter(Boolean);
  const normalizedExcludeTerms = excludeTerms.map(normalizeTerm).filter(Boolean);

  return rows.filter((row) => {
    const urlCandidate = `${row.keys?.[1] || row.page || row.url || ''}`.toLowerCase();

    if (!urlCandidate) {
      return false;
    }

    if (normalizedIncludeTerms.length > 0 && !normalizedIncludeTerms.some((term) => urlCandidate.includes(term))) {
      return false;
    }

    if (normalizedExcludeTerms.length > 0 && normalizedExcludeTerms.some((term) => urlCandidate.includes(term))) {
      return false;
    }

    return true;
  });
};

const runStepWithRetry = async <T>(
  label: string,
  runStep: () => Promise<T>,
  updateLabel: (nextLabel: string) => void,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= GSC_STEP_MAX_RETRIES; attempt += 1) {
    try {
      return await runStep();
    } catch (error) {
      lastError = error;

      if (attempt >= GSC_STEP_MAX_RETRIES) {
        throw error;
      }

      const nextAttempt = attempt + 1;
      updateLabel(
        `${label} · reintentando (${nextAttempt}/${GSC_STEP_MAX_RETRIES})`,
      );
      await sleep(GSC_STEP_RETRY_BASE_DELAY_MS * nextAttempt);
      updateLabel(label);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Error ejecutando paso de sincronización GSC');
};

const getPreviousRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - (diffDays - 1));

  return {
    previousStartDate: previousStart.toISOString().split('T')[0],
    previousEndDate: previousEnd.toISOString().split('T')[0],
  };
};

const getYearOverYearRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  const previousYearStart = new Date(start);
  previousYearStart.setUTCFullYear(previousYearStart.getUTCFullYear() - 1);

  const previousYearEnd = new Date(end);
  previousYearEnd.setUTCFullYear(previousYearEnd.getUTCFullYear() - 1);

  return {
    previousStartDate: previousYearStart.toISOString().split('T')[0],
    previousEndDate: previousYearEnd.toISOString().split('T')[0],
  };
};

const getComparisonRange = (
  comparisonMode: GSCComparisonMode,
  startDate: string,
  endDate: string,
) => {
  if (comparisonMode === 'previous_year') {
    return getYearOverYearRange(startDate, endDate);
  }

  return getPreviousRange(startDate, endDate);
};

export const useGSCData = (
  accessToken: string | null,
  startDate?: string,
  endDate?: string,
  comparisonMode: GSCComparisonMode = 'previous_period',
  context?: {
    propertyId?: string;
    brandTerms?: string[];
    projectType?: ProjectType;
    analysisProjectTypes?: ProjectType[];
    sector?: string;
    geoScope?: string;
    deferTrendPageDateFetch?: boolean;
    urlIncludeTerms?: string[];
    urlExcludeTerms?: string[];
    analysisMaxRows?: number;
    evolutionMaxRows?: number;
    autoRun?: boolean;
    runKey?: number;
  },
) => {
  const { error: showError, warning: showWarning } = useToast();
  const queryClient = useQueryClient();
  const getStorageItem = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`[useGSCData] No se pudo leer localStorage para la clave "${key}".`, error);
      return null;
    }
  };

  const setStorageItem = (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[useGSCData] No se pudo guardar localStorage para la clave "${key}".`, error);
    }
  };

  const removeStorageItem = (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`[useGSCData] No se pudo eliminar localStorage para la clave "${key}".`, error);
    }
  };
  const [syncProgress, setSyncProgress] = useState<GscSyncProgress>({
    completedSteps: 0,
    totalSteps: 0,
    currentStepLabel: '',
    startedAt: null,
    analysis: {
      status: 'idle',
      currentChunk: 0,
      totalChunks: 0,
      percentage: 0,
      label: '',
    },
  });
  const [selectedSite, setSelectedSite] = useState<string>(
    () => getStorageItem('mediaflow_gsc_selected_site') || '',
  );

  const lastSitesErrorKeyRef = useRef<string>('');
  const lastDataErrorKeyRef = useRef<string>('');

  useEffect(() => {
    if (selectedSite) {
      setStorageItem('mediaflow_gsc_selected_site', selectedSite);
    }
  }, [selectedSite]);

  const {
    data: gscSites = [],
    isLoading: isLoadingSites,
    error: sitesError,
  } = useQuery({
    queryKey: ['gscSites', accessToken],
    queryFn: () => listSites(accessToken!),
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (!sitesError) {
      lastSitesErrorKeyRef.current = '';
      return;
    }

    const errorKey = sitesError instanceof Error ? `${sitesError.name}:${sitesError.message}` : String(sitesError);
    if (lastSitesErrorKeyRef.current === errorKey) {
      return;
    }

    lastSitesErrorKeyRef.current = errorKey;
    console.error(sitesError);
    showError('Error obteniendo la lista de sitios.');
  }, [sitesError, showError]);

  const resolvedSelectedSite =
    gscSites.length === 0
      ? selectedSite
      : selectedSite && gscSites.some((site) => site.siteUrl === selectedSite)
        ? selectedSite
        : gscSites[0].siteUrl;

  const {
    data: siteData,
    isLoading: isLoadingData,
    error: dataError,
  } = useQuery({
    queryKey: ['gscData', accessToken, resolvedSelectedSite, startDate, endDate, comparisonMode, context?.propertyId, context?.projectType, (context?.analysisProjectTypes || []).join('|'), context?.sector, context?.geoScope, (context?.brandTerms || []).join('|'), (context?.urlIncludeTerms || []).join('|'), (context?.urlExcludeTerms || []).join('|'), context?.analysisMaxRows || 0, context?.evolutionMaxRows || 0, context?.runKey || 0, context?.deferTrendPageDateFetch ? 'defer_page_date' : 'with_page_date'],
    queryFn: async () => {
      const finalEndDate = endDate || new Date().toISOString().split('T')[0];
      const finalStartDate =
        startDate || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { previousStartDate, previousEndDate } = getComparisonRange(
        comparisonMode,
        finalStartDate,
        finalEndDate,
      );
      const shouldFetchPageDate = !context?.deferTrendPageDateFetch;
      const fetchPlan = buildDashboardGscFetchPlan(finalStartDate, finalEndDate, {
        analysisMaxRows: context?.analysisMaxRows,
        evolutionMaxRows: context?.evolutionMaxRows,
      });
      const progressSteps = [
        'Consultando rendimiento del periodo actual',
        'Consultando rendimiento del periodo comparado',
        'Cargando queries y páginas del periodo actual',
        'Cargando queries y páginas del periodo comparado',
        ...(shouldFetchPageDate ? ['Cargando evolución por URL'] : []),
        'Analizando patrones SEO',
      ];
      const totalSteps = progressSteps.length;
      let completedSteps = 0;

      setSyncProgress({
        completedSteps,
        totalSteps,
        currentStepLabel: progressSteps[0],
        startedAt: Date.now(),
        analysis: {
          status: 'idle',
          currentChunk: 0,
          totalChunks: 0,
          percentage: 0,
          label: '',
        },
      });

      const updateProgress = (nextLabel?: string) => {
        completedSteps += 1;
        setSyncProgress((prev) => ({
          ...prev,
          completedSteps,
          totalSteps,
          currentStepLabel: nextLabel || prev.currentStepLabel,
          startedAt: prev.startedAt || Date.now(),
        }));
      };
      const updateCurrentStepLabel = (nextLabel: string) => {
        setSyncProgress((prev) => ({
          ...prev,
          currentStepLabel: nextLabel,
          startedAt: prev.startedAt || Date.now(),
        }));
      };

      const updateAnalysisProgress = (next: Partial<GscSyncProgress['analysis']>) => {
        setSyncProgress((prev) => ({
          ...prev,
          analysis: {
            ...prev.analysis,
            ...next,
          },
        }));
      };

      let evolutionLoadDegraded = false;
      const pageDateProgressLabel = shouldFetchPageDate ? 'Cargando evolución por URL' : 'Analizando patrones SEO';
      const [
        dateData,
        comparisonDateData,
        currentQueryPageResponse,
        previousQueryPageResponse,
        pageDateData,
      ] =
        await Promise.all([
          runStepWithRetry(
            progressSteps[0],
            () => gscDatasetManager.fetch(accessToken!, {
              siteUrl: resolvedSelectedSite,
              startDate: finalStartDate,
              endDate: finalEndDate,
              dimensions: ['date'],
              rowLimit: 400,
            }).then((result) => result.rows || []),
            updateCurrentStepLabel,
          ).then((result) => {
            updateProgress(progressSteps[1]);
            return result;
          }),
          runStepWithRetry(
            progressSteps[1],
            () => gscDatasetManager.fetch(accessToken!, {
              siteUrl: resolvedSelectedSite,
              startDate: previousStartDate,
              endDate: previousEndDate,
              dimensions: ['date'],
              rowLimit: 400,
            }).then((result) => result.rows || []),
            updateCurrentStepLabel,
          ).then((result) => {
            updateProgress(progressSteps[2]);
            return result;
          }),
          runStepWithRetry(
            progressSteps[2],
            () => gscDatasetManager.fetch(accessToken!, {
              siteUrl: resolvedSelectedSite,
              startDate: finalStartDate,
              endDate: finalEndDate,
              dimensions: ['query', 'page'],
              rowLimit: fetchPlan.analysisRowLimit,
              maxRows: fetchPlan.analysisMaxRows,
              dateChunkSizeDays: fetchPlan.analysisDateChunkSizeDays,
              allowHighCardinality: true,
            }),
            updateCurrentStepLabel,
          ).then((result) => {
            updateProgress(progressSteps[3]);
            return result;
          }),
          runStepWithRetry(
            progressSteps[3],
            () => gscDatasetManager.fetch(accessToken!, {
              siteUrl: resolvedSelectedSite,
              startDate: previousStartDate,
              endDate: previousEndDate,
              dimensions: ['query', 'page'],
              rowLimit: fetchPlan.analysisRowLimit,
              maxRows: fetchPlan.analysisMaxRows,
              dateChunkSizeDays: fetchPlan.analysisDateChunkSizeDays,
              allowHighCardinality: true,
            }),
            updateCurrentStepLabel,
          ).then((result) => {
            updateProgress(pageDateProgressLabel);
            return result;
          }),
          shouldFetchPageDate
            ? runStepWithRetry(
              pageDateProgressLabel,
              async () => {
                try {
                  return await gscDatasetManager.fetch(accessToken!, {
                    siteUrl: resolvedSelectedSite,
                    startDate: finalStartDate,
                    endDate: finalEndDate,
                    dimensions: ['page', 'date'],
                    rowLimit: fetchPlan.evolutionRowLimit,
                    maxRows: fetchPlan.evolutionMaxRows,
                    dateChunkSizeDays: fetchPlan.evolutionDateChunkSizeDays,
                    searchType: 'web',
                    allowHighCardinality: true,
                  });
                } catch (pageDateError) {
                  evolutionLoadDegraded = true;
                  console.warn(
                    '[GSC] No se pudo cargar evolución por URL completa; se continúa sin ese bloque para evitar fallo total.',
                    pageDateError,
                  );
                  return {
                    rows: [],
                    metadata: {
                      isPartial: true,
                      pagesFetched: 0,
                      rowsFetched: 0,
                      truncatedReason: 'max_rows_reached' as const,
                    },
                  };
                }
              },
              updateCurrentStepLabel,
            ).then((result) => {
              updateProgress(progressSteps[progressSteps.length - 1]);
              return result;
            })
            : Promise.resolve({
              rows: [],
              metadata: {
                isPartial: false,
                pagesFetched: 0,
                rowsFetched: 0,
              },
            }),
        ]);

      if (evolutionLoadDegraded) {
        showWarning('No se pudo cargar toda la evolución por URL en esta propiedad grande. Se mostrará el resto del panel.');
      }

      const includeTerms = context?.urlIncludeTerms || [];
      const excludeTerms = context?.urlExcludeTerms || [];
      const analysisCurrentRows = applyUrlTermsFilter(currentQueryPageResponse.rows || [], includeTerms, excludeTerms);
      const analysisPreviousRows = applyUrlTermsFilter(previousQueryPageResponse.rows || [], includeTerms, excludeTerms);
      const currentPartialReason = currentQueryPageResponse.metadata?.truncatedReason;
      const previousPartialReason = previousQueryPageResponse.metadata?.truncatedReason;

      if (currentQueryPageResponse.metadata?.isPartial || previousQueryPageResponse.metadata?.isPartial) {
        const reasons = [currentPartialReason, previousPartialReason].filter(Boolean).join(', ');
        showWarning(
          `GSC devolvió un dataset parcial para query+page (${reasons || 'sin motivo detallado'}). Se priorizaron filas de mayor impacto (clics/impresiones) para mantener estabilidad.`,
        );
      }
      const totalRowsForAnalysis = analysisCurrentRows.length + analysisPreviousRows.length;

      if (totalRowsForAnalysis > WORKER_ANALYSIS_EXTREME_ROW_GUARDRAIL) {
        console.warn(
          `[GSC] Dataset extremo (${totalRowsForAnalysis} filas) supera guardarraíl de ${WORKER_ANALYSIS_EXTREME_ROW_GUARDRAIL}; se omite análisis para proteger estabilidad.`,
        );
      }

      let insights: GSCInsights;
      try {
        if (totalRowsForAnalysis > WORKER_ANALYSIS_EXTREME_ROW_GUARDRAIL) {
          updateAnalysisProgress({
            status: 'failed',
            label: 'Dataset demasiado grande para análisis seguro',
          });
          insights = EMPTY_INSIGHTS;
        } else {
          const totalChunks = Math.max(
            1,
            Math.ceil(analysisCurrentRows.length / WORKER_ANALYSIS_CHUNK_SIZE) +
              Math.ceil(analysisPreviousRows.length / WORKER_ANALYSIS_CHUNK_SIZE),
          );
          updateAnalysisProgress({
            status: 'running',
            currentChunk: 0,
            totalChunks,
            percentage: 0,
            label: 'Analizando chunks SEO (0%)',
          });

          insights = await runAnalysisInWorker(
            {
              currentRows: analysisCurrentRows,
              previousRows: analysisPreviousRows,
              currentDailyRows: dateData,
              previousDailyRows: comparisonDateData,
              propertyId: context?.propertyId || resolvedSelectedSite,
              periodCurrent: { startDate: finalStartDate, endDate: finalEndDate },
              periodPrevious: { startDate: previousStartDate, endDate: previousEndDate },
              brandTerms: context?.brandTerms || [],
              projectType: context?.projectType,
              analysisProjectTypes: context?.analysisProjectTypes || [],
              sector: context?.sector,
              geoScope: context?.geoScope,
            },
            {
              chunkSize: WORKER_ANALYSIS_CHUNK_SIZE,
              onProgress: ({ chunkIndex, totalChunks: workerTotalChunks }) => {
                const safeTotalChunks = Math.max(workerTotalChunks, totalChunks, 1);
                const percentage = Math.min(100, Math.round((chunkIndex / safeTotalChunks) * 100));
                updateAnalysisProgress({
                  status: 'running',
                  currentChunk: chunkIndex,
                  totalChunks: safeTotalChunks,
                  percentage,
                  label: `Analizando chunks SEO (${percentage}%)`,
                });
              },
            },
          );

          updateAnalysisProgress({
            status: 'completed',
            currentChunk: totalChunks,
            totalChunks,
            percentage: 100,
            label: 'Análisis SEO completado',
          });
        }
      } catch (analysisError) {
        console.error('[GSC] Worker analysis failed, returning EMPTY_INSIGHTS fallback.', analysisError);
        updateAnalysisProgress({
          status: 'failed',
          label: 'Falló el análisis SEO incremental',
        });
        insights = EMPTY_INSIGHTS;
      }
      updateProgress();

      persistGscUrlKeywordCache(
        resolvedSelectedSite,
        finalStartDate,
        finalEndDate,
        analysisCurrentRows,
      );

      return {
        gscData: dateData,
        comparisonGscData: comparisonDateData,
        queryPageData: analysisCurrentRows,
        comparisonQueryPageData: analysisPreviousRows,
        pageDateData: pageDateData.rows || [],
        insights,
        comparisonPeriod: {
          mode: comparisonMode,
          current: { startDate: finalStartDate, endDate: finalEndDate },
          previous: { startDate: previousStartDate, endDate: previousEndDate },
        },
      };
    },
    enabled: !!accessToken && !!resolvedSelectedSite && ((context?.autoRun ?? true) || ((context?.runKey || 0) > 0)),
    staleTime: 1000 * 60 * 5,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (isLoadingData) {
      return;
    }
    setSyncProgress({
      completedSteps: 0,
      totalSteps: 0,
      currentStepLabel: '',
      startedAt: null,
      analysis: {
        status: 'idle',
        currentChunk: 0,
        totalChunks: 0,
        percentage: 0,
        label: '',
      },
    });
  }, [isLoadingData]);

  useEffect(() => {
    if (!dataError) {
      lastDataErrorKeyRef.current = '';
      return;
    }

    const errorKey = dataError instanceof Error ? `${dataError.name}:${dataError.message}` : String(dataError);
    if (lastDataErrorKeyRef.current === errorKey) {
      return;
    }

    lastDataErrorKeyRef.current = errorKey;
    console.error(dataError);
    showError('Error obteniendo datos de analítica.');
  }, [dataError, showError]);

  const clearData = () => {
    setSelectedSite('');
    removeStorageItem('mediaflow_gsc_selected_site');
    queryClient.removeQueries({ queryKey: ['gscData'] });
  };

  return {
    gscSites,
    selectedSite: resolvedSelectedSite,
    setSelectedSite,
    gscData: siteData?.gscData || [],
    comparisonGscData: siteData?.comparisonGscData || [],
    queryPageData: siteData?.queryPageData || [],
    comparisonQueryPageData: siteData?.comparisonQueryPageData || [],
    pageDateData: siteData?.pageDateData || [],
    comparisonPeriod: siteData?.comparisonPeriod || null,
    isLoadingGsc: isLoadingSites || isLoadingData,
    syncProgress,
    insights: siteData?.insights || EMPTY_INSIGHTS,
    fetchSites: () => queryClient.invalidateQueries({ queryKey: ['gscSites'] }),
    clearData,
  };
};
