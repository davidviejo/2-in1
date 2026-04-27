import { describe, expect, it } from 'vitest';

import { computeKpis } from '@/lib/kpi/calculations';
import { buildDailyKpiSnapshotPayload, combineDailySnapshotPayloads } from '@/lib/reporting/kpi-snapshots';

describe('daily kpi snapshots', () => {
  it('reconciles snapshot aggregation with direct KPI calculation', () => {
    const prompts = [
      { id: 'p1', title: 'Prompt A', isActive: true },
      { id: 'p2', title: 'Prompt B', isActive: true },
      { id: 'p3', title: 'Prompt C', isActive: true }
    ];

    const day1 = {
      prompts,
      runs: [
        { id: 'r1', promptId: 'p1', status: 'SUCCEEDED' as const },
        { id: 'r2', promptId: 'p2', status: 'FAILED' as const }
      ],
      responses: [
        { id: 'res1', runId: 'r1', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'positive' },
        { id: 'res2', runId: 'r2', status: 'SUCCEEDED' as const, mentionDetected: true, sentiment: 'negative' }
      ],
      citations: [{ id: 'c1', responseId: 'res1', sourceDomain: 'a.com' }],
      mentions: [
        { id: 'm1', responseId: 'res1', mentionType: 'OWN_BRAND' as const, mentionCount: 2 },
        { id: 'm2', responseId: 'res1', mentionType: 'COMPETITOR' as const, mentionCount: 1 }
      ]
    };

    const day2 = {
      prompts,
      runs: [
        { id: 'r3', promptId: 'p1', status: 'SUCCEEDED' as const },
        { id: 'r4', promptId: 'p3', status: 'SUCCEEDED' as const }
      ],
      responses: [
        { id: 'res3', runId: 'r3', status: 'SUCCEEDED' as const, mentionDetected: false, sentiment: 'neutral' },
        { id: 'res4', runId: 'r4', status: 'FAILED' as const, mentionDetected: false, sentiment: null }
      ],
      citations: [
        { id: 'c2', responseId: 'res3', sourceDomain: 'b.com' },
        { id: 'c3', responseId: 'res3', sourceDomain: 'a.com' }
      ],
      mentions: [{ id: 'm3', responseId: 'res3', mentionType: 'COMPETITOR' as const, mentionCount: 1 }]
    };

    const direct = computeKpis({
      prompts,
      runs: [...day1.runs, ...day2.runs],
      responses: [...day1.responses, ...day2.responses],
      citations: [...day1.citations, ...day2.citations],
      mentions: [...day1.mentions, ...day2.mentions]
    });

    const fromSnapshots = combineDailySnapshotPayloads(
      [buildDailyKpiSnapshotPayload(day1), buildDailyKpiSnapshotPayload(day2)],
      { totalPrompts: prompts.length }
    );

    expect(fromSnapshots).not.toBeNull();
    expect(fromSnapshots).toMatchObject(direct);
  });

  it('rejects malformed payloads', () => {
    const result = combineDailySnapshotPayloads([{ schemaVersion: 2 }], { totalPrompts: 1 });
    expect(result).toBeNull();
  });
});
