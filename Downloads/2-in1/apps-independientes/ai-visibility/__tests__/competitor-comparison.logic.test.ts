import { describe, expect, it } from 'vitest';

import { buildCompetitorComparison } from '@/lib/reporting/competitor-comparison-core';

describe('competitor comparison core', () => {
  it('builds mention share, citation share, sentiment summary and prompt insights', () => {
    const result = buildCompetitorComparison({
      clientBrandName: 'Acme',
      clientDomain: 'acme.com',
      competitors: [
        { id: 'c1', name: 'Globex', domain: 'globex.com' },
        { id: 'c2', name: 'Initech', domain: 'initech.com' }
      ],
      prompts: [
        { id: 'p1', title: 'Prompt 1' },
        { id: 'p2', title: 'Prompt 2' }
      ],
      runs: [
        { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' },
        { id: 'r2', promptId: 'p2', status: 'SUCCEEDED' }
      ],
      responses: [
        { id: 'resp1', runId: 'r1', status: 'SUCCEEDED', sentiment: 'positive' },
        { id: 'resp2', runId: 'r2', status: 'SUCCEEDED', sentiment: 'negative' }
      ],
      mentions: [
        { responseId: 'resp1', mentionType: 'OWN_BRAND', competitorId: null, mentionCount: 2 },
        { responseId: 'resp1', mentionType: 'COMPETITOR', competitorId: 'c1', mentionCount: 1 },
        { responseId: 'resp2', mentionType: 'COMPETITOR', competitorId: 'c2', mentionCount: 3 }
      ],
      citations: [
        { responseId: 'resp1', sourceDomain: 'acme.com' },
        { responseId: 'resp1', sourceDomain: 'globex.com' },
        { responseId: 'resp2', sourceDomain: 'unknown.org' }
      ]
    });

    expect(result.mentionShareByBrand).toEqual([
      expect.objectContaining({ brandKey: 'client', mentionCount: 2, share: 2 / 6 }),
      expect.objectContaining({ brandKey: 'competitor:c1', mentionCount: 1, share: 1 / 6 }),
      expect.objectContaining({ brandKey: 'competitor:c2', mentionCount: 3, share: 3 / 6 })
    ]);

    expect(result.citationShareByBrand.denominator).toBe(2);
    expect(result.citationShareByBrand.unmatchedCitationCount).toBe(1);
    expect(result.citationShareByBrand.rows.find((row) => row.brandKey === 'client')).toEqual(
      expect.objectContaining({ citationCount: 1, share: 0.5 })
    );

    expect(result.sentimentSummaryByBrand.find((row) => row.brandKey === 'client')).toEqual(
      expect.objectContaining({
        denominator: 1,
        buckets: expect.objectContaining({
          positive: expect.objectContaining({ count: 1, share: 1 })
        })
      })
    );

    const globex = result.competitorPromptInsights.find((row) => row.competitorId === 'c1');
    expect(globex?.strongestPrompt).toEqual(
      expect.objectContaining({ promptId: 'p2', netAdvantage: 0, competitorMentionedResponses: 0, clientMentionedResponses: 0 })
    );
    expect(globex?.weakestPrompt).toEqual(expect.objectContaining({ promptId: 'p1', netAdvantage: 0 }));
  });
});
