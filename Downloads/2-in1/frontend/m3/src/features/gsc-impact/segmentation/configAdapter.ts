import { parseBrandTerms } from '@/utils/brandTerms';
import {
  ProjectCustomCluster,
  ProjectExclusionRule,
  ProjectPathRule,
  ProjectRegexRule,
  ProjectSegmentationConfig,
  ProjectTemplateRule,
} from './types';

import type { BaseSegmentationResult } from './coreEngine';

export type ProjectOverrideResult = BaseSegmentationResult & {
  template: string;
  customSegment: string | null;
  cluster: string | null;
  excluded: boolean;
};

const normalizeKind = (value: string): string => normalizeText(value);

const evaluateExclusion = (
  exclusions: ProjectExclusionRule[],
  normalizedPath: string,
  normalizedQuery: string,
): boolean =>
  exclusions.some((rule) => {
    const kind = normalizeKind(rule.kind);
    const value = rule.value.trim();
    if (!value) return false;

    if (kind.includes('path')) {
      return normalizedPath.startsWith(normalizePath(value));
    }

    if (kind.includes('query')) {
      return normalizedQuery.includes(normalizeText(value));
    }

    return false;
  });

const resolveCustomSegment = (
  normalizedPath: string,
  pathRules: ProjectPathRule[],
  regexRules: ProjectRegexRule[],
): { segment: string | null; ruleId: string | null; ruleType: string | null } => {
  const byPath = pathRules.find((rule) => normalizedPath.startsWith(rule.prefix));
  if (byPath) {
    return {
      segment: byPath.segment,
      ruleId: `custom:pathRule:${byPath.segment}:${byPath.prefix}`,
      ruleType: 'path_rule',
    };
  }

  const byRegex = regexRules.find((rule) => {
    try {
      return new RegExp(rule.pattern, rule.flags).test(normalizedPath);
    } catch {
      return false;
    }
  });

  if (byRegex) {
    return {
      segment: byRegex.segment,
      ruleId: `custom:regexRule:${byRegex.segment}:${byRegex.pattern}`,
      ruleType: 'regex_rule',
    };
  }

  return { segment: null, ruleId: null, ruleType: null };
};

const resolveCluster = (
  normalizedPath: string,
  clusters: ProjectCustomCluster[],
): { cluster: string | null; ruleId: string | null; ruleType: string | null } => {
  const match = clusters.find((cluster) => cluster.paths.some((path) => normalizedPath.startsWith(path)));
  if (!match) return { cluster: null, ruleId: null, ruleType: null };
  return {
    cluster: match.name,
    ruleId: `custom:cluster:${match.name}`,
    ruleType: 'cluster_rule',
  };
};

const resolveTemplateOverride = (
  normalizedPath: string,
  manualMappings: Record<string, string>,
): { template: string | null; ruleId: string | null; ruleType: string | null } => {
  const template = manualMappings[normalizedPath] || null;
  if (!template) return { template: null, ruleId: null, ruleType: null };
  return {
    template,
    ruleId: `custom:templateManualMap:${normalizedPath}`,
    ruleType: 'template_manual_map',
  };
};

export const applyProjectOverrides = (
  base: BaseSegmentationResult,
  config: ProjectSegmentationConfig,
): ProjectOverrideResult => {
  const templateOverride = resolveTemplateOverride(base.normalizedPath, config.manualMappings);
  const customSegment = resolveCustomSegment(base.normalizedPath, config.pathRules, config.regexRules);
  const cluster = resolveCluster(base.normalizedPath, config.customClusters);
  const excluded = evaluateExclusion(config.exclusions, base.normalizedPath, base.normalizedQuery);

  const metadata =
    excluded
      ? { source: 'custom' as const, ruleId: `custom:exclusion:${base.normalizedPath}`, ruleType: 'exclusion_rule' }
      : templateOverride.template
        ? { source: 'custom' as const, ruleId: templateOverride.ruleId, ruleType: templateOverride.ruleType }
        : customSegment.segment
          ? { source: 'custom' as const, ruleId: customSegment.ruleId, ruleType: customSegment.ruleType }
          : cluster.cluster
            ? { source: 'custom' as const, ruleId: cluster.ruleId, ruleType: cluster.ruleType }
            : { source: base.source, ruleId: base.ruleId, ruleType: base.ruleType };

  return {
    ...base,
    template: templateOverride.template || base.template,
    customSegment: customSegment.segment,
    cluster: cluster.cluster,
    excluded,
    source: metadata.source,
    ruleId: metadata.ruleId,
    ruleType: metadata.ruleType,
  };
};

