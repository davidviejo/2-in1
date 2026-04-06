import { createHttpClient } from './httpClient';
import { endpoints } from './endpoints';
import { ChecklistKey } from '../types/seoChecklist';

const engineHttpClient = createHttpClient({ service: 'engine' });

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

const isDecision = (value: unknown): value is ChecklistAiDecision =>
  value === 'si_ia' || value === 'error_claro_ia' || value === 'no_decidir';

const isResultItem = (value: unknown): value is ChecklistAiEvaluateResultItem => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === 'string' &&
    isDecision(candidate.decision) &&
    typeof candidate.notes === 'string' &&
    (candidate.error === undefined || typeof candidate.error === 'string')
  );
};

export const isChecklistAiEvaluateResponse = (value: unknown): value is ChecklistAiEvaluateResponse => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.results) || !candidate.results.every(isResultItem)) return false;
  if (
    candidate.globalErrors !== undefined &&
    (!Array.isArray(candidate.globalErrors) || !candidate.globalErrors.every((item) => typeof item === 'string'))
  ) {
    return false;
  }
  return true;
};

export const analyzeChecklistWithAI = async (
  payload: ChecklistAiEvaluatePayload,
): Promise<ChecklistAiEvaluateResponse> => {
  const response = await engineHttpClient.post<unknown>(endpoints.ai.checklistEvaluate(), payload);
  if (!isChecklistAiEvaluateResponse(response)) {
    throw new Error('La respuesta del backend no cumple el esquema esperado para checklist IA.');
  }
  return response;
};
