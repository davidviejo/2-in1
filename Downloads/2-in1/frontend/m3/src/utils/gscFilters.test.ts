import { describe, expect, it } from 'vitest';
import {
  classifyTemplateByUrl,
  buildLookerStudioClusterCase,
  buildLookerStudioUrlLevelCase,
  matchesPathPrefix,
  matchesQuerySegment,
  parseBrandTermsInput,
  parseCustomClusters,
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
    const parsed = parseCustomClusters('Blog|/blog\nLocal|/bilbao,/valencia');
    expect(parsed).toEqual([
      { name: 'Blog', paths: ['/blog'] },
      { name: 'Local', paths: ['/bilbao', '/valencia'] },
    ]);
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

  it('builds URL level CASE expression for looker', () => {
    const level2Case = buildLookerStudioUrlLevelCase(2);
    expect(level2Case).toContain('REGEXP_EXTRACT');
    expect(level2Case).toContain('Sin clasificar');
  });
});
