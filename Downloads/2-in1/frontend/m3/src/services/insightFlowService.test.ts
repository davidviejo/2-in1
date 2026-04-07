import { describe, expect, it } from 'vitest';
import { buildInsightFlowTrace, buildTaskFromInsight } from './insightFlowService';
import { SeoInsight } from '../types/seoInsights';
import { GSCRow } from '../types';

const mockInsight: SeoInsight = {
  id: 'quickWins',
  title: 'Quick wins de primera página',
  summary: 'Consultas con alta impresión y margen inmediato',
  reason: 'Hay URLs entre posición 6 y 12 con CTR mejorable',
  evidence: [{ label: 'Muestra', value: '10 URLs' }],
  priority: 'high',
  severity: 'high',
  opportunity: 82,
  action: 'Actualizar títulos y snippets',
  status: 'actionable',
  visualContext: { icon: 'zap', tone: 'warning', categoryLabel: 'Opportunity' },
  category: 'opportunity',
  score: 91,
  affectedCount: 14,
  confidence: 88,
  businessValue: 79,
  implementationEase: 60,
  relatedRows: [],
  metrics: {},
};

const mockRow: GSCRow = {
  keys: ['seo tecnico medios', 'https://example.com/seo-tecnico'],
  clicks: 100,
  impressions: 2500,
  ctr: 0.04,
  position: 8.5,
};

describe('insightFlowService', () => {
  it('builds a reusable flow trace from insight and row', () => {
    const trace = buildInsightFlowTrace(mockInsight, mockRow);

    expect(trace.finding).toBe('seo tecnico medios');
    expect(trace.opportunityOrRisk).toBe('opportunity');
    expect(trace.recommendedAction).toBe('Actualizar títulos y snippets');
    expect(trace.source.tool).toBe('seo_dashboard_gsc_insights');
    expect(trace.evidence.some((item) => item.label === 'URL')).toBe(true);
  });

  it('creates a roadmap-ready task preserving flow evidence and impact', () => {
    const task = buildTaskFromInsight(mockInsight, mockRow);

    expect(task.title).toContain('Optimizar: seo tecnico medios');
    expect(task.isInCustomRoadmap).toBe(true);
    expect(task.flow?.impact.score).toBe(91);
    expect(task.flow?.opportunityOrRisk).toBe('opportunity');
  });
});
