import { describe, expect, it } from 'vitest';

import { computeKpis } from '@/lib/kpi/calculations';
import { buildByModelFromInputs } from '@/lib/reporting/by-model-core';
import { buildByPromptReportRows } from '@/lib/reporting/by-prompt-core';

describe('kpi consistency semantics', () => {
  const seeded = {
    prompts: [
      { id: 'p1', title: 'Prompt 1', isActive: true },
      { id: 'p2', title: 'Prompt 2', isActive: true }
    ],
    runs: [
      { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const, analysisMode: 'chatgpt', provider: 'openai', surface: 'chatgpt', model: 'gpt-4o' },
      { id: 'r2', promptId: 'p1', status: 'FAILED' as const, analysisMode: 'chatgpt', provider: 'openai', surface: 'chatgpt', model: 'gpt-4o' },
      { id: 'r3', promptId: 'p2', status: 'SUCCEEDED' as const, analysisMode: 'gemini', provider: 'google', surface: 'gemini', model: 'gemini-1.5-pro' }
    ],
    responses: [
      { id: 'res1', runId: 'r1', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'positive' },
      { id: 'res2', runId: 'r2', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'negative' },
      { id: 'res3', runId: 'r3', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'neutral' }
    ],
    citations: [
      { id: 'c1', responseId: 'res1', sourceDomain: 'a.com' },
      { id: 'c2', responseId: 'res1', sourceDomain: 'a.com' },
      { id: 'c3', responseId: 'res3', sourceDomain: 'b.com' }
    ],
    mentions: []
  };

  it('protects denominator rules by excluding failed runs from mention/citation rates', () => {
    const kpis = computeKpis(seeded);
    expect(kpis.valid_response_count).toBe(2);
    expect(kpis.mention_rate).toEqual({ value: 0.5, numerator: 1, denominator: 2 });
    expect(kpis.citation_rate).toEqual({ value: 1, numerator: 2, denominator: 2 });
  });

  it('keeps previous-period deltas stable for by-prompt rows', () => {
    const current = buildByPromptReportRows(seeded, seeded, 'executions', 'desc')[0];
    expect(current?.deltaVsPrevious.executions.absolute).toBe(0);
    expect(current?.deltaVsPrevious.mentionRate.absolute).toBe(0);
    expect(current?.deltaVsPrevious.citationRate.absolute).toBe(0);
  });

  it('reconciles by-model totals and by-prompt totals with overall valid responses', () => {
    const overall = computeKpis(seeded);
    const byModel = buildByModelFromInputs(seeded);
    const byPrompt = buildByPromptReportRows(seeded, seeded, 'executions', 'desc');

    expect(byModel.reduce((sum, row) => sum + row.summary.validResponses, 0)).toBe(overall.valid_response_count);
    expect(byPrompt.reduce((sum, row) => sum + row.validResponses, 0)).toBe(overall.valid_response_count);
  });

  it('reconciles citation grouping totals back to source-share totals', () => {
    const kpis = computeKpis(seeded);
    const groupedCitationTotal = kpis.source_share.byDomain.reduce((sum, row) => sum + row.citations, 0);
    expect(groupedCitationTotal).toBe(kpis.source_share.totalCitations);
  });
});
