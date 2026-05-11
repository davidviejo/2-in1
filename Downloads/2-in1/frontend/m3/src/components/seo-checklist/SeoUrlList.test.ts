import { describe, expect, it } from 'vitest';
import { matchesAnalysisAge, matchesPageFilters } from './SeoUrlList';
import { SeoPage } from '../../types/seoChecklist';

const basePage: SeoPage = {
  id: '1',
  url: 'https://example.com/blog/seo-audit',
  kwPrincipal: 'seo audit',
  pageType: 'Blog',
  cluster: 'SEO Técnico',
  checklist: {} as SeoPage['checklist'],
};

describe('SeoUrlList filters', () => {
  const nowMs = new Date('2026-05-11T00:00:00.000Z').getTime();

  it('"No analizadas" incluye solo páginas sin lastAnalyzedAt o fecha inválida', () => {
    const neverAnalyzed = { ...basePage, id: 'never' };
    const invalidDate = { ...basePage, id: 'invalid', lastAnalyzedAt: 'not-a-date' };
    const analyzed = { ...basePage, id: 'analyzed', lastAnalyzedAt: '2026-05-01T00:00:00.000Z' };

    expect(matchesAnalysisAge(neverAnalyzed, 'never', nowMs)).toBe(true);
    expect(matchesAnalysisAge(invalidDate, 'never', nowMs)).toBe(true);
    expect(matchesAnalysisAge(analyzed, 'never', nowMs)).toBe(false);
  });

  it('filtra correctamente por > 1 semana, > 1 mes y > 6 meses', () => {
    const eightDaysOld = { ...basePage, id: '8d', lastAnalyzedAt: '2026-05-02T00:00:00.000Z' };
    const twentyDaysOld = { ...basePage, id: '20d', lastAnalyzedAt: '2026-04-21T00:00:00.000Z' };
    const fortyDaysOld = { ...basePage, id: '40d', lastAnalyzedAt: '2026-04-01T00:00:00.000Z' };
    const sevenMonthsOld = { ...basePage, id: '7m', lastAnalyzedAt: '2025-10-01T00:00:00.000Z' };

    expect(matchesAnalysisAge(eightDaysOld, 'gt_7d', nowMs)).toBe(true);
    expect(matchesAnalysisAge(twentyDaysOld, 'gt_30d', nowMs)).toBe(false);
    expect(matchesAnalysisAge(fortyDaysOld, 'gt_30d', nowMs)).toBe(true);
    expect(matchesAnalysisAge(sevenMonthsOld, 'gt_180d', nowMs)).toBe(true);
  });

  it('combina filtro de texto + filtro temporal por intersección', () => {
    const matchingPage = {
      ...basePage,
      id: 'match',
      url: 'https://example.com/blog/seo-checklist',
      lastAnalyzedAt: '2025-01-01T00:00:00.000Z',
    };
    const wrongText = {
      ...basePage,
      id: 'wrong-text',
      url: 'https://example.com/product/landing',
      lastAnalyzedAt: '2025-01-01T00:00:00.000Z',
    };
    const wrongAge = {
      ...basePage,
      id: 'wrong-age',
      url: 'https://example.com/blog/seo-checklist',
      lastAnalyzedAt: '2026-05-09T00:00:00.000Z',
    };

    expect(matchesPageFilters(matchingPage, 'blog seo', 'gt_30d', nowMs)).toBe(true);
    expect(matchesPageFilters(wrongText, 'blog seo', 'gt_30d', nowMs)).toBe(false);
    expect(matchesPageFilters(wrongAge, 'blog seo', 'gt_30d', nowMs)).toBe(false);
  });
});
