import { ChecklistKey, AnalysisConfigPayload, Capabilities } from '../types/seoChecklist';
import { HttpClientError, createHttpClient } from './httpClient';
import { endpoints } from './endpoints';

const engineHttpClient = createHttpClient({ service: 'engine' });

export const ENGINE_ANALYZE_TIMEOUT_MS = 90000;

export interface AnalysisPayload {
  url: string;
  kwPrincipal: string;
  pageType: string;
  geoTarget?: string;
  cluster?: string;
  pageId: string;
  gscQueries?: any[];
  analysisConfig?: AnalysisConfigPayload;
  analyzeCompetitors?: boolean;
  competitorUrls?: string[];
}

export interface AnalysisResponse {
  pageId: string;
  items: Partial<
    Record<
      ChecklistKey,
      {
        autoData?: any;
        recommendation?: string;
        suggested_status?: string;
      }
    >
  >;
  advancedExecuted?: boolean;
  advancedBlockedReason?: string;
  engineMeta?: {
    requestedProvider: string;
    usedProvider: string;
    fallbackChain: string[];
    providerFailureReasons?: Record<string, string>;
  };
}

export interface BatchJobPayload {
  items: AnalysisPayload[];
  config?: AnalysisConfigPayload;
}

export interface BatchJobResponse {
  id: string;
  message?: string;
}

export type JobStatus = 'pending' | 'paused' | 'processing' | 'done' | 'cancelled' | 'error';

export interface BatchJobStatus {
  id: string;
  status: JobStatus;
  progress: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
  };
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface RunnerHealth {
  started: boolean;
  thread_alive: boolean;
  thread_name?: string | null;
}

export interface BatchJobItem {
  itemId: string; // correlates to pageId
  status: 'pending' | 'paused' | 'processing' | 'done' | 'error';
  url: string;
  error?: string;
  updated_at?: string;
}

type RawBatchJobStatus = {
  id: string;
  status: JobStatus;
  progress: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
  };
  created_at: string;
  completed_at?: string;
  error?: string;
};

type RawBatchJobItemsResponse = {
  items?: any[];
  total?: number;
};

