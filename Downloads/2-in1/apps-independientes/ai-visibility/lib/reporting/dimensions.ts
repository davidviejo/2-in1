import { safeTrim } from '@/lib/filters/normalization';

export const ANALYSIS_MODES = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'other'] as const;
export const SURFACES = ['chatgpt', 'gemini', 'google_search', 'google_ai_mode', 'google_ai_overview', 'other'] as const;
export const PROVIDERS = ['openai', 'google', 'dataforseo', 'other'] as const;
export const CAPTURE_METHODS = ['manual_import', 'api', 'browser_capture', 'other'] as const;

export type AnalysisMode = (typeof ANALYSIS_MODES)[number];
export type Surface = (typeof SURFACES)[number];
export type Provider = (typeof PROVIDERS)[number];
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];

function normalizeEnumValue<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  const normalized = safeTrim(value).toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return (allowed as readonly string[]).includes(normalized) ? (normalized as T[number]) : undefined;
}

function normalizeAliasValue(value: unknown): string {
  return safeTrim(value).toLowerCase().replace(/[\s-]+/g, '_');
}

export function normalizeAnalysisMode(value: unknown): AnalysisMode | undefined {
  const aliased = normalizeAliasValue(value);
  if (aliased === 'google_ai_mode' || aliased === 'modo_ia' || aliased === 'google_modo_ia') {
    return 'ai_mode';
  }
  if (aliased === 'google_ai_overview' || aliased === 'google_ai_overviews' || aliased === 'ai_overviews') {
    return 'ai_overview';
  }

  return normalizeEnumValue(aliased, ANALYSIS_MODES);
}

export function normalizeSurface(value: unknown): Surface | undefined {
  const aliased = normalizeAliasValue(value);

  if (aliased === 'ai_mode' || aliased === 'modo_ia') {
    return 'google_ai_mode';
  }

  if (aliased === 'ai_overview' || aliased === 'ai_overviews') {
    return 'google_ai_overview';
  }

  if (aliased === 'chatgpt_api') {
    return 'chatgpt';
  }

  if (aliased === 'gemini_api' || aliased === 'gemini_llm') {
    return 'gemini';
  }

  return normalizeEnumValue(aliased, SURFACES);
}

export function normalizeProvider(value: unknown): Provider | undefined {
  const aliased = normalizeAliasValue(value);
  if (aliased === 'chatgpt' || aliased === 'chatgpt_api') {
    return 'openai';
  }
  if (aliased === 'gemini' || aliased === 'gemini_llm' || aliased === 'google_ai') {
    return 'google';
  }
  if (aliased === 'google_ai_mode' || aliased === 'google_ai_overview' || aliased === 'ai_mode' || aliased === 'ai_overview') {
    return 'dataforseo';
  }

  return normalizeEnumValue(aliased, PROVIDERS);
}

export function normalizeCaptureMethod(value: unknown): CaptureMethod | undefined {
  return normalizeEnumValue(value, CAPTURE_METHODS);
}
