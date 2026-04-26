import { describe, expect, it } from 'vitest';

import { computeKpis } from '@/lib/kpi/calculations';

describe('kpi logic', () => {
  it('computes all KPI summaries from detail records', () => {
    const prompts = [
      { id: 'p1', title: 'Prompt A', isActive: true },
      { id: 'p2', title: 'Prompt B', isActive: true },
      { id: 'p3', title: 'Prompt C', isActive: true }
    ];

    const runs = [
      { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const },
      { id: 'r2', promptId: 'p1', status: 'SUCCEEDED' as const },
      { id: 'r3', promptId: 'p2', status: 'FAILED' as const },
      { id: 'r4', promptId: 'p2', status: 'SUCCEEDED' as const }
    ];

    const responses = [
      { id: 'res1', runId: 'r1', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'positive' },
      { id: 'res2', runId: 'r2', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'neutral' },
      { id: 'res3', runId: 'r3', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'negative' },
      { id: 'res4', runId: 'r4', status: 'FAILED' as const, mentionDetected: false, sentiment: null }
    ];

    const citations = [
      { id: 'c1', responseId: 'res1', sourceDomain: 'News.com' },
      { id: 'c2', responseId: 'res1', sourceDomain: 'news.com' },
      { id: 'c3', responseId: 'res2', sourceDomain: ' docs.example.org ' },
      { id: 'c4', responseId: 'res3', sourceDomain: 'ignored.invalid' }
    ];

    const mentions = [
      { id: 'm1', responseId: 'res1', mentionType: 'OWN_BRAND' as const, mentionCount: 2 },
      { id: 'm2', responseId: 'res1', mentionType: 'COMPETITOR' as const, mentionCount: 1 },
      { id: 'm3', responseId: 'res2', mentionType: 'COMPETITOR' as const, mentionCount: 1 },
      { id: 'm4', responseId: 'res3', mentionType: 'OWN_BRAND' as const, mentionCount: 99 }
    ];

    const result = computeKpis({ prompts, runs, responses, citations, mentions, topN: 2 });

    expect(result.prompt_coverage).toEqual({ value: 2 / 3, numerator: 2, denominator: 3 });
    expect(result.valid_response_count).toBe(2);

    expect(result.mention_rate).toEqual({
      value: 1 / 2,
      numerator: 1,
      denominator: 2
    });

    expect(result.citation_rate).toEqual({
      value: 1,
      numerator: 2,
      denominator: 2
    });

    expect(result.share_of_voice).toEqual({
      value: 2 / 4,
      ownBrandMentions: 2,
      totalTrackedMentions: 4
    });

    expect(result.source_share.totalCitations).toBe(3);
    expect(result.source_share.byDomain).toEqual([
      { domain: 'news.com', citations: 2, share: 2 / 3 },
      { domain: 'docs.example.org', citations: 1, share: 1 / 3 }
    ]);

    expect(result.sentiment_distribution).toEqual({
      denominator: 2,
      buckets: {
        positive: { count: 1, share: 1 / 2 },
        neutral: { count: 1, share: 1 / 2 },
        negative: { count: 0, share: 0 },
        other: { count: 0, share: 0 }
      }
    });

    expect(result.top_cited_domains).toEqual([
      { domain: 'news.com', citations: 2, share: 2 / 3 },
      { domain: 'docs.example.org', citations: 1, share: 1 / 3 }
    ]);

    expect(result.top_prompts.map((row) => row.promptId)).toEqual(['p1']);
    expect(result.weakest_prompts.map((row) => row.promptId)).toEqual(['p1']);

    expect(result.run_outcomes).toEqual({
      totalRuns: 4,
      failedRuns: 1,
      noResultRuns: 1
    });
  });

  it('uses null for zero denominators and still tracks failed/no-result runs explicitly', () => {
    const result = computeKpis({
      prompts: [{ id: 'p1', title: 'Prompt A', isActive: true }],
      runs: [
        { id: 'r1', promptId: 'p1', status: 'FAILED' },
        { id: 'r2', promptId: 'p1', status: 'SUCCEEDED' }
      ],
      responses: [{ id: 'res1', runId: 'r1', status: 'SUCCEEDED', mentionDetected: true, sentiment: 'positive' }],
      citations: [{ id: 'c1', responseId: 'res1', sourceDomain: 'ignored.com' }],
      mentions: [{ id: 'm1', responseId: 'res1', mentionType: 'OWN_BRAND', mentionCount: 5 }]
    });

    expect(result.valid_response_count).toBe(0);
    expect(result.mention_rate.value).toBeNull();
    expect(result.citation_rate.value).toBeNull();
    expect(result.share_of_voice.value).toBeNull();
    expect(result.sentiment_distribution.denominator).toBe(0);
    expect(result.sentiment_distribution.buckets.positive.share).toBeNull();
    expect(result.source_share.totalCitations).toBe(0);
    expect(result.top_prompts).toEqual([]);
    expect(result.weakest_prompts).toEqual([]);

    expect(result.run_outcomes).toEqual({
      totalRuns: 2,
      failedRuns: 1,
      noResultRuns: 1
    });
  });

  it('proves KPI ratios are reproducible from returned detail-derived numerators/denominators', () => {
    const result = computeKpis({
      prompts: [{ id: 'p1', title: 'Prompt A', isActive: true }],
      runs: [{ id: 'r1', promptId: 'p1', status: 'SUCCEEDED' }],
      responses: [{ id: 'res1', runId: 'r1', status: 'SUCCEEDED', mentionDetected: true, sentiment: 'other-label' }],
      citations: [
        { id: 'c1', responseId: 'res1', sourceDomain: 'alpha.com' },
        { id: 'c2', responseId: 'res1', sourceDomain: 'beta.com' }
      ],
      mentions: [
        { id: 'm1', responseId: 'res1', mentionType: 'OWN_BRAND', mentionCount: 3 },
        { id: 'm2', responseId: 'res1', mentionType: 'COMPETITOR', mentionCount: 1 }
      ]
    });

    expect(result.mention_rate.value).toBe(result.mention_rate.numerator / result.mention_rate.denominator);
    expect(result.citation_rate.value).toBe(result.citation_rate.numerator / result.citation_rate.denominator);
    expect(result.prompt_coverage.value).toBe(result.prompt_coverage.numerator / result.prompt_coverage.denominator);
    expect(result.share_of_voice.value).toBe(result.share_of_voice.ownBrandMentions / result.share_of_voice.totalTrackedMentions);

    const totalSourceShare = result.source_share.byDomain.reduce((sum, row) => sum + row.share, 0);
    expect(totalSourceShare).toBe(1);

    const sentimentShares = Object.values(result.sentiment_distribution.buckets).reduce((sum, bucket) => {
      return sum + (bucket.share ?? 0);
    }, 0);
    expect(sentimentShares).toBe(1);
  });
});
