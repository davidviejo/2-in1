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
