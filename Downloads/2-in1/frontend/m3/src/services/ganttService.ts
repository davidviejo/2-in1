import { createHttpClient, HttpClientError } from '@/services/httpClient';

const httpClient = createHttpClient({ service: 'api' });

export interface GanttAnalyzePayloadTask {
  title: string;
  status: string;
  progress: number;
  startDate?: string;
  endDate?: string;
  assignee?: string;
  project?: string;
}

export interface GanttAnalyzeResponse {
  summary: {
    totalTasks: number;
    completionAvg: number;
    statusBreakdown: Record<string, number>;
    overdueCount: number;
    upcomingWeekCount: number;
  };
  overdueTasks: Array<{ title: string; endDate: string; progress: number }>;
  upcomingTasks: Array<{ title: string; endDate: string; progress: number }>;
  recommendations: string[];
}

export const analyzeGantt = async (tasks: GanttAnalyzePayloadTask[]): Promise<GanttAnalyzeResponse> => {
  try {
    return await httpClient.post<GanttAnalyzeResponse>('api/gantt/analyze', { tasks });
  } catch (error) {
    if (error instanceof HttpClientError) {
      throw new Error(error.message || 'No se pudo analizar el Gantt.');
    }
    throw error;
  }
};
