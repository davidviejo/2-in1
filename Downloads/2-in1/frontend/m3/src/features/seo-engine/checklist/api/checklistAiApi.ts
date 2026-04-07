import { createHttpClient } from '@/services/httpClient';
import { endpoints } from '@/services/endpoints';
import {
  ChecklistAiDecision,
  ChecklistAiEvaluateResponse,
  ChecklistAiEvaluateResultItem,
  ChecklistAiEvaluatePayload,
} from '../types/checklistAiTypes';

const engineHttpClient = createHttpClient({ service: 'engine' });

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

export type {
  ChecklistAiDecision,
  ChecklistAiEvaluateResponse,
  ChecklistAiEvaluateResultItem,
  ChecklistAiEvaluatePayload,
} from '../types/checklistAiTypes';
