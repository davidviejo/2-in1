import { ChecklistItem, ChecklistKey, ChecklistStatus, SeoPage } from '../types/seoChecklist';
import { SettingsRepository } from './settingsRepository';
import { buildPendingChecks } from '../utils/seoChecklistAiValidation';
import { runChecklistHeuristics } from '../utils/checklistAiHeuristics';
import { analyzeChecklistWithAI, ChecklistAiDecision, ChecklistAiEvaluateResponse } from './checklistAiClient';

export interface SeoChecklistAiSummary {
  updatedChecks: Array<{
    key: ChecklistKey;
    status: ChecklistStatus;
    notes: string;
    evaluationMeta: NonNullable<ChecklistItem['evaluationMeta']>;
  }>;
  heuristicResolvedChecks: Array<{
    key: ChecklistKey;
    status: ChecklistStatus;
    notes: string;
    evaluationMeta: NonNullable<ChecklistItem['evaluationMeta']>;
  }>;
  pendingForAiChecks: ChecklistKey[];
  detectedErrors: string[];
  skippedSiChecks: ChecklistKey[];
  omittedBySi: number;
  attempted: number;
}

const resolveProvider = () => {
  const settings = SettingsRepository.getSettings();
  const openaiApiKey = SettingsRepository.getApiKey('openai');
  if (openaiApiKey) {
    return { provider: 'openai' as const, apiKey: openaiApiKey, model: settings.openaiModel || 'gpt-4o-mini' };
  }

  const geminiApiKey = SettingsRepository.getApiKey('gemini');
  if (geminiApiKey) {
    return { provider: 'gemini' as const, apiKey: geminiApiKey, model: settings.geminiModel || 'gemini-1.5-pro' };
  }

  const mistralApiKey = SettingsRepository.getApiKey('mistral');
  if (mistralApiKey) {
    return { provider: 'mistral' as const, apiKey: mistralApiKey, model: settings.mistralModel || 'mistral-large-latest' };
  }

  return null;
};

const decisionToStatus = (decision: ChecklistAiDecision): ChecklistStatus | null => {
  if (decision === 'si_ia') return 'SI_IA';
  if (decision === 'error_claro_ia') return 'ERROR_CLARO_IA';
  return null;
};

export const validateChecklistWithAI = async (page: SeoPage): Promise<SeoChecklistAiSummary> => {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error('No hay API key de IA configurada (OpenAI, Gemini o Mistral).');
  }

  const evaluatedAt = Date.now();
  const { pending, skippedSi } = buildPendingChecks(page);
  const heuristicRun = runChecklistHeuristics(page, pending);
  const heuristicResolvedChecks = heuristicRun.resolvedByHeuristics.map(({ key, status, notes }) => ({
    key,
    status,
    notes,
    evaluationMeta: {
      evaluatedBy: 'heuristic',
      provider: provider.provider,
      model: provider.model,
      evaluatedAt,
      reason: notes,
    },
  }));

  if (heuristicRun.pendingForAI.length === 0) {
    return {
      updatedChecks: [...heuristicResolvedChecks],
      heuristicResolvedChecks,
      pendingForAiChecks: [],
      detectedErrors: [],
      skippedSiChecks: skippedSi.map((item) => item.key),
      omittedBySi: skippedSi.length,
      attempted: heuristicRun.pendingForAI.length,
    };
  }

  const checksPayload = heuristicRun.pendingForAI.map((item) => ({
    key: item.key,
    label: item.label,
    priority: item.priority,
    current_status: item.status_manual,
    notes: item.notes_manual,
    recommendation: item.recommendation || '',
    autoData: item.autoData || null,
  }));

  let parsed: ChecklistAiEvaluateResponse;
  try {
    parsed = await analyzeChecklistWithAI({
      provider: provider.provider,
      apiKey: provider.apiKey,
      model: provider.model,
      context: {
        url: page.url,
        kwPrincipal: page.kwPrincipal || '',
        pageType: page.pageType || '',
      },
      checks: checksPayload,
    });
  } catch (error) {
    throw new Error((error as Error).message || 'La respuesta de IA no valida el esquema requerido.');
  }

  const pendingByKey = new Map(heuristicRun.pendingForAI.map((item) => [item.key, item]));
  const updatedChecks = (parsed.results || [])
    .filter((item) => pendingByKey.has(item.key))
    .map((item) => ({
      key: item.key,
      status: decisionToStatus(item.decision),
      notes: (item.notes || '').trim(),
      error: (item.error || '').trim(),
    }))
    .filter((item) => item.status && item.notes.length > 0)
    .map(({ key, status, notes }) => ({
      key,
      status: status as ChecklistStatus,
      notes,
      evaluationMeta: {
        evaluatedBy: 'ai',
        provider: provider.provider,
        model: provider.model,
        evaluatedAt,
        reason: notes,
      },
    }));

  const detectedErrors = [
    ...(parsed.globalErrors || []),
    ...(parsed.results || [])
      .filter((item) => item.error && pendingByKey.has(item.key))
      .map((item) => `${item.key}: ${item.error}`),
  ];

  return {
    updatedChecks: [...heuristicResolvedChecks, ...updatedChecks],
    heuristicResolvedChecks,
    pendingForAiChecks: heuristicRun.pendingForAI.map((item) => item.key),
    detectedErrors,
    skippedSiChecks: skippedSi.map((item) => item.key),
    omittedBySi: skippedSi.length,
    attempted: heuristicRun.pendingForAI.length,
  };
};
