import { createHttpClient } from './httpClient';
import { endpoints } from './endpoints';

const httpClient = createHttpClient({ service: 'api' });

export type SeoAnalysisType = 'headline' | 'audit' | 'schema' | 'calendar' | 'competitor' | 'tone' | 'roadmap';

export interface EnhanceTaskPayload {
  task: {
    title?: string;
    description?: string;
    category?: string;
    impact?: string;
  };
  vertical: string;
}

export interface SeoAnalysisPayload {
  content: string;
  type: SeoAnalysisType;
  vertical?: string;
}

export interface ClusterizeAiRequestItem {
  id: string;
  url: string;
  title: string;
  h1: string;
}

export interface ClusterizeAiResponse {
  clusters?: Array<{ id: string; cluster: string; reason?: string }>;
}

export interface AiConfigStatusResponse {
  configured: boolean;
}

export const openaiApi = {
  getConfigStatus: () => httpClient.get<AiConfigStatusResponse>(endpoints.ai.openaiConfigStatus()),
  enhanceTask: (payload: EnhanceTaskPayload) =>
    httpClient.post<{ result: string }>(endpoints.ai.openaiEnhanceTask(), payload),
  seoAnalysis: (payload: SeoAnalysisPayload) =>
    httpClient.post<{ result: string }>(endpoints.ai.openaiSeoAnalysis(), payload),
  clusterize: (items: ClusterizeAiRequestItem[]) =>
    httpClient.post<ClusterizeAiResponse>(endpoints.ai.openaiClusterize(), { items }),
};
