import { describe, expect, it } from 'vitest';
import {
  buildDefaultRanges,
  buildPeriodRangesFromParams,
  mapPeriodRangesToSearchParams,
  validatePeriodRanges,
} from './gscImpactPeriodRanges';

describe('gscImpactPeriodRanges', () => {
  it('builds ranges from params when all ranges are present', () => {
    const params = new URLSearchParams({
      preStart: '2026-02-01',
      preEnd: '2026-02-05',
      rolloutStart: '2026-02-06',
      rolloutEnd: '2026-02-12',
      postStart: '2026-02-13',
      postEnd: '2026-02-20',
    });

    const result = buildPeriodRangesFromParams(params, '2026-02-10');

    expect(result.hasCompleteRangeParams).toBe(true);
    expect(result.ranges.pre.start).toBe('2026-02-01');
    expect(result.ranges.rollout.end).toBe('2026-02-12');
    expect(result.ranges.post.end).toBe('2026-02-20');
  });

  it('falls back to recommended ranges when params are incomplete', () => {
    const params = new URLSearchParams({
      preStart: '2026-02-01',
      preEnd: '2026-02-05',
    });

    const result = buildPeriodRangesFromParams(params, '2026-02-10');
    const expected = buildDefaultRanges('2026-02-10');

    expect(result.hasCompleteRangeParams).toBe(false);
    expect(result.ranges).toEqual(expected);
  });

  it('maps ranges to query params for sharable URLs', () => {
    const params = new URLSearchParams();
    mapPeriodRangesToSearchParams(params, {
      pre: { start: '2026-01-01', end: '2026-01-10' },
      rollout: { start: '2026-01-11', end: '2026-01-20' },
      post: { start: '2026-01-21', end: '2026-01-31' },
    });

    expect(params.get('preStart')).toBe('2026-01-01');
    expect(params.get('rolloutEnd')).toBe('2026-01-20');
    expect(params.get('postEnd')).toBe('2026-01-31');
  });

  it('returns readable validation messages for invalid date windows', () => {
    const errors = validatePeriodRanges({
      pre: { start: '2026-01-10', end: '2026-01-01' },
      rollout: { start: '2026-01-05', end: '2026-01-15' },
      post: { start: '2026-01-14', end: '2026-01-25' },
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.includes('pre-update'))).toBe(true);
    expect(errors.some((error) => error.includes('solapan'))).toBe(true);
  });
});
