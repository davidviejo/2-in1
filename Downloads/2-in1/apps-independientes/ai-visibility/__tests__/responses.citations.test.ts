import { describe, expect, it } from 'vitest';

import {
  extractAndNormalizeCitations,
  groupCitations,
  normalizeHost,
  normalizeRootDomain
} from '@/lib/responses/citations';

describe('citation normalization helpers', () => {
  it('normalizes hosts and strips protocol, path, and www', () => {
    expect(normalizeHost('https://WWW.Blog.Example.com/path?a=1')).toBe('blog.example.com');
    expect(normalizeHost('example.com/article')).toBe('example.com');
  });

  it('normalizes root domains including common compound suffixes', () => {
    expect(normalizeRootDomain('news.bbc.co.uk')).toBe('bbc.co.uk');
    expect(normalizeRootDomain('sub.api.example.com')).toBe('example.com');
  });
});

describe('citation extraction and grouping', () => {
  it('extracts deterministic citations from response text and structured inputs', () => {
    const citations = extractAndNormalizeCitations({
      responseText:
        'Sources: https://www.acme.com/blog/post, reddit.com/r/seo and (https://globex.co.uk/reports?q=1).',
      rawSources: {
        sources: [
          { url: 'https://maps.google.com/?q=acme' },
          { sourceUrl: 'https://www.acme.com/blog/post' },
          { host: 'careers.globex.co.uk' }
        ]
      },
      clientDomains: ['acme.com'],
      competitorDomains: ['globex.co.uk']
    });

    expect(citations).toHaveLength(5);
    expect(citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rootDomain: 'acme.com',
          host: 'acme.com',
          isClientDomain: true,
          isCompetitorDomain: false,
          sourceType: 'owned'
        }),
        expect.objectContaining({
          rootDomain: 'reddit.com',
          isClientDomain: false,
          isCompetitorDomain: false,
          sourceType: 'ugc'
        }),
        expect.objectContaining({
          rootDomain: 'globex.co.uk',
          isClientDomain: false,
          isCompetitorDomain: true,
          sourceType: 'competitor'
        }),
        expect.objectContaining({
          rootDomain: 'google.com',
          host: 'maps.google.com',
          sourceType: 'other'
        }),
        expect.objectContaining({
          host: 'careers.globex.co.uk',
          rootDomain: 'globex.co.uk',
          isCompetitorDomain: true
        })
      ])
    );
  });

  it('groups citations by domain, host, and page', () => {
    const citations = extractAndNormalizeCitations({
      responseText: 'https://example.com/a https://blog.example.com/b https://example.com/a',
      rawSources: [{ url: 'https://example.com/c' }]
    });

    const byDomain = groupCitations(citations, 'domain');
    const byHost = groupCitations(citations, 'host');
    const byPage = groupCitations(citations, 'page');

    expect(byDomain).toHaveLength(1);
    expect(byDomain[0]?.key).toBe('example.com');
    expect(byDomain[0]?.citations).toHaveLength(3);

    expect(byHost).toHaveLength(2);
    expect(byHost.find((entry) => entry.key === 'example.com')?.citations).toHaveLength(2);
    expect(byHost.find((entry) => entry.key === 'blog.example.com')?.citations).toHaveLength(1);

    expect(byPage).toHaveLength(3);
    expect(byPage.map((entry) => entry.key)).toEqual([
      'https://blog.example.com/b',
      'https://example.com/a',
      'https://example.com/c'
    ]);
  });

  it('classifies social and directory sources when ownership does not apply', () => {
    const citations = extractAndNormalizeCitations({
      responseText: 'linkedin.com/company/acme and https://www.yelp.com/biz/acme and https://forbes.com/story'
    });

    expect(citations).toEqual([
      expect.objectContaining({ rootDomain: 'linkedin.com', sourceType: 'social' }),
      expect.objectContaining({ rootDomain: 'yelp.com', sourceType: 'directory' }),
      expect.objectContaining({ rootDomain: 'forbes.com', sourceType: 'media' })
    ]);
  });
});
