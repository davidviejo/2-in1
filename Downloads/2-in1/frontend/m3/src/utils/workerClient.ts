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

interface GSCWorkerInitMessage {
  type: 'INIT';
  payload: Omit<GSCWorkerPayload, 'currentRows' | 'previousRows'>;
}

interface GSCWorkerChunkMessage {
  type: 'CHUNK';
  payload: {
    period: 'current' | 'previous';
    rows: GSCRow[];
    chunkIndex: number;
    totalChunks: number;
  };
}

interface GSCWorkerFinalizeMessage {
  type: 'FINALIZE';
}

type GSCWorkerClientMessage = GSCWorkerInitMessage | GSCWorkerChunkMessage | GSCWorkerFinalizeMessage;

type GSCWorkerServerMessage =
  | { type: 'PROGRESS'; payload: { chunkIndex: number; totalChunks: number; period: 'current' | 'previous' | 'mixed' } }
  | { type: 'SUCCESS'; payload: GSCInsights }
  | { type: 'ERROR'; payload: string };

export type GSCInsights = GSCInsightsEngineResult;

export interface AnalysisWorkerProgress {
  chunkIndex: number;
  totalChunks: number;
  period: 'current' | 'previous' | 'mixed';
}

const chunkArray = <T,>(rows: T[], chunkSize: number): T[][] => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
};

export const runAnalysisInWorker = (
  payload: GSCWorkerPayload,
  options?: {
    chunkSize?: number;
    onProgress?: (progress: AnalysisWorkerProgress) => void;
  },
): Promise<GSCInsights> => {
  const chunkSize = Math.max(1000, options?.chunkSize || 20000);

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/gscInsights.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e: MessageEvent<GSCWorkerServerMessage>) => {
      const { type, payload: messagePayload } = e.data;
      if (type === 'PROGRESS') {
        options?.onProgress?.(messagePayload);
        return;
      }

      if (type === 'SUCCESS') {
        resolve(messagePayload);
      } else {
        reject(new Error(messagePayload || 'Unknown worker error'));
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };

    const currentChunks = chunkArray(payload.currentRows || [], chunkSize);
    const previousChunks = chunkArray(payload.previousRows || [], chunkSize);
    const totalChunks = currentChunks.length + previousChunks.length;

    const initMessage: GSCWorkerClientMessage = {
      type: 'INIT',
      payload: {
        propertyId: payload.propertyId,
        periodCurrent: payload.periodCurrent,
        periodPrevious: payload.periodPrevious,
        brandTerms: payload.brandTerms,
        projectType: payload.projectType,
        analysisProjectTypes: payload.analysisProjectTypes,
        sector: payload.sector,
        geoScope: payload.geoScope,
      },
    };

    worker.postMessage(initMessage);

    let chunkIndex = 0;
    currentChunks.forEach((rows) => {
      chunkIndex += 1;
      const message: GSCWorkerClientMessage = {
        type: 'CHUNK',
        payload: {
          rows,
          period: 'current',
          chunkIndex,
          totalChunks,
        },
      };
      worker.postMessage(message);
    });

    previousChunks.forEach((rows) => {
      chunkIndex += 1;
      const message: GSCWorkerClientMessage = {
        type: 'CHUNK',
        payload: {
          rows,
          period: 'previous',
          chunkIndex,
          totalChunks,
        },
      };
      worker.postMessage(message);
    });

    const finalizeMessage: GSCWorkerClientMessage = { type: 'FINALIZE' };
    worker.postMessage(finalizeMessage);
  });
};
