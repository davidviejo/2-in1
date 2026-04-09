import { createHttpClient, HttpClientError } from '@/services/httpClient';
import { endpoints } from '@/services/endpoints';

const client = createHttpClient({ service: 'api', includeAuth: true, timeoutMs: 45000 });

export interface UrlInspectionRow {
  url: string;
  verdict: string;
  coverageState: string;
  indexingState: string;
  lastCrawlTime?: string | null;
  googleCanonical?: string | null;
  userCanonical?: string | null;
  robotsTxtState?: string | null;
  pageFetchState?: string | null;
  crawledAs?: string | null;
  mobileUsabilityVerdict?: string | null;
  richResultsVerdict?: string | null;
  referringUrls?: string[];
}

export interface UrlInspectionErrorItem {
  url: string;
  attempts: number;
  error: {
    code: string;
    status?: number;
    message?: string;
  };
}

export interface UrlInspectionBatchResponse {
  status: 'ok' | 'partial' | 'error';
  siteUrl: string;
  languageCode: string;
  results: UrlInspectionRow[];
  errors: UrlInspectionErrorItem[];
  meta: {
    requestedCount: number;
    processedCount: number;
    successCount: number;
    errorCount: number;
    quotaHit: boolean;
    maxUrlsPerRequest: number;
    maxRetries: number;
  };
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isTransientError = (error: unknown) => {
  if (!(error instanceof HttpClientError)) return false;
  if (typeof error.status === 'number' && (error.status === 429 || error.status >= 500)) return true;
  const code = error.payload?.code;
  return code === 'transient_google_error' || code === 'quota_exceeded';
};

export const inspectUrlsBatch = async (
  siteUrl: string,
  urls: string[],
  options: { languageCode?: string; retries?: number } = {},
): Promise<UrlInspectionBatchResponse> => {
  const retries = Math.max(0, options.retries ?? 1);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await client.post<UrlInspectionBatchResponse>(endpoints.gsc.inspectUrlsBatch(), {
        siteUrl,
        urls,
        languageCode: options.languageCode,
      });
    } catch (error) {
      lastError = error;
      const shouldRetry = isTransientError(error) && attempt < retries;
      if (!shouldRetry) {
        throw error;
      }
      await wait(500 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No se pudo completar URL Inspection');
};
