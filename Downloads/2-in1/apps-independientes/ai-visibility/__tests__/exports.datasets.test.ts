import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindManyPrompts,
  mockBuildProjectSummary,
  mockBuildProjectCompetitorComparison,
  mockFindManyResponses,
  mockFindManyCitations
} = vi.hoisted(() => ({
  mockFindManyPrompts: vi.fn(),
  mockBuildProjectSummary: vi.fn(),
  mockBuildProjectCompetitorComparison: vi.fn(),
  mockFindManyResponses: vi.fn(),
  mockFindManyCitations: vi.fn()
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    prompt: {
      findMany: mockFindManyPrompts
    },
    response: {
      findMany: mockFindManyResponses
    },
    citation: {
      findMany: mockFindManyCitations
    }
  }
}));

vi.mock('@/lib/reporting/summary', () => ({
  buildProjectSummary: mockBuildProjectSummary
}));

vi.mock('@/lib/reporting/competitor-comparison', () => ({
  buildProjectCompetitorComparison: mockBuildProjectCompetitorComparison
}));

vi.mock('@/lib/reporting/timeseries', () => ({
  buildProjectTimeseries: vi.fn().mockResolvedValue({
    series: [],
    range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-07T23:59:59.999Z' }
  })
}));

import {
  buildCompetitorsComparisonExport,
  buildNarrativeInsightsDraft,
  buildPromptsTableExport,
  buildSummaryKpiPackExport
} from '@/lib/exports/datasets';

describe('export datasets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindManyResponses.mockResolvedValue([]);
    mockFindManyCitations.mockResolvedValue([]);
  });

  it('builds prompts export with stable column order and UI filters', async () => {
    mockFindManyPrompts.mockResolvedValue([
      {
        id: 'p_1',
        promptText: 'Prompt 1',
        country: 'US',
        language: 'en',
        isActive: true,
        priority: 10,
        intentClassification: 'informational',
        promptTags: [{ tag: { name: 'seo' } }],
        runs: [
          {
            executedAt: new Date('2026-04-15T00:00:00.000Z'),
            responses: [{ brandMentions: [{ id: 'm1' }], citations: [] }]
          }
        ]
      }
    ]);

    const table = await buildPromptsTableExport('project_1', {
      q: 'Prompt',
      country: 'us',
      language: 'EN',
      active: 'active',
      intentClassification: 'info',
      tagIds: 'tag_1,tag_2'
    });

    expect(table.columns.map((column) => column.key)).toEqual([
      'promptId',
      'promptText',
      'country',
      'language',
      'isActive',
      'priority',
      'intentClassification',
      'tags',
      'responsesCount',
      'mentionRate',
      'citationRate',
      'lastRunDate'
    ]);

    const callWhere = mockFindManyPrompts.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(callWhere.country).toBe('US');
    expect(callWhere.language).toBe('en');
    expect(callWhere.isActive).toBe(true);
  });

  it('builds summary export from the same summary payload used by UI', async () => {
    mockBuildProjectSummary.mockResolvedValue({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-07T23:59:59.999Z' },
      summary: {
        totalPrompts: 10,
        promptsExecuted: 8,
        validResponses: 20,
        mentionRate: { value: 0.4 },
        citationRate: { value: 0.5 },
        shareOfVoice: { value: 0.6 },
        sourceShare: { totalCitations: 12 }
      },
      generatedAt: '2026-04-27T00:00:00.000Z'
    });

    const table = await buildSummaryKpiPackExport('project_1', {
      from: '2026-04-01',
      to: '2026-04-07'
    });

    expect(table.rows[0]?.totalPrompts).toBe(10);
    expect(mockBuildProjectSummary).toHaveBeenCalledTimes(1);
  });

  it('builds competitor comparison rows with stable keys', async () => {
    mockBuildProjectCompetitorComparison.mockResolvedValue({
      comparison: {
        mentionShareByBrand: [{ brandKey: 'client', brandName: 'Client', brandType: 'CLIENT', mentionCount: 5, share: 0.5 }],
        citationShareByBrand: {
          rows: [{ brandKey: 'client', citationCount: 4, share: 0.4 }]
        },
        sentimentSummaryByBrand: [
          { brandKey: 'client', buckets: { positive: { share: 0.5 }, neutral: { share: 0.2 }, negative: { share: 0.2 }, other: { share: 0.1 } } }
        ]
      }
    });

    const table = await buildCompetitorsComparisonExport('project_1', {
      from: '2026-04-01',
      to: '2026-04-07'
    });

    expect(table.columns[0]?.key).toBe('brandKey');
    expect(table.rows[0]?.mentionCount).toBe(5);
  });

  it('builds analyst-draft insights with explicit metric grounding', () => {
    const insights = buildNarrativeInsightsDraft({
      summary: {
        dataset: 'summary_kpi_pack',
        suggestedFilename: 'summary',
        columns: [],
        rows: [{ mentionRate: 0.42, citationRate: 0.55, shareOfVoice: 0.61 }]
      },
      promptsPerformance: {
        dataset: 'prompts_performance',
        suggestedFilename: 'prompts',
        columns: [],
        rows: [{ promptId: 'p1', title: 'Best prompt', citationRate: 0.8, validResponses: 10 }]
      },
      citations: {
        dataset: 'citations_table',
        suggestedFilename: 'citations',
        columns: [],
        rows: [{ sourceDomain: 'example.com' }, { sourceDomain: 'example.com' }, { sourceDomain: 'other.com' }]
      },
      competitors: {
        dataset: 'competitors_comparison',
        suggestedFilename: 'comp',
        columns: [],
        rows: [{ brandType: 'COMPETITOR', brandName: 'Rival', mentionShare: 0.4, citationShare: 0.35 }]
      }
    });

    expect(insights.length).toBeGreaterThan(0);
    expect(insights.every((insight) => insight.bullet.startsWith('Analyst draft:'))).toBe(true);
    expect(insights.every((insight) => Object.keys(insight.metrics).length > 0)).toBe(true);
  });
});
