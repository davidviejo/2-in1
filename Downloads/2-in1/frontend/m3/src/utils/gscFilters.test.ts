import { describe, expect, it } from 'vitest';
import {
  classifyTemplateByUrl,
  matchesPathPrefix,
  matchesQuerySegment,
  parseBrandTermsInput,
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
});
