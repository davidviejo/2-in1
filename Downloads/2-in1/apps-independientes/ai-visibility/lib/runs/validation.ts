import { normalizeCountry, normalizeLanguage, normalizeModelLabel, normalizeSearchTerm, parseDateRange, safeTrim } from '@/lib/filters/normalization';
import { ANALYSIS_MODES, PROVIDERS, SURFACES, normalizeAnalysisMode, normalizeCaptureMethod, normalizeProvider, normalizeSurface } from '@/lib/reporting/dimensions';

export type RunStatusValue = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
export type RunSourceValue = 'UI' | 'API' | 'BACKFILL' | 'IMPORT_FILE';
export type RunTriggerTypeValue = 'MANUAL' | 'SCHEDULED' | 'IMPORT' | 'API';
export type ResponseStatusValue = 'SUCCEEDED' | 'FAILED' | 'CANCELED';
export type MentionTypeValue = 'OWN_BRAND' | 'COMPETITOR';

export type ValidationResult<T> = {
  values?: T;
  errors?: Record<string, string>;
};

export type CreateRunInput = {
  promptId: string;
  provider: string;
  surface: string;
  analysisMode: string;
  model: string;
  captureMethod: string;
  source: RunSourceValue;
  triggerType: RunTriggerTypeValue;
  environment: string | null;
  country: string | null;
  language: string | null;
  parserVersion: string | null;
  rawRequestMetadata: Record<string, unknown> | null;
};

export type UpdateRunStatusInput = {
  status: RunStatusValue;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  response: {
    rawText: string;
    cleanedText: string;
    status: ResponseStatusValue;
    language: string | null;
    mentionDetected: boolean;
    mentionType: MentionTypeValue | null;
    sentiment: string | null;
  } | null;
};

export type RunListFilters = {
  projectId: string;
  promptId?: string;
  status?: RunStatusValue;
  provider?: string;
  surface?: string;
  analysisMode?: string;
  model?: string;
  captureMethod?: string;
  source?: RunSourceValue;
  environment?: string;
  country?: string;
  language?: string;
  startedFrom?: Date;
  startedTo?: Date;
  completedFrom?: Date;
  completedTo?: Date;
  page: number;
  pageSize: number;
};

const RUN_STATUS_LIST = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED'] as const;
const RUN_SOURCE_LIST = ['UI', 'API', 'BACKFILL', 'IMPORT_FILE'] as const;
const RUN_TRIGGER_LIST = ['MANUAL', 'SCHEDULED', 'IMPORT', 'API'] as const;

const RUN_STATUS_VALUES = new Set<RunStatusValue>(RUN_STATUS_LIST);
const TERMINAL_RUN_STATUSES = new Set<RunStatusValue>(['SUCCEEDED', 'FAILED', 'CANCELED']);
const RUN_SOURCE_VALUES = new Set<RunSourceValue>(RUN_SOURCE_LIST);
const RUN_TRIGGER_VALUES = new Set<RunTriggerTypeValue>(RUN_TRIGGER_LIST);
const RESPONSE_STATUS_VALUES = new Set<ResponseStatusValue>(['SUCCEEDED', 'FAILED', 'CANCELED']);
const MENTION_TYPE_VALUES = new Set<MentionTypeValue>(['OWN_BRAND', 'COMPETITOR']);

function asTrimmedString(value: unknown): string {
  return safeTrim(value);
}

