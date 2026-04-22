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
    expect(result.items[0].keys[1]).toContain('URLs');
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
});
