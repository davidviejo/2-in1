import { describe, expect, it } from 'vitest';

import { getPreviousComparableRange, validateSummaryDateRange } from '@/lib/reporting/summary-validation';

describe('summary date range validation', () => {
  it('accepts valid YYYY-MM-DD ranges and computes UTC boundaries', () => {
    const result = validateSummaryDateRange('2026-04-10', '2026-04-14');

    expect(result.errors).toBeUndefined();
    expect(result.values?.from.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(result.values?.to.toISOString()).toBe('2026-04-14T23:59:59.999Z');
  });

  it('rejects missing and invalid dates', () => {
    expect(validateSummaryDateRange(null, null).errors).toEqual({
      from: 'from is required in YYYY-MM-DD format.',
      to: 'to is required in YYYY-MM-DD format.'
    });

    expect(validateSummaryDateRange('2026-14-99', 'oops').errors).toEqual({
      from: 'from must be a valid date in YYYY-MM-DD format.',
      to: 'to must be a valid date in YYYY-MM-DD format.'
    });
  });

  it('computes the previous comparable period with identical duration', () => {
    const current = validateSummaryDateRange('2026-04-10', '2026-04-14').values;
    expect(current).toBeDefined();

    const previous = getPreviousComparableRange(current!);

    expect(previous.from.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    expect(previous.to.toISOString()).toBe('2026-04-09T23:59:59.999Z');
  });
});
