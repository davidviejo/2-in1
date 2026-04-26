export type DateRangeResult = {
  from?: Date;
  to?: Date;
  errors?: {
    from?: string;
    to?: string;
    range?: string;
  };
};

const SEARCH_WHITESPACE = /\s+/g;

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function safeTrim(value: unknown, maxLength?: number): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();

  if (typeof maxLength === 'number' && maxLength > 0) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
}

export function normalizeSearchTerm(value: unknown, maxLength = 120): string {
  const normalized = safeTrim(value).replace(SEARCH_WHITESPACE, ' ');
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

export function normalizeCountry(value: unknown): string | undefined {
  const country = safeTrim(value).toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : undefined;
}

export function normalizeLanguage(value: unknown): string | undefined {
  const language = safeTrim(value).toLowerCase();
  return /^[a-z]{2,5}(?:-[a-z]{2,5})?$/.test(language) ? language : undefined;
}

export function normalizeModelLabel(value: unknown): string | undefined {
  const model = safeTrim(value, 100).toLowerCase();
  return model || undefined;
}

export function parseDateRange(fromRaw: string | null | undefined, toRaw: string | null | undefined): DateRangeResult {
  const errors: NonNullable<DateRangeResult['errors']> = {};

  const fromValue = safeTrim(fromRaw);
  const toValue = safeTrim(toRaw);

  const from = fromValue ? parseDate(fromValue) : null;
  const to = toValue ? parseDate(toValue) : null;

  if (fromValue && !from) {
    errors.from = 'must be a valid date.';
  }

  if (toValue && !to) {
    errors.to = 'must be a valid date.';
  }

  if (from && to && from > to) {
    errors.range = 'from must be before to.';
  }

  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(Object.keys(errors).length > 0 ? { errors } : {})
  };
}

export function splitSearchTokens(value: unknown): string[] {
  const normalized = normalizeSearchTerm(value, 400);
  if (!normalized) {
    return [];
  }

  return Array.from(new Set(normalized.toLowerCase().split(' ').filter(Boolean)));
}
