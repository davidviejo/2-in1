import { describe, expect, it } from 'vitest';

import { buildTimeseriesFromRecords } from '@/lib/reporting/timeseries-core';

describe('timeseries logic', () => {
  it('zero-fills day buckets and computes requested metrics', () => {
    const range = {
      from: new Date('2026-04-10T00:00:00.000Z'),
      to: new Date('2026-04-12T23:59:59.999Z')
    };

    const responses = [
      {
        id: 'resp_1',
        status: 'SUCCEEDED' as const,
        mentionDetected: true,
        sentiment: 'positive',
        run: {
          id: 'run_1',
          status: 'SUCCEEDED' as const,
          executedAt: new Date('2026-04-10T04:00:00.000Z')
        }
      },
      {
        id: 'resp_2',
        status: 'FAILED' as const,
        mentionDetected: true,
        sentiment: 'positive',
        run: {
          id: 'run_2',
          status: 'SUCCEEDED' as const,
          executedAt: new Date('2026-04-10T20:00:00.000Z')
        }
      }
    ];

    const citations = [{ responseId: 'resp_1' }];
    const mentions = [
      { responseId: 'resp_1', mentionType: 'OWN_BRAND' as const, mentionCount: 3 },
      { responseId: 'resp_1', mentionType: 'COMPETITOR' as const, mentionCount: 1 }
    ];

    const series = buildTimeseriesFromRecords(range, 'day', responses, citations, mentions);

    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({
      periodStart: '2026-04-10T00:00:00.000Z',
      periodEnd: '2026-04-10T23:59:59.999Z',
      values: {
        brand_mentions: 3,
        mention_rate: 1,
        citation_rate: 1,
        share_of_voice: 3 / 4,
        valid_responses: 1,
        sentiment_positive_share: 1
      }
    });

    expect(series[1]?.values).toEqual({
      brand_mentions: 0,
      mention_rate: 0,
      citation_rate: 0,
      share_of_voice: 0,
      valid_responses: 0,
      sentiment_positive_share: 0
    });
  });

  it('uses ISO week boundaries in UTC and clips first/last partial buckets', () => {
    const range = {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-14T23:59:59.999Z')
    };

    const responses = [
      {
        id: 'wk_1',
        status: 'SUCCEEDED' as const,
        mentionDetected: false,
        sentiment: 'neutral',
        run: {
          id: 'run_wk_1',
          status: 'SUCCEEDED' as const,
          executedAt: new Date('2026-01-01T12:00:00.000Z')
        }
      },
      {
        id: 'wk_2',
        status: 'SUCCEEDED' as const,
        mentionDetected: true,
        sentiment: 'positive',
        run: {
          id: 'run_wk_2',
          status: 'SUCCEEDED' as const,
          executedAt: new Date('2026-01-12T05:00:00.000Z')
        }
      }
    ];

    const series = buildTimeseriesFromRecords(range, 'week', responses, [], []);

    expect(series).toHaveLength(3);
    expect(series[0]?.periodStart).toBe('2026-01-01T00:00:00.000Z');
    expect(series[0]?.periodEnd).toBe('2026-01-04T23:59:59.999Z');
    expect(series[2]?.periodStart).toBe('2026-01-12T00:00:00.000Z');
    expect(series[2]?.periodEnd).toBe('2026-01-14T23:59:59.999Z');

    expect(series[1]?.values.valid_responses).toBe(0);
    expect(series[2]?.values.mention_rate).toBe(1);
  });
});
