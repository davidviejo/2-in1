import { validateSummaryDateRange } from '@/lib/reporting/summary-validation';

import type { SummaryDateRange } from '@/lib/reporting/summary-validation';

export type TimeseriesGranularity = 'day' | 'week';

export type TimeseriesQuery = {
  range: SummaryDateRange;
  granularity: TimeseriesGranularity;
  timezone: 'UTC';
};

export type TimeseriesValidationResult = {
  values?: TimeseriesQuery;
  errors?: Record<string, string>;
};

export function validateTimeseriesQuery(
  fromRaw: string | null,
  toRaw: string | null,
  granularityRaw: string | null
): TimeseriesValidationResult {
  const rangeResult = validateSummaryDateRange(fromRaw, toRaw);
  const errors: Record<string, string> = { ...(rangeResult.errors ?? {}) };

  const normalizedGranularity = (granularityRaw ?? '').trim().toLowerCase();
  let granularity: TimeseriesGranularity | null = null;

  if (!granularityRaw) {
    errors.granularity = 'granularity is required and must be one of: day, week.';
  } else if (normalizedGranularity !== 'day' && normalizedGranularity !== 'week') {
    errors.granularity = 'granularity must be one of: day, week.';
  } else {
    granularity = normalizedGranularity;
  }

  if (Object.keys(errors).length > 0 || !rangeResult.values || !granularity) {
    return { errors };
  }

  return {
    values: {
      range: rangeResult.values,
      granularity,
      timezone: 'UTC'
    }
  };
}
