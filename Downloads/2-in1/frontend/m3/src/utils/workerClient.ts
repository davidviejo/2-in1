import { GSCRow, ProjectType } from '../types';
import { SeoInsightDateRange } from '../types/seoInsights';
import { GSCInsightsEngineResult } from './gscInsights';

export interface GSCWorkerPayload {
  currentRows: GSCRow[];
  previousRows?: GSCRow[];
  propertyId?: string;
  periodCurrent?: SeoInsightDateRange;
  periodPrevious?: SeoInsightDateRange;
  brandTerms?: string[];
  projectType?: ProjectType;
  analysisProjectTypes?: ProjectType[];
  sector?: string;
  geoScope?: string;
}

export type GSCInsights = GSCInsightsEngineResult;

export const runAnalysisInWorker = (payload: GSCWorkerPayload): Promise<GSCInsights> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/gscInsights.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'SUCCESS') {
        resolve(payload as GSCInsights);
      } else {
        reject(new Error(payload || 'Unknown worker error'));
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };

    worker.postMessage(payload);
  });
};
