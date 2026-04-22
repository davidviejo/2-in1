import { describe, expect, it } from 'vitest';
import { detectTrendingUrls, getVisibleSelectedGscSite } from './Dashboard';

describe('getVisibleSelectedGscSite', () => {
  it('returns the selected site when it is still present in the filtered list', () => {
    expect(
      getVisibleSelectedGscSite('sc-domain:example.com', [
        { siteUrl: 'sc-domain:example.com' },
        { siteUrl: 'sc-domain:example.org' },
      ]),
    ).toBe('sc-domain:example.com');
  });

  it('returns an empty value when the selected site is not present in the filtered list', () => {
    expect(
      getVisibleSelectedGscSite('sc-domain:example.com', [
        { siteUrl: 'sc-domain:example.org' },
      ]),
    ).toBe('');
  });
});

describe('detectTrendingUrls', () => {
  it('detects urls with a clear short-term clicks spike and assigns daily window metadata', () => {
    const trends = detectTrendingUrls([
      { keys: ['https://example.com/a', '2026-04-01'], clicks: 4, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/a', '2026-04-02'], clicks: 3, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/a', '2026-04-03'], clicks: 5, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/a', '2026-04-04'], clicks: 4, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/a', '2026-04-05'], clicks: 4, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/a', '2026-04-06'], clicks: 5, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/a', '2026-04-07'], clicks: 4, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/a', '2026-04-08'], clicks: 48, impressions: 400, ctr: 0.12, position: 3.2 },
    ]);

    expect(trends).toHaveLength(1);
    expect(trends[0].url).toBe('https://example.com/a');
    expect(trends[0].periodKey).toBe('24h');
    expect(trends[0].peakRange).toBe('2026-04-08');
    expect(trends[0].clickIncrease).toBeGreaterThan(20);
  });

  it('ignores urls without a significant spike', () => {
    const trends = detectTrendingUrls([
      { keys: ['https://example.com/b', '2026-04-01'], clicks: 8, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/b', '2026-04-02'], clicks: 9, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/b', '2026-04-03'], clicks: 10, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/b', '2026-04-04'], clicks: 11, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/b', '2026-04-05'], clicks: 12, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/b', '2026-04-06'], clicks: 9, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/b', '2026-04-07'], clicks: 10, impressions: 0, ctr: 0, position: 0 },
      { keys: ['https://example.com/b', '2026-04-08'], clicks: 11, impressions: 0, ctr: 0, position: 0 },
    ]);

    expect(trends).toHaveLength(0);
  });
});
