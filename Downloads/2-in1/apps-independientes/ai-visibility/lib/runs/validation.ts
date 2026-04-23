export type RunStatusValue = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
export type RunSourceValue = 'UI' | 'API' | 'BACKFILL' | 'IMPORT_FILE';
export type RunTriggerTypeValue = 'MANUAL' | 'SCHEDULED' | 'IMPORT' | 'API';

export type ValidationResult<T> = {
  values?: T;
  errors?: Record<string, string>;
};

export type CreateRunInput = {
  promptId: string;
  provider: string;
  model: string;
  source: RunSourceValue;
  triggerType: RunTriggerTypeValue;
  environment: string | null;
  parserVersion: string | null;
  rawRequestMetadata: Record<string, unknown> | null;
};

export type UpdateRunStatusInput = {
  status: RunStatusValue;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type RunListFilters = {
  projectId: string;
  promptId?: string;
  status?: RunStatusValue;
  provider?: string;
  model?: string;
  source?: RunSourceValue;
  environment?: string;
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
const RUN_SOURCE_VALUES = new Set<RunSourceValue>(RUN_SOURCE_LIST);
const RUN_TRIGGER_VALUES = new Set<RunTriggerTypeValue>(RUN_TRIGGER_LIST);

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDate(raw: string | null | undefined): Date | undefined {
  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function validateCreateRunInput(payload: unknown): ValidationResult<CreateRunInput> {
  const errors: Record<string, string> = {};
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  const promptId = asTrimmedString(body.promptId);
  const provider = asTrimmedString(body.provider);
  const model = asTrimmedString(body.model);
  const environmentRaw = body.environment;
  const parserVersionRaw = body.parserVersion;
  const rawRequestMetadataRaw = body.rawRequestMetadata;

  const sourceRaw = asTrimmedString(body.source).toUpperCase();
  const source = sourceRaw as RunSourceValue;

  const triggerTypeRaw = asTrimmedString(body.triggerType).toUpperCase();
  const triggerType = triggerTypeRaw as RunTriggerTypeValue;

  if (!promptId) {
    errors.promptId = 'Prompt id is required.';
  }

  if (!provider) {
    errors.provider = 'Provider is required.';
  }

  if (!model) {
    errors.model = 'Model is required.';
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
      model,
      source,
      triggerType,
      environment: typeof environmentRaw === 'string' ? environmentRaw.trim() || null : null,
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

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      status,
      errorMessage: status === 'FAILED' ? asTrimmedString(errorMessageRaw) : null,
      startedAt: startedAt ?? null,
      completedAt: completedAt ?? null
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

  const statusRaw = searchParams.get('status')?.trim().toUpperCase();
  const sourceRaw = searchParams.get('source')?.trim().toUpperCase();

  const status = statusRaw as RunStatusValue | undefined;
  const source = sourceRaw as RunSourceValue | undefined;

  if (statusRaw && !RUN_STATUS_VALUES.has(status as RunStatusValue)) {
    errors.status = `status must be one of: ${Array.from(RUN_STATUS_VALUES).join(', ')}.`;
  }

  if (sourceRaw && !RUN_SOURCE_VALUES.has(source as RunSourceValue)) {
    errors.source = `source must be one of: ${Array.from(RUN_SOURCE_VALUES).join(', ')}.`;
  }

  const startedFrom = parseDate(searchParams.get('startedFrom'));
  const startedTo = parseDate(searchParams.get('startedTo'));
  const completedFrom = parseDate(searchParams.get('completedFrom'));
  const completedTo = parseDate(searchParams.get('completedTo'));

  if (searchParams.get('startedFrom') && !startedFrom) {
    errors.startedFrom = 'startedFrom must be a valid date.';
  }

  if (searchParams.get('startedTo') && !startedTo) {
    errors.startedTo = 'startedTo must be a valid date.';
  }

  if (searchParams.get('completedFrom') && !completedFrom) {
    errors.completedFrom = 'completedFrom must be a valid date.';
  }

  if (searchParams.get('completedTo') && !completedTo) {
    errors.completedTo = 'completedTo must be a valid date.';
  }

  if (startedFrom && startedTo && startedFrom > startedTo) {
    errors.startedFrom = 'startedFrom must be before startedTo.';
  }

  if (completedFrom && completedTo && completedFrom > completedTo) {
    errors.completedFrom = 'completedFrom must be before completedTo.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      projectId,
      promptId: searchParams.get('promptId')?.trim() || undefined,
      status,
      provider: searchParams.get('provider')?.trim() || undefined,
      model: searchParams.get('model')?.trim() || undefined,
      source,
      environment: searchParams.get('environment')?.trim() || undefined,
      startedFrom,
      startedTo,
      completedFrom,
      completedTo,
      page,
      pageSize
    }
  };
}
