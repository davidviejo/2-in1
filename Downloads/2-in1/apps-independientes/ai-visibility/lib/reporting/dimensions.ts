import { safeTrim } from '@/lib/filters/normalization';

export const ANALYSIS_MODES = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'other'] as const;
export const SURFACES = ['chatgpt', 'gemini', 'google_search', 'other'] as const;
export const PROVIDERS = ['openai', 'google', 'other'] as const;
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

export function normalizeAnalysisMode(value: unknown): AnalysisMode | undefined {
  return normalizeEnumValue(value, ANALYSIS_MODES);
}

export function normalizeSurface(value: unknown): Surface | undefined {
  return normalizeEnumValue(value, SURFACES);
}

export function normalizeProvider(value: unknown): Provider | undefined {
  return normalizeEnumValue(value, PROVIDERS);
}

export function normalizeCaptureMethod(value: unknown): CaptureMethod | undefined {
  return normalizeEnumValue(value, CAPTURE_METHODS);
}