function parseDate(raw: string): Date | undefined {
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function validateCreateRunInput(payload: unknown): ValidationResult<CreateRunInput> {
  const errors: Record<string, string> = {};
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  const promptId = asTrimmedString(body.promptId);
  const provider = normalizeProvider(body.provider) ?? '';
  const surface = normalizeSurface(body.surface) ?? '';
  const analysisMode = normalizeAnalysisMode(body.analysisMode) ?? '';
  const model = normalizeModelLabel(body.model) ?? '';
  const captureMethod = normalizeCaptureMethod(body.captureMethod) ?? 'other';
  const environmentRaw = body.environment;
  const parserVersionRaw = body.parserVersion;
  const rawRequestMetadataRaw = body.rawRequestMetadata;
  const country = normalizeCountry(body.country) ?? null;
  const language = normalizeLanguage(body.language) ?? null;

  const sourceRaw = asTrimmedString(body.source).toUpperCase();
  const source = sourceRaw as RunSourceValue;

  const triggerTypeRaw = asTrimmedString(body.triggerType).toUpperCase();
  const triggerType = triggerTypeRaw as RunTriggerTypeValue;

  if (!promptId) {
    errors.promptId = 'Prompt id is required.';
  }

  if (!provider) {
    errors.provider = `Provider is required and must be one of: ${PROVIDERS.join(', ')}.`;
  }

  if (!surface) {
    errors.surface = `Surface is required and must be one of: ${SURFACES.join(', ')}.`;
  }

  if (!analysisMode) {
    errors.analysisMode = `analysisMode is required and must be one of: ${ANALYSIS_MODES.join(', ')}.`;
  }

  if (!model && analysisMode !== 'ai_mode' && analysisMode !== 'ai_overview') {
    errors.model = 'Model is required for this analysis mode.';
  }

  if (!RUN_SOURCE_VALUES.has(source)) {
    errors.source = `Source must be one of: ${Array.from(RUN_SOURCE_VALUES).join(', ')}.`;
  }

  if (!RUN_TRIGGER_VALUES.has(triggerType)) {
    errors.triggerType = `Trigger type must be one of: ${Array.from(RUN_TRIGGER_VALUES).join(', ')}.`;
  }

  if (environmentRaw !== undefined && environmentRaw !== null && typeof environmentRaw !== 'string') {
    errors.environment = 'Environment must be a string when provided.';
  }

  if (parserVersionRaw !== undefined && parserVersionRaw !== null && typeof parserVersionRaw !== 'string') {
    errors.parserVersion = 'Parser version must be a string when provided.';
  }

  if (rawRequestMetadataRaw !== undefined && rawRequestMetadataRaw !== null && typeof rawRequestMetadataRaw !== 'object') {
    errors.rawRequestMetadata = 'Raw request metadata must be an object when provided.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      promptId,
      provider,
      surface,
      analysisMode,
      model: model || 'unknown',
      captureMethod,
      source,
      triggerType,
      environment: typeof environmentRaw === 'string' ? environmentRaw.trim() || null : null,
      country,
      language,
      parserVersion: typeof parserVersionRaw === 'string' ? parserVersionRaw.trim() || null : null,
      rawRequestMetadata: rawRequestMetadataRaw && typeof rawRequestMetadataRaw === 'object' ? (rawRequestMetadataRaw as Record<string, unknown>) : null
    }
  };
}

export function validateUpdateRunStatusInput(payload: unknown): ValidationResult<UpdateRunStatusInput> {
  const errors: Record<string, string> = {};
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  const statusRaw = asTrimmedString(body.status).toUpperCase();
  const status = statusRaw as RunStatusValue;

  if (!RUN_STATUS_VALUES.has(status)) {
    errors.status = `Status must be one of: ${Array.from(RUN_STATUS_VALUES).join(', ')}.`;
  }

  const errorMessageRaw = body.errorMessage;
  if (errorMessageRaw !== undefined && errorMessageRaw !== null && typeof errorMessageRaw !== 'string') {
    errors.errorMessage = 'Error message must be a string when provided.';
  }

  const startedAtRaw = body.startedAt;
  const completedAtRaw = body.completedAt;
  const responseRaw = body.response;

  const startedAt = typeof startedAtRaw === 'string' ? parseDate(startedAtRaw) : startedAtRaw === null || startedAtRaw === undefined ? null : undefined;
  const completedAt = typeof completedAtRaw === 'string' ? parseDate(completedAtRaw) : completedAtRaw === null || completedAtRaw === undefined ? null : undefined;

  if (startedAt === undefined) {
    errors.startedAt = 'startedAt must be an ISO date-time string or null.';
  }

  if (completedAt === undefined) {
    errors.completedAt = 'completedAt must be an ISO date-time string or null.';
  }

  if (status === 'RUNNING' && completedAt) {
    errors.completedAt = 'RUNNING status cannot have completedAt.';
  }

  if ((status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELED') && !completedAt) {
    errors.completedAt = 'Terminal statuses require completedAt.';
  }

  if (status === 'FAILED' && !asTrimmedString(errorMessageRaw)) {
    errors.errorMessage = 'FAILED status requires errorMessage.';
  }

  if (status !== 'FAILED' && asTrimmedString(errorMessageRaw)) {
    errors.errorMessage = 'errorMessage is only allowed for FAILED status.';
  }

  let response: UpdateRunStatusInput['response'] = null;

  if (responseRaw !== undefined && responseRaw !== null && typeof responseRaw !== 'object') {
    errors.response = 'response must be an object when provided.';
  }

  if (responseRaw && typeof responseRaw === 'object') {
    const responseBody = responseRaw as Record<string, unknown>;
    const rawText = asTrimmedString(responseBody.rawText);
    const cleanedText = asTrimmedString(responseBody.cleanedText);
    const responseStatusRaw = asTrimmedString(responseBody.status).toUpperCase();
    const responseStatus = responseStatusRaw as ResponseStatusValue;
    const languageRaw = responseBody.language;
    const mentionDetectedRaw = responseBody.mentionDetected;
    const mentionDetected = mentionDetectedRaw === true ? true : mentionDetectedRaw === false ? false : null;
    const mentionTypeRaw = asTrimmedString(responseBody.mentionType).toUpperCase();
    const mentionType = mentionTypeRaw ? (mentionTypeRaw as MentionTypeValue) : null;
    const sentimentRaw = responseBody.sentiment;

    if (!rawText) {
      errors.responseRawText = 'response.rawText is required when response is provided.';
    }

    if (!RESPONSE_STATUS_VALUES.has(responseStatus)) {
      errors.responseStatus = `response.status must be one of: ${Array.from(RESPONSE_STATUS_VALUES).join(', ')}.`;
    }

    if (languageRaw !== undefined && languageRaw !== null && typeof languageRaw !== 'string') {
      errors.responseLanguage = 'response.language must be a string when provided.';
    }

    if (mentionDetected === null) {
      errors.responseMentionDetected = 'response.mentionDetected must be boolean.';
    }

    if (mentionType && !MENTION_TYPE_VALUES.has(mentionType)) {
      errors.responseMentionType = `response.mentionType must be one of: ${Array.from(MENTION_TYPE_VALUES).join(', ')}.`;
    }

    if (sentimentRaw !== undefined && sentimentRaw !== null && typeof sentimentRaw !== 'string') {
      errors.responseSentiment = 'response.sentiment must be a string when provided.';
    }

    if (mentionDetected === false && mentionType) {
      errors.responseMentionType = 'response.mentionType is only allowed when mentionDetected is true.';
    }

    if (Object.keys(errors).length === 0) {
      response = {
        rawText,
        cleanedText,
        status: responseStatus,
        language: typeof languageRaw === 'string' ? languageRaw.trim() || null : null,
        mentionDetected: mentionDetected ?? false,
        mentionType,
        sentiment: typeof sentimentRaw === 'string' ? sentimentRaw.trim() || null : null
      };
    }
  }

  if (TERMINAL_RUN_STATUSES.has(status) && !response) {
    errors.response = 'Terminal statuses require response payload for auditing.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      status,
      errorMessage: status === 'FAILED' ? asTrimmedString(errorMessageRaw) : null,
      startedAt: startedAt ?? null,
      completedAt: completedAt ?? null,
      response
    }
  };
}

