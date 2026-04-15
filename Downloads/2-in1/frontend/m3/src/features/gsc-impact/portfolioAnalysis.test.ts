import { describe, expect, it } from 'vitest';
import { buildPortfolioPropertyRow, detectPortfolioPatterns, summarizePortfolioStatusCounts } from './portfolioAnalysis';
import { NormalizedComparison } from './impactAnalysis';

const buildSummary = (overrides?: Partial<NormalizedComparison>): NormalizedComparison => ({
  pre: { clicks: 1000, impressions: 10000, ctr: 0.1, position: 6, days: 14, clicksPerDay: 71.4, impressionsPerDay: 714.2 },
  rollout: { clicks: 880, impressions: 9300, ctr: 0.094, position: 7.2, days: 14, clicksPerDay: 62.8, impressionsPerDay: 664.2 },
  post: { clicks: 760, impressions: 9800, ctr: 0.0775, position: 8.1, days: 14, clicksPerDay: 54.2, impressionsPerDay: 700 },
  postVsPre: {
    clicksPerDay: { absolute: -17.2, pct: -0.24 },
    impressionsPerDay: { absolute: -14.2, pct: -0.02 },
    ctr: { absolute: -0.0225, pct: -0.225 },
    position: { absolute: 2.1, pct: 0.35 },
  },
  ...overrides,
});

describe('portfolioAnalysis', () => {
  it('classifies deteriorated rows with risk-driven status', () => {
    const total = buildSummary();
    const brand = buildSummary({ postVsPre: { ...buildSummary().postVsPre, clicksPerDay: { absolute: -4.1, pct: -0.1 } } });
    const nonBrand = buildSummary({ postVsPre: { ...buildSummary().postVsPre, clicksPerDay: { absolute: -11.6, pct: -0.3 } } });

    const row = buildPortfolioPropertyRow({ property: 'https://example.com', total, brand, nonBrand });

    expect(['atención', 'riesgo', 'urgente']).toContain(row.status);
    expect(row.riskScore).toBeGreaterThan(30);
  });

  it('builds aggregate signals and status counts', () => {
    const rows = [
      buildPortfolioPropertyRow({ property: 'https://a.com', total: buildSummary(), brand: buildSummary(), nonBrand: buildSummary() }),
      buildPortfolioPropertyRow({
        property: 'https://b.com',
        total: buildSummary({
          post: { ...buildSummary().pre, clicks: 1200, clicksPerDay: 85, ctr: 0.12, position: 5.2 },
          postVsPre: {
            clicksPerDay: { absolute: 13.6, pct: 0.19 },
            impressionsPerDay: { absolute: 120, pct: 0.16 },
            ctr: { absolute: 0.02, pct: 0.2 },
            position: { absolute: -0.8, pct: -0.13 },
          },
        }),
        brand: buildSummary(),
        nonBrand: buildSummary(),
      }),
    ];

    const counts = summarizePortfolioStatusCounts(rows);
    const patterns = detectPortfolioPatterns(rows);

    expect(counts.total).toBe(2);
    expect(patterns.length).toBeGreaterThan(0);
  });
});
