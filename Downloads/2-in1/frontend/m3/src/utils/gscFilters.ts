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

export type ClusterLevelRule = { level1: string; level2: string; levels: string[]; paths: string[] };

export const parseCustomClusters = (value: unknown): ProjectCustomCluster[] =>
  parseFromProjectConfig(
    {
      customClusters: (typeof value === 'string' ? value : '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          if (line.includes('=>')) {
            const [patternRaw, nameRaw] = line.split('=>').map((part) => part.trim());
            const name = (nameRaw || '').replace(/^cluster\s*:\s*/i, '').trim();
            const path = (patternRaw || '').trim();
            return { name, paths: path ? [path] : [] };
          }

          const chunks = line.split('|').map((part) => part.trim());
          if (chunks.length >= 3) {
            const [nameRaw, levelRaw, ...pathChunks] = chunks;
            const parsedLevel = Number(levelRaw);
            const level = Number.isFinite(parsedLevel) && parsedLevel > 0 ? Math.floor(parsedLevel) : undefined;
            const paths = pathChunks
              .join('|')
              .split(',')
              .map((path) => path.trim())
              .filter(Boolean);
            return { name: (nameRaw || '').trim(), paths, level };
          }

          const [nameRaw, pathsRaw] = chunks;
          const paths = (pathsRaw || '').split(',').map((path) => path.trim()).filter(Boolean);
          return { name: (nameRaw || '').trim(), paths };
        }),
    },
    'customClusters',
  );



export const parseClusterLevelRules = (value: unknown): ClusterLevelRule[] =>
  (typeof value === 'string' ? value : '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const chunks = line.split('|');
      const pathsRaw = chunks[chunks.length - 1] || '';
      const levels = chunks.slice(0, -1).map((chunk) => chunk.trim()).filter(Boolean);
      const [level1Raw, level2Raw] = levels;
      const paths = (pathsRaw || '')
        .split(',')
        .map((path) => path.trim())
        .filter(Boolean);
      return {
        level1: (level1Raw || '').trim(),
        level2: (level2Raw || '').trim(),
        levels,
        paths,
      };
    })
    .filter((row) => row.levels.length >= 2 && row.paths.length > 0);

export const buildLookerStudioClusterLevelCase = (domain: string, rules: ClusterLevelRule[], level: 1 | 2): string => {
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const escapedDomain = escapeRegexForLooker(cleanDomain);
  const lines = rules.flatMap((rule) =>
    rule.paths.map((path) =>
      `  WHEN REGEXP_MATCH(Landing Page, ".*${escapedDomain}${escapeRegexForLooker(path)}(/.*)?$") THEN "${level === 1 ? rule.level1 : rule.level2}"`,
    ),
  );

  return ['CASE', ...lines, '  ELSE "Sin clasificar"', 'END'].join('\n');
};
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

export const buildLookerStudioClusterCaseGroupedRegex = (clusters: ProjectCustomCluster[], field = 'Página de destino'): string => {
  const lines = clusters
    .map((cluster) => {
      const pattern = cluster.paths
        .map((path) => `${escapeRegexForLooker(normalizePath(path))}.*`)
        .join('|');

      if (!pattern) return '';
      return `  WHEN REGEXP_MATCH(${field},'${pattern}') THEN "${cluster.name}"`;
    })
    .filter(Boolean);

  return ['CASE', ...lines, '  ELSE "Sin clasificar"', 'END'].join('\n');
};

export const buildLookerStudioClusterLevelCaseGroupedRegex = (
  rules: ClusterLevelRule[],
  level: number,
  field = 'Página de destino',
): string => {
  const grouped = new Map<string, string[]>();

  rules.forEach((rule) => {
    const key = rule.levels[Math.max(0, level - 1)] || '';
    if (!key) return;
    const current = grouped.get(key) || [];
    current.push(...rule.paths.map((path) => `${escapeRegexForLooker(normalizePath(path))}.*`));
    grouped.set(key, current);
  });

  const lines = Array.from(grouped.entries())
    .map(([label, paths]) => {
      const uniquePattern = Array.from(new Set(paths)).join('|');
      if (!uniquePattern) return '';
      return `  WHEN REGEXP_MATCH(${field},'${uniquePattern}') THEN "${label}"`;
    })
    .filter(Boolean);

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
