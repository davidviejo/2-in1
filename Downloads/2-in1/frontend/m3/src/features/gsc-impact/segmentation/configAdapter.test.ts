import { describe, expect, it } from 'vitest';
import { applyProjectOverrides, createDefaultProjectSegmentationConfig, parseProjectSegmentationConfig } from './configAdapter';

describe('configAdapter', () => {
  it('creates an empty and explicit default config', () => {
    expect(createDefaultProjectSegmentationConfig()).toEqual({
      customClusters: [],
      templateRules: [],
      pathRules: [],
      regexRules: [],
      brandedTerms: [],
      exclusions: [],
      manualMappings: {},
    });
  });

  it('accepts partial config and normalizes values', () => {
    const parsed = parseProjectSegmentationConfig({
      brandedTerms: 'MediaFlow, MÉDIAFLOW\nMarca',
      templateRules: 'Blog|/blog/*\n Home | / ',
      manualMappings: 'blog/ia| Landing especial ',
      pathRules: [{ segment: 'blog', prefix: 'blog' }],
      regexRules: [
        { segment: 'guides', pattern: '^/guides/.+', flags: 'i' },
        { segment: 'bad', pattern: '[', flags: '' },
      ],
      exclusions: [{ kind: 'path', value: 'checkout' }],
      customClusters: [{ name: 'Content', paths: ['blog', '/recursos'] }],
    });

    expect(parsed).toEqual({
      brandedTerms: ['mediaflow', 'marca'],
      templateRules: [
        { template: 'Blog', pattern: '/blog/*' },
        { template: 'Home', pattern: '/' },
      ],
      manualMappings: {
        '/blog/ia': 'Landing especial',
      },
      pathRules: [{ segment: 'blog', prefix: '/blog' }],
      regexRules: [{ segment: 'guides', pattern: '^/guides/.+', flags: 'i' }],
      exclusions: [{ kind: 'path', value: '/checkout' }],
      customClusters: [{ name: 'Content', paths: ['/blog', '/recursos'] }],
    });
  });

  it('handles invalid payloads with safe fallbacks', () => {
    expect(parseProjectSegmentationConfig(null)).toEqual(createDefaultProjectSegmentationConfig());
    expect(parseProjectSegmentationConfig({ regexRules: [{ segment: 'x', pattern: '[invalid', flags: '' }] })).toEqual({
      ...createDefaultProjectSegmentationConfig(),
      regexRules: [],
    });
  });

  it('matches cluster rules with exact and wildcard paths prioritizing the most specific one', () => {
    const config = parseProjectSegmentationConfig({
      customClusters: [
        { name: 'Home', paths: ['/'] },
        { name: 'Informacional Rinoplastia', paths: ['/rinoplastia/*'] },
        { name: 'Geolocal Madrid', paths: ['/rinoplastia-en-madrid', '/rinoplastia-en-madrid/*'] },
      ],
    });

    const base = {
      normalizedPath: '/rinoplastia-en-madrid/precio',
      normalizedQuery: '',
      isBrandQuery: false,
      isQuestionQuery: false,
      queryMatchesSegment: true,
      template: 'Sin template',
      matchesPathPrefix: true,
      maxImpressions: 0,
      meetsMinImpressions: true,
      source: 'base' as const,
      ruleId: null,
      ruleType: null,
    };

    expect(applyProjectOverrides(base, config).cluster).toBe('Geolocal Madrid');
    expect(applyProjectOverrides({ ...base, normalizedPath: '/rinoplastia' }, config).cluster).toBe('Home');
    expect(applyProjectOverrides({ ...base, normalizedPath: '/rinoplastia/tecnica' }, config).cluster).toBe('Informacional Rinoplastia');
  });
});
