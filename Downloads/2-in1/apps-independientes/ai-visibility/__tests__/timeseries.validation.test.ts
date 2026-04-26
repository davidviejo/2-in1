import { describe, expect, it } from 'vitest';

import { validateTimeseriesQuery } from '@/lib/reporting/timeseries-validation';

describe('timeseries query validation', () => {
  it('accepts valid day granularity and emits UTC day boundaries', () => {
    const result = validateTimeseriesQuery('2026-04-10', '2026-04-14', 'day');

    expect(result.errors).toBeUndefined();
    expect(result.values?.granularity).toBe('day');
    expect(result.values?.timezone).toBe('UTC');
    expect(result.values?.range.from.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(result.values?.range.to.toISOString()).toBe('2026-04-14T23:59:59.999Z');
  });

  it('rejects missing/invalid granularity and invalid date ranges', () => {
    expect(validateTimeseriesQuery(null, null, null).errors).toEqual({
      from: 'from is required in YYYY-MM-DD format.',
      to: 'to is required in YYYY-MM-DD format.',
      granularity: 'granularity is required and must be one of: day, week.'
    });

    expect(validateTimeseriesQuery('2026-04-10', '2026-04-14', 'month').errors).toEqual({
      granularity: 'granularity must be one of: day, week.'
    });
  });
});
