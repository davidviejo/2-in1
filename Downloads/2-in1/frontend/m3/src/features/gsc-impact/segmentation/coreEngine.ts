import { GSCRow } from '@/types';
import { isBrandTermMatch } from '@/utils/brandTerms';
import { ProjectTemplateRule } from './types';

export type QuerySegmentFilter = 'all' | 'brand' | 'non_brand' | 'question';

export type SegmentationInput = {
  url?: string;
  query?: string;
  gscRow?: GSCRow;
  maxImpressions?: number;
};

export type SegmentationFilters = {
  segmentFilter: QuerySegmentFilter;
  brandTerms: string[];
  pathPrefix: string;
  minImpressions: number;
  selectedTemplate: string;
  templateRules: ProjectTemplateRule[];
  templateManualMap: Record<string, string>;
};

export type BaseSegmentationResult = {
  normalizedPath: string;
  normalizedQuery: string;
  isBrandQuery: boolean;
  isQuestionQuery: boolean;
  queryMatchesSegment: boolean;
  template: string;
  matchesPathPrefix: boolean;
  maxImpressions: number;
  meetsMinImpressions: boolean;
};

const QUESTION_PREFIXES = ['como', 'cómo', 'que', 'qué', 'how', 'what', 'when', 'where', 'why'];

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const normalizePath = (urlOrPath: string): string => {
  const input = (urlOrPath || '').trim();
  if (!input) return '';

  try {
    const parsed = new URL(input);
    return parsed.pathname || '/';
  } catch {
    return input.startsWith('/') ? input : `/${input}`;
  }
};

const wildcardToRegex = (value: string) =>
  value
    .split('*')
    .map((chunk) => chunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

const classifyTemplate = (
  urlOrPath: string,
  rules: ProjectTemplateRule[],
  manualMap: Record<string, string>,
): string => {
  const path = normalizePath(urlOrPath);
  if (!path) return 'Sin template';

  if (manualMap[path]) {
    return manualMap[path];
  }

  for (const rule of rules) {
    const regex = new RegExp(`^${wildcardToRegex(normalizePath(rule.pattern))}$`, 'i');
    if (regex.test(path)) {
      return rule.template;
    }
  }

  return 'Sin template';
};

const matchesQuerySegment = (query: string, segmentFilter: QuerySegmentFilter, brandTerms: string[]) => {
  const normalized = normalizeText(query);
  const isQuestion = QUESTION_PREFIXES.some((prefix) => normalized.startsWith(`${prefix} `));
  const isBrand = isBrandTermMatch(normalized, brandTerms);

  if (segmentFilter === 'brand') return isBrand;
  if (segmentFilter === 'non_brand') return !isBrand;
  if (segmentFilter === 'question') return isQuestion;
  return true;
};

const matchesPathPrefix = (urlOrPath: string, pathPrefix: string): boolean => {
  const normalizedPrefix = normalizePath(pathPrefix);
  if (!normalizedPrefix || normalizedPrefix === '/') return true;
  return normalizePath(urlOrPath).startsWith(normalizedPrefix);
};

export const computeBaseSegmentation = (
  input: SegmentationInput,
  filters: SegmentationFilters,
): BaseSegmentationResult => {
  const normalizedPath = normalizePath(input.url || input.gscRow?.keys?.[1] || '');
  const normalizedQuery = normalizeText(input.query || input.gscRow?.keys?.[0] || '');
  const maxImpressions =
    input.maxImpressions ??
    Math.max(input.gscRow?.impressions || 0, 0);

  const isQuestionQuery = QUESTION_PREFIXES.some((prefix) => normalizedQuery.startsWith(`${prefix} `));
  const isBrandQuery = isBrandTermMatch(normalizedQuery, filters.brandTerms);

  return {
    normalizedPath,
    normalizedQuery,
    isBrandQuery,
    isQuestionQuery,
    queryMatchesSegment: matchesQuerySegment(normalizedQuery, filters.segmentFilter, filters.brandTerms),
    template: classifyTemplate(normalizedPath, filters.templateRules, filters.templateManualMap),
    matchesPathPrefix: matchesPathPrefix(normalizedPath, filters.pathPrefix),
    maxImpressions,
    meetsMinImpressions: maxImpressions >= filters.minImpressions,
  };
};
