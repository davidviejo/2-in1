import { describe, expect, it } from 'vitest';

import { computeKpis } from '@/lib/kpi/calculations';
import { buildByModelFromInputs } from '@/lib/reporting/by-model-core';

describe('by-model reporting logic', () => {
  it('supports provider/surface/analysisMode with unknown model labels', () => {
    const data = {
      prompts: [
        { id: 'p1', title: 'Prompt A', isActive: true },
        { id: 'p2', title: 'Prompt B', isActive: true }
      ],
      runs: [
        { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const, provider: 'openai', surface: 'chatgpt', analysisMode: 'chatgpt', model: ' GPT-4O ' },
        { id: 'r2', promptId: 'p2', status: 'SUCCEEDED' as const, provider: 'google', surface: 'google_search', analysisMode: 'ai_overview', model: 'unknown' },
        { id: 'r3', promptId: 'p2', status: 'FAILED' as const, provider: 'google', surface: 'gemini', analysisMode: 'gemini', model: 'gemini-1.5-pro' }
      ],
      responses: [
        { id: 'res1', runId: 'r1', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'positive' },
        { id: 'res2', runId: 'r2', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'neutral' },
        { id: 'res3', runId: 'r3', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'negative' }
      ],
      citations: [
        { id: 'c1', responseId: 'res1', sourceDomain: 'News.com' },
        { id: 'c2', responseId: 'res2', sourceDomain: 'docs.example.org' }
      ],
      mentions: []
    };

    const result = buildByModelFromInputs(data);
    expect(result.some((row) => row.analysisMode === 'ai_overview' && row.modelLabel === 'unknown')).toBe(true);
    expect(result.some((row) => row.analysisMode === 'chatgpt' && row.modelLabel === 'gpt-4o')).toBe(true);
  });

  it('reconciles per-mode totals with overall summary KPIs', () => {
    const data = {
      prompts: [
        { id: 'p1', title: 'Prompt A', isActive: true },
        { id: 'p2', title: 'Prompt B', isActive: true }
      ],
      runs: [
        { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const, provider: 'openai', surface: 'chatgpt', analysisMode: 'chatgpt', model: 'gpt-4o' },
        { id: 'r2', promptId: 'p1', status: 'SUCCEEDED' as const, provider: 'google', surface: 'gemini', analysisMode: 'gemini', model: 'gemini-1.5-pro' },
        { id: 'r3', promptId: 'p2', status: 'SUCCEEDED' as const, provider: 'google', surface: 'google_search', analysisMode: 'ai_mode', model: 'unknown' }
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
      mentions: []
    };

    const overall = computeKpis(data);
    const byModel = buildByModelFromInputs(data);

    expect(byModel.reduce((sum, row) => sum + row.summary.validResponses, 0)).toBe(overall.valid_response_count);
  });
});
