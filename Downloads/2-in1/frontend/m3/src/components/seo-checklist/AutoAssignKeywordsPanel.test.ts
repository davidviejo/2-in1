import { describe, expect, it } from 'vitest';
import { getBestKeywordFromPage } from './AutoAssignKeywordsPanel';
import { SeoPage } from '../../types/seoChecklist';

const buildPage = (queries: any[], kwPrincipal = ''): SeoPage =>
  ({
    id: 'page-1',
    url: 'https://example.com/test',
    kwPrincipal,
    pageType: 'Article',
    checklist: {
      OPORTUNIDADES: {
        key: 'OPORTUNIDADES',
        label: 'Oportunidades',
        status_manual: 'NA',
        notes_manual: '',
        autoData: {
          gscQueries: queries,
        },
      },
    } as SeoPage['checklist'],
  }) as SeoPage;

describe('getBestKeywordFromPage', () => {
  it('elige la query con más impresiones cuando no hay clics', () => {
    const page = buildPage([
      { query: 'kw sin clics 1', clicks: 0, impressions: 50, position: 4 },
      { query: 'kw sin clics 2', clicks: 0, impressions: 120, position: 8 },
    ]);

    const result = getBestKeywordFromPage(page, new Set());

    expect(result?.keyword).toBe('kw sin clics 2');
    expect(result?.clicks).toBe(0);
    expect(result?.impressions).toBe(120);
  });

  it('omite keywords bloqueadas (ya usadas en otras URLs)', () => {
    const page = buildPage([
      { query: 'keyword-duplicada', clicks: 8, impressions: 200, position: 3 },
      { query: 'keyword-alternativa', clicks: 5, impressions: 180, position: 2 },
    ]);

    const result = getBestKeywordFromPage(page, new Set(['keyword-duplicada']));

    expect(result?.keyword).toBe('keyword-alternativa');
  });
});
