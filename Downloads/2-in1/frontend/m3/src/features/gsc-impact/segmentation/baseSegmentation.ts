import { GSCDimension, GSCSearchType } from '@/types';
import { isBrandTermMatch, parseBrandTerms } from '@/utils/brandTerms';

export type HomeVsResto = 'home' | 'resto';
export type BrandVsNonBrand = 'brand' | 'non-brand';

export type BaseFacetKey = 'country' | 'device' | 'searchType';

export type BaseFacets = {
  country: string;
  device: string;
  searchType: GSCSearchType | '';
};

export const BASE_FACET_KEYS: BaseFacetKey[] = ['country', 'device', 'searchType'];

const normalizePathname = (urlOrPath: string): string => {
  const input = (urlOrPath || '').trim();
  if (!input) return '/';

  try {
    const parsed = new URL(input);
    return parsed.pathname || '/';
  } catch {
    if (!input.startsWith('/')) return `/${input}`;
    return input || '/';
  }
};

const splitPathSegments = (urlOrPath: string): string[] =>
  normalizePathname(urlOrPath)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

export const classifyHomeVsResto = (urlOrPath: string): HomeVsResto =>
  splitPathSegments(urlOrPath).length === 0 ? 'home' : 'resto';

export const groupByFirstPathLevel = (urlOrPath: string): string => {
  const firstSegment = splitPathSegments(urlOrPath)[0];
  return firstSegment ? `/${firstSegment}` : '/';
};

export const getUrlDepth = (urlOrPath: string): number => splitPathSegments(urlOrPath).length;

const normalizeBrandTerm = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const normalizeBrandedTerms = (terms: string[] | string): string[] => {
  const parsed = typeof terms === 'string' ? parseBrandTerms(terms) : terms;
  const unique = new Set(parsed.map((term) => normalizeBrandTerm(term)).filter(Boolean));
  return Array.from(unique);
};

export const classifyBrandVsNonBrand = (
  query: string,
  brandedTerms: string[] | string,
): BrandVsNonBrand => {
  const normalizedQuery = normalizeBrandTerm(query);
  const terms = normalizeBrandedTerms(brandedTerms);
  return isBrandTermMatch(normalizedQuery, terms) ? 'brand' : 'non-brand';
};

export const buildBaseFacets = (input?: Partial<BaseFacets>): BaseFacets => ({
  country: (input?.country || '').trim().toUpperCase(),
  device: (input?.device || '').trim().toUpperCase(),
  searchType: input?.searchType || '',
});

export const extractBaseFacetsFromDimensions = (
  dimensions: GSCDimension[],
  keys: string[],
): BaseFacets => {
  const getValue = (dimension: GSCDimension) => {
    const index = dimensions.indexOf(dimension);
    return index >= 0 ? keys[index] || '' : '';
  };

  return buildBaseFacets({
    country: getValue('country'),
    device: getValue('device'),
  });
};
