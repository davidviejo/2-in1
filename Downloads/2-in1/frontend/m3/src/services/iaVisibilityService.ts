import { createHttpClient } from './httpClient';
import { endpoints } from './endpoints';

const httpClient = createHttpClient({ service: 'api' });

export interface IAVisibilityRequest {
  clientId: string;
  brand: string;
  competitors: string[];
  promptTemplate: string;
  sources: string[];
  providerPriority: string[];
}

export interface IAVisibilityResponse {
  clientId: string;
  version?: number;
  runTrigger?: 'manual' | 'scheduled';
  mentions: number;
  shareOfVoice: number;
  sentiment: number;
  competitorAppearances: Record<string, number>;
  rawEvidence: Array<Record<string, unknown>>;
  providerUsed?: string;
}

export interface IAVisibilityConfigResponse {
  status: 'ok';
  config: IAVisibilityRequest & {
    updatedAt?: string;
  };
}

export interface IAVisibilityHistoryResponse {
  clientId: string;
  runs: IAVisibilityResponse[];
}

export interface IAVisibilitySchedule {
  frequency: 'daily' | 'weekly';
  timezone: string;
  runHour: number;
  runMinute: number;
  status: 'active' | 'paused';
  lastRunAt?: string;
  updatedAt?: string;
}

export interface IAVisibilityScheduleResponse {
  status?: 'ok';
  clientId: string;
  schedule: IAVisibilitySchedule;
}

export const iaVisibilityService = {
  run: (payload: IAVisibilityRequest) =>
    httpClient.post<IAVisibilityResponse>(endpoints.ai.visibilityRun(), payload),

  getHistory: (clientId: string) =>
    httpClient.get<IAVisibilityHistoryResponse>(endpoints.ai.visibilityHistory(clientId)),

  saveConfig: (clientId: string, payload: IAVisibilityRequest) =>
    httpClient.post<IAVisibilityConfigResponse>(endpoints.ai.visibilityConfig(clientId), payload),

  getSchedule: (clientId: string) =>
    httpClient.get<IAVisibilityScheduleResponse>(endpoints.ai.visibilitySchedule(clientId)),

  saveSchedule: (clientId: string, payload: Partial<IAVisibilitySchedule>) =>
    httpClient.post<IAVisibilityScheduleResponse>(endpoints.ai.visibilitySchedule(clientId), payload),

  toggleSchedule: (clientId: string, action: 'pause' | 'resume') =>
    httpClient.post<IAVisibilityScheduleResponse>(endpoints.ai.visibilityScheduleAction(clientId, action), {}),
};
