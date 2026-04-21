import { isBrandTermMatch } from './brandTerms';

export type QueryBrandSegment = 'brand' | 'non-brand' | 'mixed';
export type QueryBrandFilter = 'all' | 'brand' | 'non-brand';

export interface QueryBrandClassification {
  segment: QueryBrandSegment;
  needsReview: boolean;
  matchedTerms: string[];
}

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const classifyQueryBrandSegment = (
  query: string,
  brandTerms: string[] = [],
): QueryBrandClassification => {
  const safeQuery = query.trim();
  const normalizedBrandTerms = brandTerms.filter((term) => term.trim().length > 0);
  if (!safeQuery || normalizedBrandTerms.length === 0) {
    return {
      segment: 'mixed',
      needsReview: true,
      matchedTerms: [],
    };
  }

  const matchedTerms = normalizedBrandTerms.filter((term) => isBrandTermMatch(safeQuery, [term]));
  if (matchedTerms.length === 0) {
    return {
      segment: 'non-brand',
      needsReview: false,
      matchedTerms: [],
    };
  }

  const tokens = tokenize(safeQuery);
  const hasInformationalIntent = tokens.some((token) =>
    ['como', 'qué', 'que', 'how', 'best', 'mejor', 'precio', 'review', 'alternativa'].includes(
      token,
    ),
  );

  if (matchedTerms.length > 1 || hasInformationalIntent) {
    return {
      segment: 'mixed',
      needsReview: true,
      matchedTerms,
    };
  }

  return {
    segment: 'brand',
    needsReview: false,
    matchedTerms,
  };
};

export const matchBrandFilter = (
  segment: QueryBrandSegment | undefined,
  activeFilter: QueryBrandFilter,
) => {
  if (activeFilter === 'all') return true;
  return segment === activeFilter;
};
