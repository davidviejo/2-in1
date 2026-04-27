import { normalizeCountry, normalizeLanguage, normalizeModelLabel } from '@/lib/filters/normalization';
import { normalizeAnalysisMode, normalizeCaptureMethod, normalizeProvider, normalizeSurface } from '@/lib/reporting/dimensions';

export type ReportingFilters = {
  provider?: string;
  surface?: string;
  analysisMode?: string;
  modelLabel?: string;
  captureMethod?: string;
  country?: string;
  language?: string;
  promptId?: string;
};

export function normalizeReportingFilters(input: Partial<ReportingFilters>): ReportingFilters {
  return {
    provider: normalizeProvider(input.provider),
    surface: normalizeSurface(input.surface),
    analysisMode: normalizeAnalysisMode(input.analysisMode),
    modelLabel: normalizeModelLabel(input.modelLabel),
    captureMethod: normalizeCaptureMethod(input.captureMethod),
    country: normalizeCountry(input.country),
    language: normalizeLanguage(input.language),
    promptId: input.promptId?.trim() || undefined
  };
}

export function toRunWhereFilters(filters: ReportingFilters) {
  return {
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.surface ? { surface: filters.surface } : {}),
    ...(filters.analysisMode ? { analysisMode: filters.analysisMode } : {}),
    ...(filters.modelLabel ? { model: filters.modelLabel } : {}),
    ...(filters.captureMethod ? { captureMethod: filters.captureMethod } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.promptId ? { promptId: filters.promptId } : {})
  };
}
