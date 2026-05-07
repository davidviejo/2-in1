export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  status: 'todo' | 'in-progress' | 'done';
  color?: string;
  notes?: string;
  project?: string;
  assignee?: string;
  subtasks?: Subtask[];
  progress?: number;
  dependencies?: string[];
  customFields?: Record<string, string>;
}

export type InputMode = 'manual' | 'ai-text' | 'ai-audio';
export type ViewMode = 'day' | 'week' | 'month';
