import { describe, expect, it } from 'vitest';

import { buildByPromptReportRows } from '@/lib/reporting/by-prompt-core';

describe('by-prompt reporting logic', () => {
  it('computes requested prompt-level KPIs and delta vs previous period', () => {
    const current = {
      prompts: [
        {
          id: 'p1',
          title: 'Prompt A',
          promptText: 'Prompt A text',
          country: 'US',
          language: 'en',
          tags: [{ id: 't1', name: 'brand' }]
        }
      ],
      runs: [
        { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const, model: 'GPT-4O' },
        { id: 'r2', promptId: 'p1', status: 'SUCCEEDED' as const, model: 'gpt-4o' },
        { id: 'r3', promptId: 'p1', status: 'FAILED' as const, model: 'claude-3-5' }
      ],
      responses: [
        { id: 'res1', runId: 'r1', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'positive' },
        { id: 'res2', runId: 'r2', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'neutral' },
        { id: 'res3', runId: 'r3', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'negative' }
      ],
      citations: [
        { id: 'c1', responseId: 'res1', sourceDomain: 'news.com' },
        { id: 'c2', responseId: 'res1', sourceDomain: 'docs.com' },
        { id: 'c3', responseId: 'res2', sourceDomain: 'news.com' }
      ],
      mentions: [
        { id: 'm1', responseId: 'res1', mentionType: 'COMPETITOR' as const, mentionCount: 1 },
        { id: 'm2', responseId: 'res2', mentionType: 'OWN_BRAND' as const, mentionCount: 3 }
      ]
    };

    const previous = {
      prompts: current.prompts,
      runs: [{ id: 'pr1', promptId: 'p1', status: 'SUCCEEDED' as const, model: 'gpt-4o' }],
      responses: [{ id: 'pres1', runId: 'pr1', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'neutral' }],
      citations: [],
      mentions: []
    };

    const rows = buildByPromptReportRows(current, previous, 'executions', 'desc');

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.promptId).toBe('p1');
    expect(row.executions).toBe(3);
    expect(row.validResponses).toBe(2);
    expect(row.mentionRate).toEqual({ value: 0.5, numerator: 1, denominator: 2 });
    expect(row.citationRate).toEqual({ value: 1, numerator: 2, denominator: 2 });
    expect(row.topCitedDomains[0]).toEqual({ domain: 'news.com', citations: 2, share: 2 / 3 });
    expect(row.topModels[0]).toEqual({ model: 'gpt-4o', executions: 2, share: 2 / 3 });
    expect(row.competitorPresence).toEqual({ value: 0.5, numerator: 1, denominator: 2 });
    expect(row.sentimentSummary.denominator).toBe(2);
    expect(row.sentimentSummary.buckets.positive.count).toBe(1);
    expect(row.sentimentSummary.buckets.neutral.count).toBe(1);

    expect(row.deltaVsPrevious.executions.absolute).toBe(2);
    expect(row.deltaVsPrevious.validResponses.absolute).toBe(1);
    expect(row.deltaVsPrevious.citationRate.absolute).toBe(1);
  });

  it('sorts rows by selected core metric', () => {
    const period = {
      prompts: [
        { id: 'p1', title: 'Prompt A', promptText: 'A', country: 'US', language: 'en', tags: [] },
        { id: 'p2', title: 'Prompt B', promptText: 'B', country: 'US', language: 'en', tags: [] }
      ],
      runs: [
        { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const, model: 'gpt-4o' },
        { id: 'r2', promptId: 'p2', status: 'SUCCEEDED' as const, model: 'gpt-4o' }
      ],
      responses: [
        { id: 'res1', runId: 'r1', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'positive' },
        { id: 'res2', runId: 'r2', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'neutral' }
      ],
      citations: [{ id: 'c1', responseId: 'res1', sourceDomain: 'a.com' }],
      mentions: []
    };

    const rows = buildByPromptReportRows(period, period, 'mentionRate', 'asc');
    expect(rows.map((row) => row.promptId)).toEqual(['p2', 'p1']);
  });
});
