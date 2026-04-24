import { analyzeGSCInsights } from '../utils/gscInsights';
import { GSCRow, ProjectType } from '../types';
import { SeoInsightDateRange } from '../types/seoInsights';

interface GSCWorkerContext {
  propertyId?: string;
  currentDailyRows?: GSCRow[];
  previousDailyRows?: GSCRow[];
  periodCurrent?: SeoInsightDateRange;
  periodPrevious?: SeoInsightDateRange;
  brandTerms?: string[];
  projectType?: ProjectType;
  analysisProjectTypes?: ProjectType[];
  sector?: string;
  geoScope?: string;
}

interface GSCWorkerChunkPayload {
  period: 'current' | 'previous';
  rows: GSCRow[];
  chunkIndex: number;
  totalChunks: number;
}

type GSCWorkerMessage =
  | { type: 'INIT'; payload: GSCWorkerContext }
  | { type: 'CHUNK'; payload: GSCWorkerChunkPayload }
  | { type: 'FINALIZE' };

type GSCWorkerResponse =
  | { type: 'PROGRESS'; payload: { chunkIndex: number; totalChunks: number; period: 'current' | 'previous' | 'mixed' } }
  | { type: 'SUCCESS'; payload: ReturnType<typeof analyzeGSCInsights> }
  | { type: 'ERROR'; payload: string };

const aggregateRows = (targetMap: Map<string, GSCRow>, rows: GSCRow[]) => {
  rows.forEach((row) => {
    const query = row.keys?.[0] || '';
    const page = row.keys?.[1] || '';
    const key = `${query}||${page}`;

    const existing = targetMap.get(key);
    if (!existing) {
      targetMap.set(key, {
        ...row,
        keys: [query, page],
      });
      return;
    }

    const nextClicks = existing.clicks + row.clicks;
    const nextImpressions = existing.impressions + row.impressions;

    targetMap.set(key, {
      ...existing,
      clicks: nextClicks,
      impressions: nextImpressions,
      ctr: nextImpressions > 0 ? nextClicks / nextImpressions : 0,
      position:
        nextImpressions > 0
          ? ((existing.position * existing.impressions) + (row.position * row.impressions)) / nextImpressions
          : 0,
    });
  });
};

let context: GSCWorkerContext = {};
const currentRowsMap = new Map<string, GSCRow>();
const previousRowsMap = new Map<string, GSCRow>();

addEventListener('message', (e: MessageEvent<GSCWorkerMessage>) => {
  const message = e.data;

  try {
    if (!message || !message.type) {
      postMessage({ type: 'ERROR', payload: 'Invalid worker message format' } satisfies GSCWorkerResponse);
      return;
    }

    if (message.type === 'INIT') {
      context = message.payload || {};
      currentRowsMap.clear();
      previousRowsMap.clear();
      return;
    }

    if (message.type === 'CHUNK') {
      const chunkPayload = message.payload;
      if (!chunkPayload || !Array.isArray(chunkPayload.rows)) {
        postMessage({ type: 'ERROR', payload: 'Invalid chunk format: expected rows array' } satisfies GSCWorkerResponse);
        return;
      }

      if (chunkPayload.period === 'current') {
        aggregateRows(currentRowsMap, chunkPayload.rows);
      } else {
        aggregateRows(previousRowsMap, chunkPayload.rows);
      }

      postMessage({
        type: 'PROGRESS',
        payload: {
          chunkIndex: chunkPayload.chunkIndex,
          totalChunks: chunkPayload.totalChunks,
          period: chunkPayload.period,
        },
      } satisfies GSCWorkerResponse);
      return;
    }

    if (message.type === 'FINALIZE') {
      const insights = analyzeGSCInsights({
        currentRows: Array.from(currentRowsMap.values()),
        previousRows: Array.from(previousRowsMap.values()),
        currentDailyRows: context.currentDailyRows || [],
        previousDailyRows: context.previousDailyRows || [],
        propertyId: context.propertyId,
        periodCurrent: context.periodCurrent,
        periodPrevious: context.periodPrevious,
        brandTerms: context.brandTerms,
        projectType: context.projectType,
        analysisProjectTypes: context.analysisProjectTypes,
        sector: context.sector,
        geoScope: context.geoScope,
      });

      postMessage({ type: 'SUCCESS', payload: insights } satisfies GSCWorkerResponse);
    }
  } catch (error) {
    postMessage({
      type: 'ERROR',
      payload: error instanceof Error ? error.message : String(error),
    } satisfies GSCWorkerResponse);
  }
});
