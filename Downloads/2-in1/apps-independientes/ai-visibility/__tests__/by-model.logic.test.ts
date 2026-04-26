import { describe, expect, it } from 'vitest';

import { computeKpis } from '@/lib/kpi/calculations';
import { buildByModelFromInputs } from '@/lib/reporting/by-model-core';

describe('by-model reporting logic', () => {
  it('normalizes model labels and computes per-model KPIs with summary denominator rules', () => {
    const data = {
      prompts: [
        { id: 'p1', title: 'Prompt A', isActive: true },
        { id: 'p2', title: 'Prompt B', isActive: true }
      ],
      runs: [
        { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const, model: ' GPT-4O ' },
        { id: 'r2', promptId: 'p2', status: 'SUCCEEDED' as const, model: 'gpt-4o' },
        { id: 'r3', promptId: 'p2', status: 'FAILED' as const, model: 'claude-3-5' }
      ],
      responses: [
        { id: 'res1', runId: 'r1', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'positive' },
        { id: 'res2', runId: 'r2', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'neutral' },
        { id: 'res3', runId: 'r3', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'negative' }
      ],
      citations: [
        { id: 'c1', responseId: 'res1', sourceDomain: 'News.com' },
        { id: 'c2', responseId: 'res1', sourceDomain: 'news.com' },
        { id: 'c3', responseId: 'res2', sourceDomain: 'docs.example.org' },
        { id: 'c4', responseId: 'res3', sourceDomain: 'ignored.invalid' }
      ],
      mentions: [
        { id: 'm1', responseId: 'res1', mentionType: 'OWN_BRAND' as const, mentionCount: 2 },
        { id: 'm2', responseId: 'res1', mentionType: 'COMPETITOR' as const, mentionCount: 1 },
        { id: 'm3', responseId: 'res2', mentionType: 'COMPETITOR' as const, mentionCount: 1 },
        { id: 'm4', responseId: 'res3', mentionType: 'OWN_BRAND' as const, mentionCount: 99 }
      ]
    };

    const result = buildByModelFromInputs(data);

    expect(result.map((row) => row.model)).toEqual(['claude-3-5', 'gpt-4o']);

    const gpt4o = result.find((row) => row.model === 'gpt-4o');
    expect(gpt4o).toBeDefined();
    expect(gpt4o?.summary.validResponses).toBe(2);
    expect(gpt4o?.summary.mentionRate).toEqual({ value: 0.5, numerator: 1, denominator: 2 });
    expect(gpt4o?.summary.citationRate).toEqual({ value: 1, numerator: 2, denominator: 2 });
    expect(gpt4o?.summary.sourceShare.totalCitations).toBe(3);
    expect(gpt4o?.summary.sentimentDistribution.denominator).toBe(2);
    expect(gpt4o?.summary.topCitedDomains[0]).toEqual({ domain: 'news.com', citations: 2, share: 2 / 3 });
    expect(gpt4o?.summary.strongestPrompts.length).toBeGreaterThan(0);
    expect(gpt4o?.summary.weakestPrompts.length).toBeGreaterThan(0);

    const claude = result.find((row) => row.model === 'claude-3-5');
    expect(claude).toBeDefined();
    expect(claude?.summary.validResponses).toBe(0);
    expect(claude?.summary.mentionRate).toEqual({ value: null, numerator: 0, denominator: 0 });
    expect(claude?.summary.citationRate).toEqual({ value: null, numerator: 0, denominator: 0 });
  });

  it('reconciles per-model totals with overall summary KPIs', () => {
    const data = {
      prompts: [
        { id: 'p1', title: 'Prompt A', isActive: true },
        { id: 'p2', title: 'Prompt B', isActive: true }
      ],
      runs: [
        { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const, model: 'gpt-4o' },
        { id: 'r2', promptId: 'p1', status: 'SUCCEEDED' as const, model: 'claude-3-5' },
        { id: 'r3', promptId: 'p2', status: 'SUCCEEDED' as const, model: 'gpt-4o' }
      ],
      responses: [
        { id: 'res1', runId: 'r1', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'positive' },
        { id: 'res2', runId: 'r2', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'negative' },
        { id: 'res3', runId: 'r3', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'neutral' }
      ],
      citations: [
        { id: 'c1', responseId: 'res1', sourceDomain: 'a.com' },
        { id: 'c2', responseId: 'res2', sourceDomain: 'b.com' }
      ],
      mentions: [
        { id: 'm1', responseId: 'res1', mentionType: 'OWN_BRAND' as const, mentionCount: 2 },
        { id: 'm2', responseId: 'res1', mentionType: 'COMPETITOR' as const, mentionCount: 1 },
        { id: 'm3', responseId: 'res2', mentionType: 'OWN_BRAND' as const, mentionCount: 1 },
        { id: 'm4', responseId: 'res3', mentionType: 'COMPETITOR' as const, mentionCount: 3 }
      ]
    };

    const overall = computeKpis(data);
    const byModel = buildByModelFromInputs(data);

    const validResponses = byModel.reduce((sum, row) => sum + row.summary.validResponses, 0);
    const mentionNumerator = byModel.reduce((sum, row) => sum + row.summary.mentionRate.numerator, 0);
    const mentionDenominator = byModel.reduce((sum, row) => sum + row.summary.mentionRate.denominator, 0);
    const citationNumerator = byModel.reduce((sum, row) => sum + row.summary.citationRate.numerator, 0);
    const citationDenominator = byModel.reduce((sum, row) => sum + row.summary.citationRate.denominator, 0);
    const citations = byModel.reduce((sum, row) => sum + row.summary.sourceShare.totalCitations, 0);
    const sentimentDenominator = byModel.reduce((sum, row) => sum + row.summary.sentimentDistribution.denominator, 0);

    expect(validResponses).toBe(overall.valid_response_count);
    expect(mentionNumerator).toBe(overall.mention_rate.numerator);
    expect(mentionDenominator).toBe(overall.mention_rate.denominator);
    expect(citationNumerator).toBe(overall.citation_rate.numerator);
    expect(citationDenominator).toBe(overall.citation_rate.denominator);
    expect(citations).toBe(overall.source_share.totalCitations);
    expect(sentimentDenominator).toBe(overall.sentiment_distribution.denominator);
  });
});
