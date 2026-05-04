import { describe, expect, it } from 'vitest';
import { buildKeywordProposals, getBestKeywordFromPage } from './AutoAssignKeywordsPanel';
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

const buildPageWithId = (id: string, url: string, queries: any[], kwPrincipal = ''): SeoPage =>
  ({
    ...buildPage(queries, kwPrincipal),
    id,
    url,
  }) as SeoPage;

describe('getBestKeywordFromPage', () => {
  it('prioriza impresiones por encima de clics para determinar la KW principal', () => {
    const page = buildPage([
      { query: 'query-con-mas-clicks', clicks: 80, impressions: 200, position: 2 },
      { query: 'query-con-mas-impresiones', clicks: 20, impressions: 800, position: 5 },
    ]);

    const result = getBestKeywordFromPage(page, new Set());

    expect(result?.keyword).toBe('query-con-mas-impresiones');
    expect(result?.clicks).toBe(20);
    expect(result?.impressions).toBe(800);
  });

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

  it('descarta queries con formato de URL durante la autoasignación', () => {
    const page = buildPage([
      { query: 'https://example.com/servicios/seo', clicks: 120, impressions: 1600, position: 1 },
      { query: 'seo local para clinicas', clicks: 15, impressions: 700, position: 4 },
    ]);

    const result = getBestKeywordFromPage(page, new Set());

    expect(result?.keyword).toBe('seo local para clinicas');
  });
});

describe('buildKeywordProposals', () => {
  it('asigna una query duplicada a la URL con mayor impresiones y evita duplicarla en URLs inferiores', () => {
    const pages = [
      buildPageWithId(
        'url-top',
        'https://example.com/servicios',
        [
          { query: 'seo local', clicks: 20, impressions: 2000, position: 2 },
          { query: 'auditoria seo local', clicks: 10, impressions: 900, position: 3 },
        ],
        '',
      ),
      buildPageWithId(
        'url-low',
        'https://example.com/servicios/',
        [
          { query: 'seo local', clicks: 10, impressions: 1200, position: 4 },
          { query: 'consultoria seo local', clicks: 7, impressions: 600, position: 5 },
        ],
        '',
      ),
    ];

    const proposals = buildKeywordProposals(pages, 'all');

    expect(proposals.find((proposal) => proposal.id === 'url-top')?.proposedKeyword).toBe('seo local');
    expect(proposals.find((proposal) => proposal.id === 'url-low')?.proposedKeyword).toBe(
      'consultoria seo local',
    );
  });
});
