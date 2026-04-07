import { createHttpClient } from '@/services/httpClient';
import { endpoints } from '@/services/endpoints';
import {
  IAVisibilityConfigResponse,
  IAVisibilityHistoryResponse,
  IAVisibilityRequest,
  IAVisibilityResponse,
  IAVisibilitySchedule,
  IAVisibilityScheduleResponse,
} from '../types/visibilityTypes';

const httpClient = createHttpClient({ service: 'api' });

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
