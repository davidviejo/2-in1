import { describe, expect, it } from 'vitest';
import { createDefaultProjectSegmentationConfig } from './configAdapter';
import {
  collectAvailableTemplates,
  filterQueryImpactRows,
  mapAndFilterUrlImpactRows,
  runSegmentationPipeline,
} from './pipeline';

describe('segmentation pipeline', () => {
  it('processes base segmentation and project overrides in order', () => {
    const config = createDefaultProjectSegmentationConfig();
    config.manualMappings = { '/blog/ia': 'Landing especial' };
    config.exclusions = [{ kind: 'path', value: '/checkout' }];

    const included = runSegmentationPipeline(
      {
        mode: 'url',
        url: 'https://example.com/blog/ia',
        maxImpressions: 200,
      },
      {
        filters: {
          segmentFilter: 'all',
          brandTerms: [],
          pathPrefix: '/blog',
          minImpressions: 50,
          selectedTemplate: 'Landing especial',
          templateRules: [{ template: 'Blog', pattern: '/blog/*' }],
          templateManualMap: {},
        },
        projectConfig: config,
      },
    );

    expect(included.template).toBe('Landing especial');
    expect(included.included).toBe(true);

    const excluded = runSegmentationPipeline(
      {
        mode: 'url',
        url: 'https://example.com/checkout',
        maxImpressions: 200,
      },
      {
        filters: {
          segmentFilter: 'all',
          brandTerms: [],
          pathPrefix: '/',
          minImpressions: 0,
          selectedTemplate: 'all',
          templateRules: [],
          templateManualMap: {},
        },
        projectConfig: config,
      },
    );

    expect(excluded.excluded).toBe(true);
    expect(excluded.included).toBe(false);
  });

  it('filters query and url rows through pipeline helpers', () => {
    const config = createDefaultProjectSegmentationConfig();
    const queryRows = [
      { key: 'q1', label: 'mediaflow pricing', preImpressions: 10, rolloutImpressions: 50, postImpressions: 20 },
      { key: 'q2', label: 'auditoria seo', preImpressions: 10, rolloutImpressions: 20, postImpressions: 15 },
    ];

    expect(
      filterQueryImpactRows(
        queryRows,
        {
          segmentFilter: 'brand',
          brandTerms: ['mediaflow'],
          minImpressions: 0,
        },
        config,
      ),
    ).toEqual([queryRows[0]]);

    const urlRows = [
      { key: '/blog/post', label: 'x', preImpressions: 30, rolloutImpressions: 40, postImpressions: 20 },
      { key: '/pricing', label: 'y', preImpressions: 5, rolloutImpressions: 5, postImpressions: 2 },
    ];

    const filteredUrlRows = mapAndFilterUrlImpactRows(
      urlRows,
      {
        minImpressions: 10,
        pathPrefix: '/blog',
        selectedTemplate: 'Blog',
        templateRules: [{ template: 'Blog', pattern: '/blog/*' }],
        templateManualMap: {},
      },
      config,
    );

    expect(filteredUrlRows).toEqual([
      { key: '/blog/post', label: 'x', preImpressions: 30, rolloutImpressions: 40, postImpressions: 20, template: 'Blog' },
    ]);

    expect(
      collectAvailableTemplates(
        urlRows,
        {
          templateRules: [{ template: 'Blog', pattern: '/blog/*' }],
          templateManualMap: { '/pricing': 'Money' },
        },
        config,
      ),
    ).toEqual(['Blog', 'Money']);
  });
});
