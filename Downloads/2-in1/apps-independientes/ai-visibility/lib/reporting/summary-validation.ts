export type SummaryDateRange = {
  from: Date;
  to: Date;
};

export type SummaryValidationResult = {
  values?: SummaryDateRange;
  errors?: Record<string, string>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDayUtc(value: string | null, boundary: 'start' | 'end'): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const iso = boundary === 'start' ? `${trimmed}T00:00:00.000Z` : `${trimmed}T23:59:59.999Z`;
  const parsed = new Date(iso);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateSummaryDateRange(fromRaw: string | null, toRaw: string | null): SummaryValidationResult {
  const errors: Record<string, string> = {};

  const from = parseDayUtc(fromRaw, 'start');
  const to = parseDayUtc(toRaw, 'end');

  if (!fromRaw) {
    errors.from = 'from is required in YYYY-MM-DD format.';
  } else if (!from) {
    errors.from = 'from must be a valid date in YYYY-MM-DD format.';
  }

  if (!toRaw) {
    errors.to = 'to is required in YYYY-MM-DD format.';
  } else if (!to) {
    errors.to = 'to must be a valid date in YYYY-MM-DD format.';
  }

  if (from && to && from > to) {
    errors.range = 'from must be before or equal to to.';
  }

  if (from && to) {
    const durationMs = to.getTime() - from.getTime() + 1;
    if (durationMs > 365 * DAY_MS) {
      errors.range = 'date range cannot exceed 365 days.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      from: from as Date,
      to: to as Date
    }
  };
}

export function getPreviousComparableRange(range: SummaryDateRange): SummaryDateRange {
  const durationMs = range.to.getTime() - range.from.getTime() + 1;
  const previousTo = new Date(range.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - durationMs + 1);

  return {
    from: previousFrom,
    to: previousTo
  };
}
