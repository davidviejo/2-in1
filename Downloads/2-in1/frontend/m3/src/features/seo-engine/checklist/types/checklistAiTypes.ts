import { ChecklistKey } from '@/types/seoChecklist';

export type ChecklistAiDecision = 'si_ia' | 'error_claro_ia' | 'no_decidir';

export interface ChecklistAiCheckInput {
  key: ChecklistKey;
  label: string;
  priority: string;
  current_status: string;
  notes: string;
  recommendation: string;
  autoData: unknown;
}

export interface ChecklistAiEvaluatePayload {
  provider: 'openai' | 'gemini' | 'mistral';
  apiKey: string;
  model?: string;
  context: {
    url: string;
    kwPrincipal?: string;
    pageType?: string;
  };
  checks: ChecklistAiCheckInput[];
}

export interface ChecklistAiEvaluateResultItem {
  key: ChecklistKey;
  decision: ChecklistAiDecision;
  notes: string;
  error?: string;
}

export interface ChecklistAiEvaluateResponse {
  results: ChecklistAiEvaluateResultItem[];
  globalErrors?: string[];
}
