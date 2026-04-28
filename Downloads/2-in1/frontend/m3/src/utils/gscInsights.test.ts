import { describe, it, expect } from 'vitest';
import { analyzeGSCInsights, analyzeQuickWins, analyzeCannibalization } from './gscInsights';
import { GSCRow } from '../types';

describe('GSC Insights Engine', () => {
  const currentRows: GSCRow[] = [
    { keys: ['quick win', 'https://site.com/qw'], clicks: 20, impressions: 1000, ctr: 0.02, position: 5 },
    { keys: ['striking', 'https://site.com/sd'], clicks: 10, impressions: 900, ctr: 0.011, position: 12 },
    { keys: ['low ctr', 'https://site.com/ctr'], clicks: 2, impressions: 500, ctr: 0.004, position: 3 },
    { keys: ['decline', 'https://site.com/drop'], clicks: 30, impressions: 600, ctr: 0.05, position: 6 },
    { keys: ['cannibal', 'https://site.com/a'], clicks: 50, impressions: 800, ctr: 0.06, position: 3 },
    { keys: ['cannibal', 'https://site.com/b'], clicks: 40, impressions: 700, ctr: 0.057, position: 5 },
  ];

  const previousRows: GSCRow[] = [
    { keys: ['decline', 'https://site.com/drop'], clicks: 60, impressions: 650, ctr: 0.092, position: 4 },
    { keys: ['quick win', 'https://site.com/qw'], clicks: 18, impressions: 920, ctr: 0.019, position: 6 },
  ];

  it('builds prioritized insights with grouped summaries', () => {
    const result = analyzeGSCInsights({
      currentRows,
      previousRows,
      projectType: 'ECOM',
      analysisProjectTypes: ['ECOM', 'LOCAL'],
      sector: 'Legal',
    });

    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.groupedInsights.length).toBeGreaterThan(0);
    expect(result.insights[0].score).toBeGreaterThanOrEqual(result.insights.at(-1)?.score || 0);
    expect(result.insights.some((insight) => insight.id.startsWith('decliningPages-'))).toBe(true);
    expect(result.insights.some((insight) => insight.id.startsWith('quickWins-'))).toBe(true);
    expect(result.insights.some((insight) => insight.ruleScope === 'generic')).toBe(true);
    expect(result.insights.some((insight) => insight.ruleScope === 'project_type')).toBe(true);
    expect(result.insights.some((insight) => insight.ruleScope === 'sector')).toBe(true);
  });

  it('keeps legacy quick wins adapter working', () => {
    const result = analyzeQuickWins(currentRows);
    expect(result.title).toContain('Posiciones 4–10');
    expect(result.items.map((i) => i.keys[0])).toContain('quick win');
  });

  it('detects cannibalization when two URLs compete for the same query', () => {
    const result = analyzeCannibalization(currentRows);
    expect(result.count).toBe(1);
    expect(result.items[0].keys[0]).toBe('cannibal');
    expect(result.items[0].keys[1]).toBe('https://site.com/a');
  });

  it('builds quick wins aligned with current project type only', () => {
    const result = analyzeGSCInsights({
      currentRows: [
        { keys: ['comprar zapatillas', 'https://shop.com/category/zapatillas'], clicks: 25, impressions: 900, ctr: 0.02, position: 6 },
        { keys: ['zapatillas running', 'https://shop.com/category/running'], clicks: 18, impressions: 850, ctr: 0.018, position: 7 },
        { keys: ['marca zapatillas', 'https://shop.com/pdp/zapa-1'], clicks: 30, impressions: 400, ctr: 0.075, position: 4 },
      ],
      projectType: 'ECOM',
      analysisProjectTypes: ['MEDIA', 'LOCAL'],
      sector: 'Ecommerce Generalista',
    });

    const quickWinIds = result.quickWinsLayer.map((insight) => insight.id);
    expect(quickWinIds.some((id) => id.startsWith('ecomCategoryPositions410-'))).toBe(true);
    expect(quickWinIds.some((id) => id.startsWith('mediaLowCtrTop10-'))).toBe(false);
    expect(result.quickWinsLayer.every((insight) => insight.applicableProjectTypes?.includes('ECOM'))).toBe(true);
  });

  it('detects real daily anomalies with z-score and seasonal baseline', () => {
    const currentDailyRows: GSCRow[] = [
      { keys: ['2026-02-25'], clicks: 116, impressions: 1000, ctr: 0.116, position: 1 },
      { keys: ['2026-02-26'], clicks: 121, impressions: 1000, ctr: 0.121, position: 1 },
      { keys: ['2026-02-27'], clicks: 118, impressions: 1000, ctr: 0.118, position: 1 },
      { keys: ['2026-02-28'], clicks: 122, impressions: 1000, ctr: 0.122, position: 1 },
      { keys: ['2026-03-01'], clicks: 110, impressions: 1000, ctr: 0.11, position: 1 },
      { keys: ['2026-03-02'], clicks: 120, impressions: 1000, ctr: 0.12, position: 1 },
      { keys: ['2026-03-03'], clicks: 115, impressions: 1000, ctr: 0.115, position: 1 },
      { keys: ['2026-03-04'], clicks: 118, impressions: 1000, ctr: 0.118, position: 1 },
      { keys: ['2026-03-05'], clicks: 122, impressions: 1000, ctr: 0.122, position: 1 },
      { keys: ['2026-03-06'], clicks: 119, impressions: 1000, ctr: 0.119, position: 1 },
      { keys: ['2026-03-07'], clicks: 121, impressions: 1000, ctr: 0.121, position: 1 },
      { keys: ['2026-03-08'], clicks: 116, impressions: 1000, ctr: 0.116, position: 1 },
      { keys: ['2026-03-09'], clicks: 117, impressions: 1000, ctr: 0.117, position: 1 },
      { keys: ['2026-03-10'], clicks: 18, impressions: 1000, ctr: 0.018, position: 1 },
    ];
    const previousDailyRows: GSCRow[] = [
      { keys: ['2026-02-15'], clicks: 108, impressions: 950, ctr: 0.113, position: 1 },
      { keys: ['2026-02-16'], clicks: 122, impressions: 980, ctr: 0.124, position: 1 },
      { keys: ['2026-02-17'], clicks: 116, impressions: 990, ctr: 0.117, position: 1 },
      { keys: ['2026-02-18'], clicks: 120, impressions: 995, ctr: 0.121, position: 1 },
      { keys: ['2026-02-19'], clicks: 124, impressions: 998, ctr: 0.124, position: 1 },
      { keys: ['2026-02-20'], clicks: 118, impressions: 1001, ctr: 0.118, position: 1 },
      { keys: ['2026-02-21'], clicks: 122, impressions: 1003, ctr: 0.122, position: 1 },
      { keys: ['2026-02-22'], clicks: 112, impressions: 1000, ctr: 0.112, position: 1 },
      { keys: ['2026-02-23'], clicks: 121, impressions: 980, ctr: 0.123, position: 1 },
      { keys: ['2026-02-24'], clicks: 117, impressions: 980, ctr: 0.119, position: 1 },
      { keys: ['2026-02-25'], clicks: 119, impressions: 980, ctr: 0.121, position: 1 },
      { keys: ['2026-02-26'], clicks: 123, impressions: 980, ctr: 0.125, position: 1 },
      { keys: ['2026-02-27'], clicks: 120, impressions: 980, ctr: 0.122, position: 1 },
      { keys: ['2026-02-28'], clicks: 124, impressions: 980, ctr: 0.126, position: 1 },
    ];

    const result = analyzeGSCInsights({
      currentRows,
      previousRows,
      currentDailyRows,
      previousDailyRows,
      projectType: 'MEDIA',
    });

    expect(result.insights.some((insight) => insight.id.startsWith('dailyClickAnomaly-'))).toBe(true);
    expect(result.insights.some((insight) => insight.id.startsWith('seasonalDropAnomaly-'))).toBe(true);
    expect(result.seasonality.count).toBeGreaterThan(0);
  });
});
