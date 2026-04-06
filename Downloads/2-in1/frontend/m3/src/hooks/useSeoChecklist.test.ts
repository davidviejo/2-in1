import { describe, expect, it } from 'vitest';
import { enforceUniquePrimaryKeywords, mergeChecklistItemWithBusinessRules } from './useSeoChecklist';
import {
  SeoPage,
  CHECKLIST_POINTS,
  ChecklistItem,
  ChecklistKey,
  normalizeChecklistStatus,
} from '../types/seoChecklist';

const buildChecklist = () => {
  const checklist: Record<string, ChecklistItem> = {};
  CHECKLIST_POINTS.forEach((pt) => {
    checklist[pt.key] = {
      key: pt.key,
      label: pt.label,
      status_manual: 'NA',
      notes_manual: '',
    };
  });

  return checklist as Record<ChecklistKey, ChecklistItem>;
};

const buildPage = (overrides: Partial<SeoPage>): SeoPage => ({
  id: overrides.id || crypto.randomUUID(),
  url: overrides.url || 'https://example.com',
  kwPrincipal: overrides.kwPrincipal || '',
  pageType: overrides.pageType || 'Article',
  checklist: overrides.checklist || buildChecklist(),
  ...overrides,
});

describe('enforceUniquePrimaryKeywords', () => {
  it('normalizes legacy checklist statuses for localStorage compatibility', () => {
    expect(normalizeChecklistStatus('SI')).toBe('SI');
    expect(normalizeChecklistStatus('Si (IA)')).toBe('SI_IA');
    expect(normalizeChecklistStatus('error claro (ia)')).toBe('ERROR_CLARO_IA');
    expect(normalizeChecklistStatus('N/A')).toBe('NA');
  });

  it('keeps the duplicated keyword only on the highest-performing URL', () => {
    const pages = [
      buildPage({
        id: 'page-a',
        url: 'https://example.com/a',
        kwPrincipal: 'kw compartida',
        gscMetrics: { clicks: 10, impressions: 100, ctr: 0.1, position: 4 },
      }),
      buildPage({
        id: 'page-b',
        url: 'https://example.com/b',
        kwPrincipal: 'kw compartida',
        gscMetrics: { clicks: 25, impressions: 80, ctr: 0.3125, position: 3 },
      }),
      buildPage({
        id: 'page-c',
        url: 'https://example.com/c',
        kwPrincipal: 'otra kw',
        gscMetrics: { clicks: 5, impressions: 50, ctr: 0.1, position: 6 },
      }),
    ];

    const result = enforceUniquePrimaryKeywords(pages);

    expect(result.find((page) => page.id === 'page-b')?.kwPrincipal).toBe('kw compartida');
    expect(result.find((page) => page.id === 'page-a')?.kwPrincipal).toBe('');
    expect(result.find((page) => page.id === 'page-c')?.kwPrincipal).toBe('otra kw');
  });

  it('reassigns a preserved keyword to another non-brand URL when the current holder becomes brand', () => {
    const pages = [
      buildPage({
        id: 'page-a',
        url: 'https://example.com/a',
        kwPrincipal: '',
        originalKwPrincipal: 'kw compartida',
        gscMetrics: { clicks: 10, impressions: 100, ctr: 0.1, position: 4 },
      }),
      buildPage({
        id: 'page-b',
        url: 'https://example.com/b',
        kwPrincipal: 'kw compartida',
        originalKwPrincipal: 'kw compartida',
        isBrandKeyword: true,
        gscMetrics: { clicks: 25, impressions: 80, ctr: 0.3125, position: 3 },
      }),
    ];

    const result = enforceUniquePrimaryKeywords(pages);

    expect(result.find((page) => page.id === 'page-a')?.kwPrincipal).toBe('kw compartida');
    expect(result.find((page) => page.id === 'page-a')?.originalKwPrincipal).toBe('kw compartida');
    expect(result.find((page) => page.id === 'page-b')?.kwPrincipal).toBe('');
  });

  it('never assigns as primary a keyword that matches a brand term', () => {
    const pages = [
      buildPage({
        id: 'page-brand',
        url: 'https://example.com/brand',
        kwPrincipal: 'comprar zapatillas nike',
        gscMetrics: { clicks: 80, impressions: 500, ctr: 0.16, position: 2 },
      }),
      buildPage({
        id: 'page-generic',
        url: 'https://example.com/generic',
        kwPrincipal: 'comprar zapatillas nike',
        gscMetrics: { clicks: 30, impressions: 300, ctr: 0.1, position: 4 },
      }),
    ];

    const result = enforceUniquePrimaryKeywords(pages, ['nike']);

    expect(result.find((page) => page.id === 'page-brand')?.kwPrincipal).toBe('');
    expect(result.find((page) => page.id === 'page-brand')?.originalKwPrincipal).toBe(
      'comprar zapatillas nike',
    );
    expect(result.find((page) => page.id === 'page-brand')?.isBrandKeyword).toBe(true);
    expect(result.find((page) => page.id === 'page-generic')?.kwPrincipal).toBe('');
  });

  it('falls back correctly to another non-brand URL with duplicated keyword', () => {
    const pages = [
      buildPage({
        id: 'page-brand',
        url: 'https://example.com/brand',
        kwPrincipal: 'kw compartida',
        isBrandKeyword: true,
        gscMetrics: { clicks: 120, impressions: 900, ctr: 0.13, position: 1.9 },
      }),
      buildPage({
        id: 'page-non-brand',
        url: 'https://example.com/non-brand',
        kwPrincipal: '',
        originalKwPrincipal: 'kw compartida',
        gscMetrics: { clicks: 20, impressions: 150, ctr: 0.13, position: 5 },
      }),
    ];

    const result = enforceUniquePrimaryKeywords(pages, ['nike']);

    expect(result.find((page) => page.id === 'page-brand')?.kwPrincipal).toBe('');
    expect(result.find((page) => page.id === 'page-brand')?.isBrandKeyword).toBe(true);
    expect(result.find((page) => page.id === 'page-non-brand')?.kwPrincipal).toBe('kw compartida');
  });

  it('never overwrites manual SI when an AI status update arrives and keeps evaluation metadata', () => {
    const currentItem: ChecklistItem = {
      key: 'CONTENIDOS',
      label: '4. Contenidos',
      status_manual: 'SI',
      notes_manual: 'Confirmado manualmente',
    };

    const updated = mergeChecklistItemWithBusinessRules(currentItem, {
      status_manual: 'SI_IA',
      notes_manual: 'IA detectó cobertura',
      evaluationMeta: {
        evaluatedBy: 'ai',
        provider: 'openai',
        model: 'gpt-4o-mini',
        evaluatedAt: 1760000000000,
        reason: 'Cobertura completa del tema principal',
      },
    });

    expect(updated.status_manual).toBe('SI');
    expect(updated.notes_manual).toBe('Confirmado manualmente');
    expect(updated.evaluationMeta?.reason).toBe('Cobertura completa del tema principal');
  });

  it('persists AI metadata together with status when item is not manual SI', () => {
    const currentItem: ChecklistItem = {
      key: 'SNIPPETS',
      label: '5. Snippets',
      status_manual: 'NO',
      notes_manual: '',
    };

    const updated = mergeChecklistItemWithBusinessRules(currentItem, {
      status_manual: 'SI_IA',
      notes_manual: 'Snippet optimizado',
      evaluationMeta: {
        evaluatedBy: 'ai',
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        evaluatedAt: 1760000001000,
        reason: 'Cumple buenas prácticas de snippet',
      },
    });

    expect(updated.status_manual).toBe('SI_IA');
    expect(updated.notes_manual).toBe('Snippet optimizado');
    expect(updated.evaluationMeta?.provider).toBe('gemini');
  });
});
