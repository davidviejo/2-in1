import { describe, expect, it } from 'vitest';
import { computeHybridGlobalScore } from './hybridGlobalScore';
import { ModuleData } from '@/types';
import { SeoInsight } from '@/types/seoInsights';

const baseModules: ModuleData[] = [
  {
    id: 1,
    title: 'M1',
    subtitle: '',
    levelRange: '0-20',
    description: '',
    iconName: 'icon',
    tasks: [
      { id: 'a', title: 'A', description: '', impact: 'High', status: 'completed' },
      { id: 'b', title: 'B', description: '', impact: 'Medium', status: 'pending', isInCustomRoadmap: true },
    ],
  },
  {
    id: 2,
    title: 'M2',
    subtitle: '',
    levelRange: '20-40',
    description: '',
    iconName: 'icon',
    tasks: [{ id: 'c', title: 'C', description: '', impact: 'Low', status: 'completed', isInCustomRoadmap: true }],
  },
];

const buildInsight = (partial: Partial<SeoInsight>): SeoInsight => ({
  id: partial.id || crypto.randomUUID(),
  category: partial.category || 'opportunity',
  title: partial.title || 'Insight',
  priority: partial.priority || 'medium',
  severity: partial.severity || 'medium',
  score: partial.score || 70,
  opportunity: partial.opportunity || 60,
  confidence: partial.confidence || 70,
  metrics: [],
  status: partial.status || 'new',
  findingFamily: partial.findingFamily,
  evidence: [],
  summary: '',
  reason: '',
  action: '',
  visualContext: { icon: 'lightbulb', tone: 'neutral', categoryLabel: 'test' },
  affectedCount: 0,
  businessValue: 60,
  implementationEase: 50,
  impact: 60,
  urgency: 50,
  ease: 50,
  relatedRows: [],
});

describe('computeHybridGlobalScore', () => {
  it('uses real performance signals to improve global score', () => {
    const result = computeHybridGlobalScore({
      modules: baseModules,
      structuralScore: 58,
      performance: {
        current: { clicks: 1200, ctr: 4.2, position: 7.8 },
        previous: { clicks: 900, ctr: 3.4, position: 8.9 },
      },
      nonBrand: { currentClicks: 620, previousClicks: 480 },
      insights: [
        buildInsight({ id: 'q1', findingFamily: 'quick_win', status: 'done' }),
        buildInsight({ id: 'q2', findingFamily: 'quick_win', status: 'planned' }),
        buildInsight({ id: 'r1', category: 'risk', status: 'new' }),
      ],
      propertyId: 'sc-domain:demo.com',
      periodCurrent: '2026-03-01..2026-03-28',
      periodPrevious: '2026-02-01..2026-02-28',
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.globalScore).toBeGreaterThanOrEqual(50);
    expect(result.performanceSubscore).toBeGreaterThan(50);
    expect(result.driversUp.length).toBeGreaterThan(0);
  });

  it('falls back gracefully when GSC metrics are missing', () => {
    const result = computeHybridGlobalScore({
      modules: baseModules,
      structuralScore: 62,
      performance: {
        current: { clicks: 0, ctr: 0, position: 0 },
        previous: { clicks: 0, ctr: 0, position: 0 },
      },
      nonBrand: { currentClicks: 0, previousClicks: 0 },
      insights: [],
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.globalScore).toBeGreaterThan(0);
    expect(result.performanceSubscore).toBeGreaterThan(0);
  });
});
