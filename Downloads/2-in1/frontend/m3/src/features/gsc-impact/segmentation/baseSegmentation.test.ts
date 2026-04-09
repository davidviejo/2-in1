import {
  BASE_FACET_KEYS,
  buildBaseFacets,
  classifyBrandVsNonBrand,
  classifyHomeVsResto,
  extractBaseFacetsFromDimensions,
  getUrlDepth,
  groupByFirstPathLevel,
  normalizeBrandedTerms,
} from './baseSegmentation';

describe('baseSegmentation', () => {
  it('classifies home vs resto', () => {
    expect(classifyHomeVsResto('https://example.com/')).toBe('home');
    expect(classifyHomeVsResto('/blog/post')).toBe('resto');
  });

  it('groups by first path level', () => {
    expect(groupByFirstPathLevel('https://example.com/')).toBe('/');
    expect(groupByFirstPathLevel('/blog/post-1')).toBe('/blog');
  });

  it('calculates url depth', () => {
    expect(getUrlDepth('/')).toBe(0);
    expect(getUrlDepth('/blog/post-1')).toBe(2);
  });

  it('classifies brand vs non-brand with configurable terms', () => {
    expect(classifyBrandVsNonBrand('Mediaflow pricing', ['mediaflow'])).toBe('brand');
    expect(classifyBrandVsNonBrand('seo audit', ['mediaflow'])).toBe('non-brand');
  });

  it('normalizes branded terms and deduplicates', () => {
    expect(normalizeBrandedTerms('Mediaflow, mediaflow, MÉDIAFLOW')).toEqual(['mediaflow']);
  });

  it('exposes base facets from dimensions without hardcoded taxonomies', () => {
    expect(BASE_FACET_KEYS).toEqual(['country', 'device', 'searchType']);

    expect(buildBaseFacets({ country: 'es', device: 'mobile', searchType: 'web' })).toEqual({
      country: 'ES',
      device: 'MOBILE',
      searchType: 'web',
    });

    expect(extractBaseFacetsFromDimensions(['query', 'country', 'device'], ['seo', 'mx', 'desktop'])).toEqual({
      country: 'MX',
      device: 'DESKTOP',
      searchType: '',
    });
  });
});
