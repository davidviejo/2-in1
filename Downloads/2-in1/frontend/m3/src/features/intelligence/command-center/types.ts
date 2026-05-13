export type DataMode = 'real' | 'partial' | 'mock';
export type Level = 'low' | 'medium' | 'high';

export interface CommandCenterPriority {
  id: string;
  projectId: string;
  title: string;
  type: string;
  sourceModule: string;
  targetType: 'url' | 'query' | 'cluster' | 'task' | 'module' | 'project';
  target: string;
  moduleId?: number;
  score: number;
  impact: Level;
  confidence: number;
  effort: Level;
  urgency: Level;
  reason: string;
  recommendation: string;
  status: 'new' | 'reviewed' | 'dismissed' | 'sent_to_task' | 'sent_to_roadmap' | 'brief_generated';
  createdAt: string;
  dataMode: DataMode;
}

export interface DataSourceStatus {
  source: string;
  status: 'connected' | 'partial' | 'missing' | 'error' | 'mock';
  message: string;
}
