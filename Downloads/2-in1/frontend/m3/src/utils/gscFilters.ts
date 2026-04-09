import { parseBrandTerms, isBrandTermMatch } from './brandTerms';

export type QuerySegmentFilter = 'all' | 'brand' | 'non_brand' | 'question';

export interface TemplateRule {
  template: string;
  pattern: string;
}

const QUESTION_PREFIXES = ['como', 'cómo', 'que', 'qué', 'how', 'what', 'when', 'where', 'why'];

export const normalizeTextForMatching = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const wildcardToRegex = (value: string) =>
  value
    .split('*')
    .map((chunk) => chunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

const normalizePath = (urlOrPath: string) => {
  const input = (urlOrPath || '').trim();
  if (!input) return '';

  try {
    const parsed = new URL(input);
    return parsed.pathname || '/';
  } catch {
    return input.startsWith('/') ? input : `/${input}`;
  }
};

export const parseBrandTermsInput = (value: string) => {
  const unique = new Set(parseBrandTerms(value).map((term) => normalizeTextForMatching(term)).filter(Boolean));
  return Array.from(unique);
};

export const parseTemplateRules = (value: string): TemplateRule[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [templateRaw, patternRaw] = line.split('|');
      return { template: (templateRaw || '').trim(), pattern: (patternRaw || '').trim() };
    })
    .filter((rule) => rule.template.length > 0 && rule.pattern.length > 0);

export const parseTemplateManualMap = (value: string): Record<string, string> =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const [pathRaw, templateRaw] = line.split('|');
      const path = normalizePath(pathRaw || '');
      const template = (templateRaw || '').trim();
      if (!path || !template) return acc;
      acc[path] = template;
      return acc;
    }, {});

export const classifyTemplateByUrl = (
  urlOrPath: string,
  rules: TemplateRule[],
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

export const matchesQuerySegment = (
  query: string,
  segmentFilter: QuerySegmentFilter,
  brandTerms: string[],
) => {
  const normalized = normalizeTextForMatching(query);
  const isQuestion = QUESTION_PREFIXES.some((prefix) => normalized.startsWith(`${prefix} `));
  const isBrand = isBrandTermMatch(normalized, brandTerms);

  if (segmentFilter === 'brand') return isBrand;
  if (segmentFilter === 'non_brand') return !isBrand;
  if (segmentFilter === 'question') return isQuestion;
  return true;
};

export const matchesPathPrefix = (urlOrPath: string, pathPrefix: string) => {
  const normalizedPrefix = normalizePath(pathPrefix);
  if (!normalizedPrefix || normalizedPrefix === '/') return true;
  return normalizePath(urlOrPath).startsWith(normalizedPrefix);
};
