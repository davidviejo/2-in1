import { describe, expect, it } from 'vitest';
import { buildAutoClustersFromChecklist, getPathname, isLikelyPageKey, parseManualClusterRules } from './SiteClusteringPage';

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
});
