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

  it('detects spikes that happened before the latest days in the selected range', () => {
    const trends = detectTrendingUrls([
      { keys: ['https://example.com/c', '2026-03-10'], clicks: 8, impressions: 120, ctr: 0.06, position: 8 },
      { keys: ['https://example.com/c', '2026-03-11'], clicks: 10, impressions: 130, ctr: 0.07, position: 8 },
      { keys: ['https://example.com/c', '2026-03-12'], clicks: 9, impressions: 125, ctr: 0.07, position: 8 },
      { keys: ['https://example.com/c', '2026-03-13'], clicks: 11, impressions: 135, ctr: 0.08, position: 7.8 },
      { keys: ['https://example.com/c', '2026-03-14'], clicks: 10, impressions: 128, ctr: 0.08, position: 7.7 },
      { keys: ['https://example.com/c', '2026-03-15'], clicks: 9, impressions: 122, ctr: 0.07, position: 7.7 },
      { keys: ['https://example.com/c', '2026-03-16'], clicks: 13, impressions: 160, ctr: 0.08, position: 7.5 },
      { keys: ['https://example.com/c', '2026-03-17'], clicks: 438, impressions: 9590, ctr: 0.045, position: 4.5 },
      { keys: ['https://example.com/c', '2026-03-18'], clicks: 41, impressions: 1682, ctr: 0.024, position: 6.2 },
      { keys: ['https://example.com/c', '2026-03-19'], clicks: 15, impressions: 220, ctr: 0.07, position: 7.2 },
      { keys: ['https://example.com/c', '2026-03-20'], clicks: 11, impressions: 150, ctr: 0.07, position: 7.3 },
      { keys: ['https://example.com/c', '2026-03-21'], clicks: 10, impressions: 145, ctr: 0.07, position: 7.6 },
      { keys: ['https://example.com/c', '2026-03-22'], clicks: 9, impressions: 140, ctr: 0.06, position: 7.8 },
      { keys: ['https://example.com/c', '2026-03-23'], clicks: 8, impressions: 132, ctr: 0.06, position: 8 },
      { keys: ['https://example.com/c', '2026-03-24'], clicks: 9, impressions: 138, ctr: 0.06, position: 8.1 },
      { keys: ['https://example.com/c', '2026-03-25'], clicks: 10, impressions: 140, ctr: 0.07, position: 7.9 },
    ]);

    expect(trends.length).toBeGreaterThanOrEqual(1);

    const dailyTrend = trends.find((trend) => trend.periodKey === '24h');
    expect(dailyTrend).toBeTruthy();
    expect(dailyTrend?.url).toBe('https://example.com/c');
    expect(dailyTrend?.peakRange).toBe('2026-03-17');
    expect(dailyTrend?.currentClicks).toBe(438);
  });
});
