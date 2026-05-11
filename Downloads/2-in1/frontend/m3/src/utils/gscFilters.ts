import { isBrandTermMatch } from './brandTerms';
import {
  parseProjectSegmentationConfig,
  type PartialProjectSegmentationConfig,
} from '@/features/gsc-impact/segmentation/configAdapter';
import { type QuerySegmentFilter } from '@/features/gsc-impact/segmentation/coreEngine';
import { type ProjectCustomCluster, type ProjectTemplateRule } from '@/features/gsc-impact/segmentation/types';

export type TemplateRule = ProjectTemplateRule;

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

const parseFromProjectConfig = <T extends keyof ReturnType<typeof parseProjectSegmentationConfig>>(
  partial: PartialProjectSegmentationConfig,
  key: T,
): ReturnType<typeof parseProjectSegmentationConfig>[T] => parseProjectSegmentationConfig(partial)[key];

export const parseBrandTermsInput = (value: string) => parseFromProjectConfig({ brandedTerms: value }, 'brandedTerms');

export const parseTemplateRules = (value: string): TemplateRule[] =>
  parseFromProjectConfig({ templateRules: value }, 'templateRules');

export const parseTemplateManualMap = (value: string): Record<string, string> =>
  parseFromProjectConfig({ manualMappings: value }, 'manualMappings');

export const parseCustomClusters = (value: string): ProjectCustomCluster[] =>
  parseFromProjectConfig(
    {
      customClusters: value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [nameRaw, pathsRaw] = line.split('|');
          const paths = (pathsRaw || '')
            .split(',')
            .map((path) => path.trim())
            .filter(Boolean);
          return { name: (nameRaw || '').trim(), paths };
        }),
    },
    'customClusters',
  );

const escapeRegexForLooker = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildLookerStudioClusterCase = (domain: string, clusters: ProjectCustomCluster[]): string => {
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const escapedDomain = escapeRegexForLooker(cleanDomain);
  const lines = clusters.flatMap((cluster) =>
    cluster.paths.map(
      (path) =>
        `  WHEN REGEXP_MATCH(Landing Page, ".*${escapedDomain}${escapeRegexForLooker(path)}(/.*)?$") THEN "${cluster.name}"`,
    ),
  );

  return ['CASE', ...lines, '  ELSE "Sin clasificar"', 'END'].join('\n');
};

export const buildLookerStudioUrlLevelCase = (level: number): string => {
  const depth = Math.max(1, Math.floor(level));
  return [
    'CASE',
    `  WHEN REGEXP_MATCH(Landing Page, "https?://[^/]+(?:/[^/?#]+){${depth},}.*")`,
    `    THEN REGEXP_EXTRACT(Landing Page, "https?://[^/]+(?:/[^/?#]+){${depth - 1}}/([^/?#]+)")`,
    '  ELSE "Sin clasificar"',
    'END',
  ].join('\n');
};

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
