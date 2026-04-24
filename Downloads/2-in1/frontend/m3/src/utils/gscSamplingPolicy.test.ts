import { describe, expect, it } from 'vitest';
import { buildDashboardGscFetchPlan } from './gscSamplingPolicy';

describe('gscSamplingPolicy', () => {
  it('keeps granular daily chunks for short ranges', () => {
    const plan = buildDashboardGscFetchPlan('2026-03-01', '2026-03-28');
    expect(plan.analysisDateChunkSizeDays).toBe(1);
    expect(plan.analysisMaxRows).toBe(160000);
    expect(plan.evolutionDateChunkSizeDays).toBe(7);
  });

  it('expands chunk window and row budget for long ranges', () => {
    const plan = buildDashboardGscFetchPlan('2025-01-01', '2026-04-24');
    expect(plan.analysisDateChunkSizeDays).toBe(28);
    expect(plan.analysisMaxRows).toBe(260000);
    expect(plan.evolutionMaxRows).toBe(280000);
  });

  it('returns safe defaults for invalid ranges', () => {
    const plan = buildDashboardGscFetchPlan('2026-04-24', '2026-04-01');
    expect(plan.analysisDateChunkSizeDays).toBe(1);
    expect(plan.analysisMaxRows).toBe(160000);
  });
});
