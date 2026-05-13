import { describe, expect, it } from 'vitest';
import { buildAutoClustersFromChecklist, buildRowsByLevel, getMaxDepthFromRows, getPathname, isLikelyPageKey, parseManualClusterRules, resolveClusterName } from './SiteClusteringPage';

describe('SiteClusteringPage helpers', () => {
  it('accepts strong page keys and rejects search queries with slash', () => {
    expect(isLikelyPageKey('https://www.diegocasas.es/rinoplastia-en-madrid/')).toBe(true);
    expect(isLikelyPageKey('/rinoplastia-en-madrid/')).toBe(true);
    expect(isLikelyPageKey('rinoplastia / madrid')).toBe(false);
    expect(isLikelyPageKey('mejor/rinoplastia madrid')).toBe(false);
  });

  it('parses manual rules in named format and keeps wildcard paths', () => {
    const rules = parseManualClusterRules([
      'Home|1|/',
      'Geolocal Madrid|2|/rinoplastia-en-madrid,/rinoplastia-en-madrid/*',
      'Informacional Rinoplastia|2|/rinoplastia/*',
    ].join('\n'));

    expect(rules).toHaveLength(3);
    expect(rules[0]).toMatchObject({ name: 'Home', level: 1, urls: ['/'] });
    expect(rules[1]).toMatchObject({ name: 'Geolocal Madrid', level: 2, urls: ['/rinoplastia-en-madrid', '/rinoplastia-en-madrid/*'] });
  });

  it('builds editable auto clusters (no serialized regex)', () => {
    const clusters = buildAutoClustersFromChecklist([
      { url: 'https://www.diegocasas.es/rinoplastia-en-madrid/a/' },
      { url: 'https://www.diegocasas.es/rinoplastia-en-madrid/b/' },
      { url: '/rinoplastia-en-zaragoza/a/' },
      { url: '/rinoplastia-en-zaragoza/b/' },
    ]);

    const madrid = clusters.find((item) => item.name === '/rinoplastia-en-madrid');
    expect(madrid?.urls).toEqual(['/rinoplastia-en-madrid/a', '/rinoplastia-en-madrid/b']);
    expect((madrid?.urls || []).join(',')).not.toContain('/^');
  });

  it('getPathname supports absolute and relative URLs only', () => {
    expect(getPathname('https://www.diegocasas.es/rinoplastia-en-madrid/')).toBe('/rinoplastia-en-madrid/');
    expect(getPathname('/rinoplastia-en-madrid/')).toBe('/rinoplastia-en-madrid/');
    expect(getPathname('rinoplastia madrid')).toBe('');
  });

  it('sends non-matching URLs to "Sin cluster" when manual rules are active', () => {
    const manualRules = parseManualClusterRules('Geolocal Madrid|2|/rinoplastia-en-madrid,/rinoplastia-en-madrid/*');
    expect(resolveClusterName('/url-sin-regla', 2, manualRules)).toBe('Sin cluster');
  });


  it('builds cluster aggregation from query+page rows and derives top query correctly', () => {
    const rows = buildRowsByLevel([
      { keys: ['best service', 'https://example.com/servicios/a'], clicks: 40, impressions: 100, position: 2 },
      { keys: ['cheap service', 'https://example.com/servicios/a'], clicks: 15, impressions: 50, position: 5 },
      { keys: ['seo audit', 'https://example.com/servicios/b'], clicks: 30, impressions: 80, position: 4 },
    ], 1, []);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cluster: '/servicios',
      urls: 2,
      clicks: 85,
      impressions: 230,
      topQuery: 'best service',
    });
  });

  it('detects deep nested pages when calculating max depth', () => {
    const maxDepth = getMaxDepthFromRows([
      { query: 'q1', page: '/a/b/c' },
      { keys: ['query', 'https://example.com/a/b'] },
    ]);

    expect(maxDepth).toBeGreaterThan(1);
    expect(maxDepth).toBe(3);
  });

  it('prefers explicit query/page fields over keys for query+page aggregations', () => {
    const rows = buildRowsByLevel([
      {
        keys: ['ignored query', '/wrong-page'],
        query: 'real query',
        page: '/real-page',
        clicks: 12,
        impressions: 24,
        position: 3,
      },
    ], 1, []);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cluster: '/real-page',
      urls: 1,
      clicks: 12,
      impressions: 24,
      topQuery: 'real query',
    });
  });
});
