import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSeoInsightState } from './useSeoInsightState';
import { SeoInsight } from '../types/seoInsights';

const buildInsight = (overrides: Partial<SeoInsight> = {}): SeoInsight => ({
  id: 'insight-1',
  category: 'opportunity',
  title: 'Mejorar CTR en top queries',
  priority: 'high',
  severity: 'medium',
  score: 80,
  opportunity: 70,
  confidence: 85,
  status: 'new',
  sourceType: 'query',
  sourceId: 'query-a',
  propertyId: 'sc-domain:example.com',
  ruleKey: 'gsc_query_low_ctr',
  moduleId: 2,
  suggestedAction: 'Optimizar title y meta description para query principal',
  summary: 'Resumen',
  reason: 'Motivo',
  action: 'Acción',
  visualContext: { icon: 'Lightbulb', tone: 'blue', categoryLabel: 'Oportunidad' },
  affectedCount: 1,
  businessValue: 80,
  implementationEase: 60,
  impact: 75,
  urgency: 60,
  ease: 60,
  relatedRows: [],
  evidence: [],
  metrics: {},
  ...overrides,
});

describe('useSeoInsightState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persiste el estado por huella para no reabrir acciones ya resueltas en nuevas corridas', () => {
    const scope = 'client-1:site-a';
    const firstInsight = buildInsight({ id: 'insight-run-1' });

    const { result, unmount } = renderHook(() => useSeoInsightState(scope));

    act(() => {
      result.current.setInsightStatus(firstInsight, 'done');
    });

    unmount();

    const secondInsight = buildInsight({
      id: 'insight-run-2',
      sourceId: 'query-b',
    });

    const { result: secondResult } = renderHook(() => useSeoInsightState(scope));

    expect(secondResult.current.getInsightStatus(secondInsight)).toBe('done');
  });

  it('mantiene compatibilidad cuando solo se informa insightId', () => {
    const scope = 'client-2:site-b';
    const insight = buildInsight({ id: 'legacy-insight' });
    const { result } = renderHook(() => useSeoInsightState(scope));

    act(() => {
      result.current.setInsightStatus(insight.id, 'ignored');
    });

    expect(result.current.getInsightStatus(insight)).toBe('ignored');
  });
});
