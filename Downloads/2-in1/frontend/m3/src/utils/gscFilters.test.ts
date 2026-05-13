import { describe, expect, it } from 'vitest';
import {
  classifyTemplateByUrl,
  buildLookerStudioClusterCase,
  buildLookerStudioClusterLevelCase,
  buildLookerStudioUrlLevelCase,
  matchesPathPrefix,
  matchesQuerySegment,
  parseBrandTermsInput,
  parseCustomClusters,
  parseClusterLevelRules,
  parseTemplateManualMap,
  parseTemplateRules,
} from './gscFilters';

describe('gscFilters', () => {
  it('normalizes and deduplicates brand terms', () => {
    expect(parseBrandTermsInput('MediaFlow, mediaflow\nMarca')).toEqual(['mediaflow', 'marca']);
  });

  it('matches branded/non-branded segments', () => {
    const brandTerms = ['mediaflow'];
    expect(matchesQuerySegment('mediaflow precios', 'brand', brandTerms)).toBe(true);
    expect(matchesQuerySegment('auditoria seo', 'non_brand', brandTerms)).toBe(true);
  });

  it('classifies templates using manual map first and then wildcard rules', () => {
    const rules = parseTemplateRules('Blog|/blog/*\nHome|/');
    const manual = parseTemplateManualMap('/blog/ia|Landing especial');

    expect(classifyTemplateByUrl('https://example.com/blog/ia', rules, manual)).toBe('Landing especial');
    expect(classifyTemplateByUrl('https://example.com/blog/seo', rules, manual)).toBe('Blog');
    expect(classifyTemplateByUrl('https://example.com/other', rules, manual)).toBe('Sin template');
  });

  it('matches path prefixes with url and path inputs', () => {
    expect(matchesPathPrefix('https://example.com/blog/post', '/blog')).toBe(true);
    expect(matchesPathPrefix('/categoria/x', '/blog')).toBe(false);
  });

  it('parses custom clusters from textarea format', () => {
    const parsed = parseCustomClusters('Blog|1|/blog\nLocal|2|/bilbao,/valencia');
    expect(parsed).toEqual([
      { name: 'Blog', level: 1, paths: ['/blog'] },
      { name: 'Local', level: 2, paths: ['/bilbao', '/valencia'] },
    ]);
  });

  it('supports legacy pattern => cluster format and ignores invalid lines', () => {
    const parsed = parseCustomClusters([
      '/blog/* => cluster: Blog',
      '/servicios/madrid => Local Madrid',
      '',
      'Cluster sin paths|3|',
      'SoloNombre|',
    ].join('\n'));

    expect(parsed).toEqual([
      { name: 'Blog', paths: ['/blog/*'] },
      { name: 'Local Madrid', paths: ['/servicios/madrid'] },
    ]);
    expect(JSON.stringify(parsed)).not.toContain('/sin-ruta');
  });


  it('returns empty clustering rules when persisted values are malformed', () => {
    expect(parseCustomClusters({ legacy: true } as unknown as string)).toEqual([]);
    expect(parseClusterLevelRules(123 as unknown as string)).toEqual([]);
  });
  it('builds looker CASE expression for custom clusters', () => {
    const customCase = buildLookerStudioClusterCase('mvocaesteticadental.com', [
      { name: 'Blog', paths: ['/blog'] },
      { name: 'Bilbao', paths: ['/bilbao'] },
    ]);

    expect(customCase).toContain('WHEN REGEXP_MATCH');
    expect(customCase).toContain('THEN "Blog"');
    expect(customCase).toContain('ELSE "Sin clasificar"');
  });


  it('parses cluster level rules from textarea format', () => {
    const parsed = parseClusterLevelRules('Servicios|Implantes|/implantes\nBlog|Guías|/blog,/blog/seo');
    expect(parsed).toEqual([
      { level1: 'Servicios', level2: 'Implantes', levels: ['Servicios', 'Implantes'], paths: ['/implantes'] },
      { level1: 'Blog', level2: 'Guías', levels: ['Blog', 'Guías'], paths: ['/blog', '/blog/seo'] },
    ]);
  });

  it('builds looker CASE expression for cluster levels', () => {
    const level1Case = buildLookerStudioClusterLevelCase('example.com', [
      { level1: 'Servicios', level2: 'Implantes', paths: ['/implantes'] },
    ], 1);
    const level2Case = buildLookerStudioClusterLevelCase('example.com', [
      { level1: 'Servicios', level2: 'Implantes', paths: ['/implantes'] },
    ], 2);

    expect(level1Case).toContain('THEN "Servicios"');
    expect(level2Case).toContain('THEN "Implantes"');
  });

  it('builds URL level CASE expression for looker', () => {
    const level2Case = buildLookerStudioUrlLevelCase(2);
    expect(level2Case).toContain('REGEXP_EXTRACT');
    expect(level2Case).toContain('Sin clasificar');
  });
});
