import { describe, expect, it, beforeEach } from 'vitest';
import { GscImpactSegmentationRepository } from './gscImpactSegmentationRepository';

describe('GscImpactSegmentationRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and reads segmentation config scoped by client id', () => {
    GscImpactSegmentationRepository.saveConfigByClientId('client-a', {
      customClusters: [],
      templateRules: [{ template: 'blog', pattern: '/blog/*' }],
      pathRules: [],
      regexRules: [],
      brandedTerms: ['marca-a'],
      exclusions: [],
      manualMappings: { '/pricing': 'money' },
    });

    GscImpactSegmentationRepository.saveConfigByClientId('client-b', {
      customClusters: [],
      templateRules: [{ template: 'docs', pattern: '/docs/*' }],
      pathRules: [],
      regexRules: [],
      brandedTerms: ['marca-b'],
      exclusions: [],
      manualMappings: { '/features': 'product' },
    });

    const clientA = GscImpactSegmentationRepository.getConfigByClientId('client-a');
    const clientB = GscImpactSegmentationRepository.getConfigByClientId('client-b');

    expect(clientA.brandedTerms).toEqual(['marca-a']);
    expect(clientA.templateRules).toEqual([{ template: 'blog', pattern: '/blog/*' }]);
    expect(clientA.manualMappings).toEqual({ '/pricing': 'money' });

    expect(clientB.brandedTerms).toEqual(['marca-b']);
    expect(clientB.templateRules).toEqual([{ template: 'docs', pattern: '/docs/*' }]);
    expect(clientB.manualMappings).toEqual({ '/features': 'product' });
  });

  it('returns empty-safe defaults when client config does not exist', () => {
    const config = GscImpactSegmentationRepository.getConfigByClientId('unknown-client');

    expect(config.customClusters).toEqual([]);
    expect(config.templateRules).toEqual([]);
    expect(config.pathRules).toEqual([]);
    expect(config.regexRules).toEqual([]);
    expect(config.brandedTerms).toEqual([]);
    expect(config.exclusions).toEqual([]);
    expect(config.manualMappings).toEqual({});
  });
});
