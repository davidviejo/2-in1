import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPageMetricsBulkByUrl, querySearchAnalyticsPaged } from './googleSearchConsole';

describe('googleSearchConsole service hardening', () => {
  const accessToken = 'token';
  const siteUrl = 'sc-domain:example.com';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('handles small properties with a single cheap query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rows: [{ keys: ['foo'], clicks: 10, impressions: 100, ctr: 0.1, position: 3 }] }),
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const response = await querySearchAnalyticsPaged(accessToken, {
      siteUrl,
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      dimensions: ['query'],
      rowLimit: 100,
    });

    expect(response.rows).toHaveLength(1);
    expect(response.metadata.isPartial).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('applies safe fallback when query+page cross join is not explicitly allowed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rows: [] }),
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const response = await querySearchAnalyticsPaged(accessToken, {
      siteUrl,
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      dimensions: ['query', 'page'],
      rowLimit: 100,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.dimensions).toEqual(['page']);
    expect(response.metadata.truncatedReason).toBe('safety_stop');
  });

  it('rejects malformed 400-style input before sending request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(
      querySearchAnalyticsPaged(accessToken, {
        siteUrl,
        startDate: '2026/04/01',
        endDate: '2026-04-03',
        dimensions: ['query'],
      }),
    ).rejects.toThrow('Formato de fecha inválido');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries with backoff on 403 quota reasons and recovers', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Quota reached', errors: [{ reason: 'quotaExceeded' }] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ rows: [{ keys: ['foo'], clicks: 1, impressions: 10, ctr: 0.1, position: 2 }] }),
      });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const queryPromise = querySearchAnalyticsPaged(accessToken, {
      siteUrl,
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      dimensions: ['query'],
    });

    await vi.runAllTimersAsync();
    const response = await queryPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.rows).toHaveLength(1);
  });

  it('chunks date ranges for large properties and reuses cache', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rows: [{ keys: ['bar'], clicks: 2, impressions: 20, ctr: 0.1, position: 4 }] }),
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const firstPromise = querySearchAnalyticsPaged(accessToken, {
      siteUrl,
      startDate: '2026-04-01',
      endDate: '2026-04-14',
      dimensions: ['query'],
      rowLimit: 100,
    });
    await vi.runAllTimersAsync();
    const first = await firstPromise;
    const callsAfterFirstRun = fetchMock.mock.calls.length;

    const secondPromise = querySearchAnalyticsPaged(accessToken, {
      siteUrl,
      startDate: '2026-04-01',
      endDate: '2026-04-14',
      dimensions: ['query'],
      rowLimit: 100,
    });
    await vi.runAllTimersAsync();
    const second = await secondPromise;

    expect(first.rows.length).toBeGreaterThanOrEqual(2);
    expect(second.rows).toEqual(first.rows);
    expect(callsAfterFirstRun).toBeGreaterThan(1);
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirstRun);
  });

  it('maps bulk page metrics back to requested URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        rows: [
          { keys: ['https://example.com/url-a/'], clicks: 5, impressions: 50, ctr: 0.1, position: 4 },
          { keys: ['https://example.com/url-b'], clicks: 2, impressions: 20, ctr: 0.1, position: 8 },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const metricsByUrl = await getPageMetricsBulkByUrl(
      accessToken,
      'sc-domain:bulk-example.com',
      ['https://example.com/url-a', 'https://example.com/url-b/', 'https://example.com/url-c'],
      '2026-04-01',
      '2026-04-28',
    );

    expect(Object.keys(metricsByUrl)).toEqual(['https://example.com/url-a', 'https://example.com/url-b/']);
    expect(metricsByUrl['https://example.com/url-a'].clicks).toBe(5);
    expect(metricsByUrl['https://example.com/url-b/'].impressions).toBe(20);
  });
});