const mapJobStatus = (status?: string): JobStatus => {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'paused':
      return 'paused';
    case 'processing':
      return 'processing';
    case 'done':
      return 'done';
    case 'error':
      return 'error';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const mapItemStatus = (status?: string): BatchJobItem['status'] => {
  const mapped = mapJobStatus(status);
  if (mapped === 'cancelled') {
    return 'error';
  }
  return mapped;
};

const normalizeBatchJob = (raw: RawBatchJobStatus): BatchJobStatus => ({
  id: raw.id,
  status: mapJobStatus(raw.status),
  progress: {
    total: raw.progress?.total ?? 0,
    processed: raw.progress?.processed ?? 0,
    succeeded: raw.progress?.succeeded ?? 0,
    failed: raw.progress?.failed ?? 0,
  },
  created_at: raw.created_at || new Date().toISOString(),
  completed_at: raw.completed_at || undefined,
  error: raw.error || undefined,
});

const normalizeBatchJobItem = (raw: any): BatchJobItem => ({
  itemId: raw.itemId || '',
  status: mapItemStatus(raw.status),
  url: raw.url || '',
  error: raw.error || undefined,
  updated_at: raw.completed_at || undefined,
});

const buildError = (error: unknown, fallback: string): Error => {
  if (error instanceof HttpClientError) {
    return new Error(error.message || fallback);
  }
  return new Error((error as Error)?.message || fallback);
};

export class BatchJobNotFoundError extends Error {
  constructor(message: string = 'Batch job not found') {
    super(message);
    this.name = 'BatchJobNotFoundError';
  }
}

export const getCapabilities = async (): Promise<Capabilities | null> => {
  try {
    const data = await engineHttpClient.get<Capabilities>(endpoints.engine.capabilities());
    return data as Capabilities;
  } catch (error) {
    console.warn('Failed to fetch capabilities:', error);
    return null;
  }
};

export const analyzeUrl = async (
  payload: AnalysisPayload,
  options: { timeoutMs?: number } = {},
): Promise<AnalysisResponse> => {
  const timeoutMs = options.timeoutMs ?? ENGINE_ANALYZE_TIMEOUT_MS;

  try {
    const data = await engineHttpClient.post<AnalysisResponse>(endpoints.engine.analyze(), payload, { timeoutMs });
    return data as AnalysisResponse;
  } catch (error: unknown) {
    console.error('Python Engine Error:', error);

    if (error instanceof HttpClientError && error.isTimeout) {
      throw new Error('El análisis superó el tiempo de espera. Intenta nuevamente.');
    }

    if (error instanceof HttpClientError) {
      throw new Error(error.message || 'Error del backend durante el análisis');
    }

    throw new Error((error as Error)?.message || 'Error connecting to Python Engine');
  }
};

// Batch API Methods

export const createBatchJob = async (payload: BatchJobPayload): Promise<BatchJobResponse> => {
  try {
    return await engineHttpClient.post<BatchJobResponse>(endpoints.engine.jobs(), {
      items: payload.items,
      config: payload.config,
    });
  } catch (error) {
    if (error instanceof HttpClientError && error.status === 404) {
      throw new Error('BATCH_API_NOT_FOUND');
    }
    throw buildError(error, 'Failed to create batch job');
  }
};

export const getBatchJob = async (jobId: string): Promise<BatchJobStatus> => {
  try {
    const response = await engineHttpClient.get<RawBatchJobStatus>(endpoints.engine.byId(jobId));
    return normalizeBatchJob(response);
  } catch (error) {
    if (error instanceof HttpClientError && error.status === 404) {
      throw new BatchJobNotFoundError();
    }
    throw buildError(error, 'Failed to get job status');
  }
};

export const updateBatchJob = async (
  jobId: string,
  action: 'pause' | 'resume' | 'cancel',
): Promise<void> => {
  try {
    await engineHttpClient.post(endpoints.engine.jobAction(jobId, action));
  } catch (error) {
    if (error instanceof HttpClientError && error.status === 404) {
      throw new BatchJobNotFoundError();
    }
    throw buildError(error, 'Failed to update job');
  }
};

export const getBatchJobItems = async (
  jobId: string,
  status?: string,
  page: number = 1,
  limit: number = 50,
): Promise<{ items: BatchJobItem[]; total: number }> => {
  const normalizedStatus = status
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const statusesToFetch = normalizedStatus && normalizedStatus.length > 0 ? normalizedStatus : [undefined];

  const responses: RawBatchJobItemsResponse[] = [];
  for (const statusFilter of statusesToFetch) {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: limit.toString(),
    });
    if (statusFilter) {
      params.append('status', statusFilter);
    }

    try {
      responses.push(
        await engineHttpClient.get<RawBatchJobItemsResponse>(endpoints.engine.jobItems(jobId, params)),
      );
    } catch (error) {
      throw buildError(error, 'Failed to get job items');
    }
  }

  return responses.reduce<{ items: BatchJobItem[]; total: number }>(
    (acc, data) => {
      acc.items.push(...(data.items || []).map(normalizeBatchJobItem));
      acc.total += data.total || 0;
      return acc;
    },
    { items: [] as BatchJobItem[], total: 0 },
  );
};

export const getBatchJobItemResult = async (
  jobId: string,
  itemId: string,
): Promise<AnalysisResponse> => {
  try {
    return await engineHttpClient.get<AnalysisResponse>(endpoints.engine.jobItemResult(jobId, itemId));
  } catch (error) {
    throw buildError(error, 'Failed to get item result');
  }
};

export const getRunnerHealth = async (): Promise<RunnerHealth> => {
  try {
    return await engineHttpClient.get<RunnerHealth>(endpoints.engine.runnerHealth());
  } catch (error) {
    throw buildError(error, 'Failed to get runner health');
  }
};
