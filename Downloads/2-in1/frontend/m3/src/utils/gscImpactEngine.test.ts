import { describe, expect, it } from 'vitest';
import { analyzeGscImpact, validateWindowSchema } from './gscImpactEngine';

const validSchema = {
  preUpdate: { start: '2026-01-01', end: '2026-01-10' },
  rollout: { start: '2026-01-11', end: '2026-01-20' },
  postUpdate: { start: '2026-01-21', end: '2026-01-31' },
};

describe('gscImpactEngine', () => {
  it('validates overlapping and empty windows', () => {
    const result = validateWindowSchema({
      preUpdate: { start: '2026-01-10', end: '2026-01-01' },
      rollout: { start: '2026-01-05', end: '2026-01-15' },
      postUpdate: { start: '2026-01-14', end: '2026-01-25' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('empty'))).toBe(true);
    expect(result.errors.some((error) => error.includes('overlap'))).toBe(true);
  });

  it('computes winners and losers by URL and query', () => {
    const result = analyzeGscImpact(
      {
        byUrl: {
          '/winner': {
            preUpdate: { clicks: 100, impressions: 1000, ctr: 0.1, position: 8 },
            rollout: { clicks: 120, impressions: 1100, ctr: 0.11, position: 7 },
            postUpdate: { clicks: 160, impressions: 1300, ctr: 0.123, position: 5 },
          },
          '/loser': {
            preUpdate: { clicks: 100, impressions: 900, ctr: 0.11, position: 4 },
            rollout: { clicks: 90, impressions: 850, ctr: 0.106, position: 5 },
            postUpdate: { clicks: 70, impressions: 800, ctr: 0.0875, position: 7 },
          },
        },
        byQuery: {
          'brand query': {
            preUpdate: { clicks: 40, impressions: 300, ctr: 0.133, position: 3 },
            rollout: { clicks: 44, impressions: 320, ctr: 0.1375, position: 3 },
            postUpdate: { clicks: 55, impressions: 360, ctr: 0.152, position: 2 },
          },
        },
      },
      validSchema,
      { topN: 1 },
    );

    expect(result.windowValidation.valid).toBe(true);
    expect(result.rankingByUrl.winners).toHaveLength(1);
    expect(result.rankingByUrl.winners[0].entity).toBe('/winner');
    expect(result.rankingByUrl.losers).toHaveLength(1);
    expect(result.rankingByUrl.losers[0].entity).toBe('/loser');

    const preToPost = result.rankingByUrl.winners[0].deltas.preToPost;
    expect(preToPost.deltaAbs.clicks).toBe(60);
    expect(preToPost.deltaPct.clicks).toBeCloseTo(0.6);
    expect(preToPost.deltaPosition).toBe(3);

    expect(result.rankingByQuery.winners[0].entity).toBe('brand query');
  });

  it('handles division by zero by emitting null pct deltas and still scoring with available metrics', () => {
    const result = analyzeGscImpact(
      {
        byUrl: {
          '/zero-base': {
            preUpdate: { clicks: 0, impressions: 0, ctr: 0, position: 10 },
            rollout: { clicks: 0, impressions: 10, ctr: 0, position: 9 },
            postUpdate: { clicks: 10, impressions: 50, ctr: 0.2, position: 8 },
          },
        },
        byQuery: {},
      },
      validSchema,
    );

    const first = result.rankingByUrl.all[0];
    expect(first.deltas.preToPost.deltaPct.clicks).toBeNull();
    expect(first.deltas.preToPost.deltaPct.impressions).toBeNull();
    expect(first.deltas.preToPost.deltaPct.ctr).toBeNull();
    expect(first.impactScore).toBeGreaterThan(0);
  });

  it('supports partial datasets and active filters', () => {
    const result = analyzeGscImpact(
      {
        byUrl: {
          '/complete': {
            preUpdate: { clicks: 10, impressions: 100, ctr: 0.1, position: 8 },
            rollout: { clicks: 11, impressions: 110, ctr: 0.1, position: 8 },
            postUpdate: { clicks: 20, impressions: 140, ctr: 0.1428, position: 6 },
          },
          '/partial': {
            preUpdate: { clicks: 5, impressions: 20, ctr: 0.25, position: 3 },
            postUpdate: { clicks: 8, impressions: 30, ctr: 0.266, position: 2 },
          },
        },
        byQuery: {},
      },
      validSchema,
      {
        filters: {
          includePartials: false,
          minImpressions: 50,
          textSearch: 'complete',
        },
      },
    );

    expect(result.rankingByUrl.all).toHaveLength(1);
    expect(result.rankingByUrl.all[0].entity).toBe('/complete');
    expect(result.rankingByUrl.all[0].hasPartialData).toBe(false);
  });
});