export type PartialProjectSegmentationConfig = Partial<
  Omit<ProjectSegmentationConfig, 'manualMappings' | 'brandedTerms' | 'templateRules'> & {
    templateRules: ProjectTemplateRule[] | string;
    brandedTerms: string[] | string;
    manualMappings: Record<string, string> | string;
  }
>;

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const ensureArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  return [];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

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

const normalizeTemplateRules = (value: unknown): ProjectTemplateRule[] => {
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [templateRaw, patternRaw] = line.split('|');
        return { template: (templateRaw || '').trim(), pattern: (patternRaw || '').trim() };
      })
      .filter((rule) => rule.template.length > 0 && rule.pattern.length > 0);
  }

  return ensureArray(value)
    .map((rule) => {
      const record = asRecord(rule);
      const template = typeof record?.template === 'string' ? record.template.trim() : '';
      const pattern = typeof record?.pattern === 'string' ? record.pattern.trim() : '';
      return { template, pattern };
    })
    .filter((rule) => rule.template && rule.pattern);
};

const normalizeBrandedTerms = (value: unknown): string[] => {
  const parsed =
    typeof value === 'string'
      ? parseBrandTerms(value)
      : ensureArray(value)
          .map((term) => (typeof term === 'string' ? term : ''))
          .filter(Boolean);

  const unique = new Set(parsed.map((term) => normalizeText(term)).filter(Boolean));
  return Array.from(unique);
};

const normalizeManualMappings = (value: unknown): Record<string, string> => {
  if (typeof value === 'string') {
    return value
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
  }

  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [pathRaw, templateRaw]) => {
    const path = normalizePath(pathRaw);
    const template = typeof templateRaw === 'string' ? templateRaw.trim() : '';
    if (!path || !template) return acc;
    acc[path] = template;
    return acc;
  }, {});
};

const normalizeCustomClusters = (value: unknown): ProjectCustomCluster[] =>
  ensureArray(value)
    .map((cluster) => {
      const record = asRecord(cluster);
      const name = typeof record?.name === 'string' ? record.name.trim() : '';
      const paths = ensureArray(record?.paths)
        .map((path) => (typeof path === 'string' ? normalizePath(path) : ''))
        .filter(Boolean);

      return { name, paths };
    })
    .filter((cluster) => cluster.name && cluster.paths.length > 0);

const normalizePathRules = (value: unknown): ProjectPathRule[] =>
  ensureArray(value)
    .map((rule) => {
      const record = asRecord(rule);
      const segment = typeof record?.segment === 'string' ? record.segment.trim() : '';
      const prefix = normalizePath(typeof record?.prefix === 'string' ? record.prefix : '');
      return { segment, prefix };
    })
    .filter((rule) => rule.segment && rule.prefix);

const normalizeRegexRules = (value: unknown): ProjectRegexRule[] =>
  ensureArray(value)
    .map((rule) => {
      const record = asRecord(rule);
      const segment = typeof record?.segment === 'string' ? record.segment.trim() : '';
      const pattern = typeof record?.pattern === 'string' ? record.pattern.trim() : '';
      const flags = typeof record?.flags === 'string' ? record.flags.trim() : '';
      return { segment, pattern, flags };
    })
    .filter((rule) => {
      if (!rule.segment || !rule.pattern) return false;
      try {
        new RegExp(rule.pattern, rule.flags);
        return true;
      } catch {
        return false;
      }
    });

const normalizeExclusions = (value: unknown): ProjectExclusionRule[] =>
  ensureArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      const kind = typeof record?.kind === 'string' ? record.kind.trim() : '';
      const rawValue = typeof record?.value === 'string' ? record.value.trim() : '';
      const normalizedValue = kind.toLowerCase().includes('path') ? normalizePath(rawValue) : rawValue;
      return { kind, value: normalizedValue };
    })
    .filter((entry) => entry.kind && entry.value);

export const createDefaultProjectSegmentationConfig = (): ProjectSegmentationConfig => ({
  customClusters: [],
  templateRules: [],
  pathRules: [],
  regexRules: [],
  brandedTerms: [],
  exclusions: [],
  manualMappings: {},
});

export const parseProjectSegmentationConfig = (
  config?: PartialProjectSegmentationConfig | null,
): ProjectSegmentationConfig => {
  if (!config || typeof config !== 'object') {
    return createDefaultProjectSegmentationConfig();
  }

  return {
    customClusters: normalizeCustomClusters(config.customClusters),
    templateRules: normalizeTemplateRules(config.templateRules),
    pathRules: normalizePathRules(config.pathRules),
    regexRules: normalizeRegexRules(config.regexRules),
    brandedTerms: normalizeBrandedTerms(config.brandedTerms),
    exclusions: normalizeExclusions(config.exclusions),
    manualMappings: normalizeManualMappings(config.manualMappings),
  };
};
