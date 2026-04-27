import { describe, expect, it } from 'vitest';

import { buildCitationExplorerGroups } from '@/lib/responses/citations-explorer';

describe('citations explorer grouping', () => {
  const rows = [
    { sourceUrl: 'https://example.com/a', sourceDomain: 'example.com' },
    { sourceUrl: 'https://blog.example.com/b', sourceDomain: 'example.com' },
    { sourceUrl: 'https://example.com/c', sourceDomain: 'example.com' },
    { sourceUrl: 'https://reddit.com/r/ai', sourceDomain: 'reddit.com' },
    { sourceUrl: 'https://globex.co.uk/news', sourceDomain: 'globex.co.uk' }
  ];

  it('uses the same builder for domain, host, and page grouping', () => {
    const domain = buildCitationExplorerGroups({
      rows,
      groupBy: 'domain',
      sortBy: 'count',
      clientDomains: ['example.com'],
      competitorDomains: ['globex.co.uk']
    });

    const host = buildCitationExplorerGroups({
      rows,
      groupBy: 'host',
      sortBy: 'count',
      clientDomains: ['example.com'],
      competitorDomains: ['globex.co.uk']
    });

    const page = buildCitationExplorerGroups({
      rows,
      groupBy: 'page',
      sortBy: 'count',
      clientDomains: ['example.com'],
      competitorDomains: ['globex.co.uk']
    });

    expect(domain.total).toBe(rows.length);
    expect(host.total).toBe(rows.length);
    expect(page.total).toBe(rows.length);

    expect(domain.groups.map((group) => ({ key: group.key, count: group.count }))).toEqual([
      { key: 'example.com', count: 3 },
      { key: 'globex.co.uk', count: 1 },
      { key: 'reddit.com', count: 1 }
    ]);

    expect(host.groups.map((group) => ({ key: group.key, count: group.count }))).toEqual([
      { key: 'example.com', count: 2 },
      { key: 'blog.example.com', count: 1 },
      { key: 'globex.co.uk', count: 1 },
      { key: 'reddit.com', count: 1 }
    ]);

    expect(page.groups).toHaveLength(5);
    expect(page.groups.every((group) => group.count === 1)).toBe(true);
  });

  it('returns share and source/ownership flags per group', () => {
    const result = buildCitationExplorerGroups({
      rows,
      groupBy: 'domain',
      sortBy: 'share',
      clientDomains: ['example.com'],
      competitorDomains: ['globex.co.uk']
    });

    expect(result.groups[0]).toEqual(
      expect.objectContaining({
        key: 'example.com',
        count: 3,
        share: 0.6,
        isClientDomain: true,
        isCompetitorDomain: false,
        sourceType: 'owned'
      })
    );

    expect(result.groups.find((group) => group.key === 'globex.co.uk')).toEqual(
      expect.objectContaining({
        isClientDomain: false,
        isCompetitorDomain: true,
        sourceType: 'competitor'
      })
    );

    expect(result.groups.find((group) => group.key === 'reddit.com')).toEqual(
      expect.objectContaining({
        sourceType: 'ugc'
      })
    );
  });
});