export function parseRunListFilters(projectId: string, searchParams: URLSearchParams): ValidationResult<RunListFilters> {
  const errors: Record<string, string> = {};

  const pageRaw = searchParams.get('page');
  const pageSizeRaw = searchParams.get('pageSize');

  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : 20;

  if (!Number.isInteger(page) || page < 1) {
    errors.page = 'page must be a positive integer.';
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    errors.pageSize = 'pageSize must be between 1 and 100.';
  }

  const statusRaw = safeTrim(searchParams.get('status')).toUpperCase();
  const sourceRaw = safeTrim(searchParams.get('source')).toUpperCase();

  const status = statusRaw as RunStatusValue | undefined;
  const source = sourceRaw as RunSourceValue | undefined;

  if (statusRaw && !RUN_STATUS_VALUES.has(status as RunStatusValue)) {
    errors.status = `status must be one of: ${Array.from(RUN_STATUS_VALUES).join(', ')}.`;
  }

  if (sourceRaw && !RUN_SOURCE_VALUES.has(source as RunSourceValue)) {
    errors.source = `source must be one of: ${Array.from(RUN_SOURCE_VALUES).join(', ')}.`;
  }

  const startedRange = parseDateRange(searchParams.get('startedFrom'), searchParams.get('startedTo'));
  const completedRange = parseDateRange(searchParams.get('completedFrom'), searchParams.get('completedTo'));

  if (startedRange.errors?.from) {
    errors.startedFrom = `startedFrom ${startedRange.errors.from}`;
  }

  if (startedRange.errors?.to) {
    errors.startedTo = `startedTo ${startedRange.errors.to}`;
  }

  if (completedRange.errors?.from) {
    errors.completedFrom = `completedFrom ${completedRange.errors.from}`;
  }

  if (completedRange.errors?.to) {
    errors.completedTo = `completedTo ${completedRange.errors.to}`;
  }

  if (startedRange.errors?.range) {
    errors.startedFrom = 'startedFrom must be before startedTo.';
  }

  if (completedRange.errors?.range) {
    errors.completedFrom = 'completedFrom must be before completedTo.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      projectId,
      promptId: safeTrim(searchParams.get('promptId')) || undefined,
      status,
      provider: normalizeProvider(searchParams.get('provider')),
      surface: normalizeSurface(searchParams.get('surface')),
      analysisMode: normalizeAnalysisMode(searchParams.get('analysisMode')),
      model: normalizeModelLabel(searchParams.get('model')),
      captureMethod: normalizeCaptureMethod(searchParams.get('captureMethod')),
      source,
      environment: normalizeSearchTerm(searchParams.get('environment')) || undefined,
      country: normalizeCountry(searchParams.get('country')),
      language: normalizeLanguage(searchParams.get('language')),
      startedFrom: startedRange.from,
      startedTo: startedRange.to,
      completedFrom: completedRange.from,
      completedTo: completedRange.to,
      page,
      pageSize
    }
  };
}
