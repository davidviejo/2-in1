import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSites,
  getSearchAnalytics,
  getGSCQueryPageData,
  getGSCPageDateData,
} from '../services/googleSearchConsole';
import { persistGscUrlKeywordCache } from '../services/gscUrlKeywordCache';
import { runAnalysisInWorker } from '../utils/workerClient';
import { ProjectType } from '../types';
import { useToast } from '../components/ui/ToastContext';

export type GSCComparisonMode = 'previous_period' | 'previous_year';
type GscSyncProgress = {
  completedSteps: number;
  totalSteps: number;
  currentStepLabel: string;
  startedAt: number | null;
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
  },
) => {
  const { error: showError } = useToast();
  const queryClient = useQueryClient();
  const [syncProgress, setSyncProgress] = useState<GscSyncProgress>({
    completedSteps: 0,
    totalSteps: 0,
    currentStepLabel: '',
    startedAt: null,
  });
  const [selectedSite, setSelectedSite] = useState<string>(
    () => localStorage.getItem('mediaflow_gsc_selected_site') || '',
  );

  useEffect(() => {
    if (selectedSite) {
      localStorage.setItem('mediaflow_gsc_selected_site', selectedSite);
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
    if (sitesError) {
      console.error(sitesError);
      showError('Error obteniendo la lista de sitios.');
    }
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
    queryKey: ['gscData', accessToken, resolvedSelectedSite, startDate, endDate, comparisonMode, context?.propertyId, context?.projectType, (context?.analysisProjectTypes || []).join('|'), context?.sector, context?.geoScope, (context?.brandTerms || []).join('|')],
    queryFn: async () => {
      const finalEndDate = endDate || new Date().toISOString().split('T')[0];
      const finalStartDate =
        startDate || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { previousStartDate, previousEndDate } = getComparisonRange(
        comparisonMode,
        finalStartDate,
        finalEndDate,
      );
      const progressSteps = [
        'Consultando rendimiento del periodo actual',
        'Consultando rendimiento del periodo comparado',
        'Cargando queries y páginas del periodo actual',
        'Cargando queries y páginas del periodo comparado',
        'Cargando evolución por URL',
        'Analizando patrones SEO',
      ];
      const totalSteps = progressSteps.length;
      let completedSteps = 0;

      setSyncProgress({
        completedSteps,
        totalSteps,
        currentStepLabel: progressSteps[0],
        startedAt: Date.now(),
      });

      const updateProgress = (nextLabel?: string) => {
        completedSteps += 1;
        setSyncProgress((prev) => ({
          completedSteps,
          totalSteps,
          currentStepLabel: nextLabel || prev.currentStepLabel,
          startedAt: prev.startedAt || Date.now(),
        }));
      };

      const [dateData, comparisonDateData, currentQueryPageData, previousQueryPageData, pageDateData] =
        await Promise.all([
          getSearchAnalytics(accessToken!, resolvedSelectedSite, finalStartDate, finalEndDate).then((result) => {
            updateProgress(progressSteps[1]);
            return result;
          }),
          getSearchAnalytics(accessToken!, resolvedSelectedSite, previousStartDate, previousEndDate).then((result) => {
            updateProgress(progressSteps[2]);
            return result;
          }),
          getGSCQueryPageData(accessToken!, resolvedSelectedSite, finalStartDate, finalEndDate).then((result) => {
            updateProgress(progressSteps[3]);
            return result;
          }),
          getGSCQueryPageData(accessToken!, resolvedSelectedSite, previousStartDate, previousEndDate).then((result) => {
            updateProgress(progressSteps[4]);
            return result;
          }),
          getGSCPageDateData(accessToken!, resolvedSelectedSite, finalStartDate, finalEndDate).then((result) => {
            updateProgress(progressSteps[5]);
            return result;
          }),
        ]);

      const insights = await runAnalysisInWorker({
        currentRows: currentQueryPageData,
        previousRows: previousQueryPageData,
        propertyId: context?.propertyId || resolvedSelectedSite,
        periodCurrent: { startDate: finalStartDate, endDate: finalEndDate },
        periodPrevious: { startDate: previousStartDate, endDate: previousEndDate },
        brandTerms: context?.brandTerms || [],
        projectType: context?.projectType,
        analysisProjectTypes: context?.analysisProjectTypes || [],
        sector: context?.sector,
        geoScope: context?.geoScope,
      });
      updateProgress();

      persistGscUrlKeywordCache(
        resolvedSelectedSite,
        finalStartDate,
        finalEndDate,
        currentQueryPageData || [],
      );

      return {
        gscData: dateData,
        comparisonGscData: comparisonDateData,
        queryPageData: currentQueryPageData || [],
        comparisonQueryPageData: previousQueryPageData || [],
        pageDateData: pageDateData.rows || [],
        insights,
        comparisonPeriod: {
          mode: comparisonMode,
          current: { startDate: finalStartDate, endDate: finalEndDate },
          previous: { startDate: previousStartDate, endDate: previousEndDate },
        },
      };
    },
    enabled: !!accessToken && !!resolvedSelectedSite,
    staleTime: 1000 * 60 * 5,
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
    });
  }, [isLoadingData]);

  useEffect(() => {
    if (dataError) {
      console.error(dataError);
      showError('Error obteniendo datos de analítica.');
    }
  }, [dataError, showError]);

  const clearData = () => {
    setSelectedSite('');
    localStorage.removeItem('mediaflow_gsc_selected_site');
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
    insights:
      siteData?.insights ||
      ({
        insights: [],
        groupedInsights: [],
        topOpportunities: [],
        topRisks: [],
        quickWinsLayer: [],
        anomaliesLayer: [],
        quickWins: null,
        strikingDistance: null,
        lowCtr: null,
        topQueries: null,
        cannibalization: null,
        zeroClicks: null,
        featuredSnippets: null,
        stagnantTraffic: null,
        seasonality: null,
        stableUrls: null,
        internalRedirects: null,
      } as const),
    fetchSites: () => queryClient.invalidateQueries({ queryKey: ['gscSites'] }),
    clearData,
  };
};
