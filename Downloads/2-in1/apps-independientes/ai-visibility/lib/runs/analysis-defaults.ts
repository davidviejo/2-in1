import { safeTrim } from '@/lib/filters/normalization';

type AnalysisDefaults = {
  provider: string;
  surface: string;
  model: string;
};

const DEFAULTS_BY_MODE: Record<string, AnalysisDefaults> = {
  chatgpt: {
    provider: 'openai',
    surface: 'chatgpt',
    model: 'gpt-4.1-mini'
  },
  gemini: {
    provider: 'google',
    surface: 'gemini',
    model: 'gemini-2.5-pro'
  },
  ai_mode: {
    provider: 'dataforseo',
    surface: 'google_ai_mode',
    model: 'dataforseo-google-ai-mode'
  },
  ai_overview: {
    provider: 'dataforseo',
    surface: 'google_ai_overview',
    model: 'dataforseo-google-ai-overview'
  }
};

export function resolveAnalysisDefaults(mode: string): AnalysisDefaults {
  return DEFAULTS_BY_MODE[mode] ?? { provider: 'other', surface: 'other', model: 'unknown' };
}

export function resolveLiveModel(mode: string, requestedModel: unknown): string {
  const normalizedRequested = safeTrim(requestedModel);
  if (normalizedRequested) {
    return normalizedRequested;
  }

  const defaults = resolveAnalysisDefaults(mode);
  if (mode === 'chatgpt') {
    return process.env.OPENAI_DEFAULT_MODEL ?? defaults.model;
  }
  if (mode === 'gemini') {
    return process.env.GEMINI_DEFAULT_MODEL ?? defaults.model;
  }

  return defaults.model;
}
