import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gscDatasetManager } from './gscDatasetManager';
import { querySearchAnalyticsPaged } from './googleSearchConsole';

vi.mock('./googleSearchConsole', () => ({
  querySearchAnalyticsPaged: vi.fn(),
}));

describe('gscDatasetManager', () => {
  const mockedQuery = vi.mocked(querySearchAnalyticsPaged);

  beforeEach(() => {
    mockedQuery.mockReset();
    gscDatasetManager.clear();
    window.localStorage.clear();
  });

  it('deduplica requests en vuelo para la misma consulta lógica', async () => {
    mockedQuery.mockImplementation(
      async () =>
        ({
          rows: [{ keys: ['q1'], clicks: 1, impressions: 10, ctr: 0.1, position: 1 }],
          metadata: { isPartial: false, pagesFetched: 3, rowsFetched: 1 },
        }) as any,
    );

    const params = {
      siteUrl: 'sc-domain:example.com',
      startDate: '2026-04-01',
      endDate: '2026-04-07',
      dimensions: ['query'] as const,
      rowLimit: 100,
      allowHighCardinality: true,
    };

    const [a, b] = await Promise.all([
      gscDatasetManager.fetch('token', params),
      gscDatasetManager.fetch('token', params),
    ]);

    expect(a.rows).toEqual(b.rows);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(gscDatasetManager.getStats().reusedInFlight).toBe(1);
    expect(gscDatasetManager.getStats().realHttpCalls).toBe(3);
  });

  it('reutiliza cache de sesión y evita refetch redundante', async () => {
    mockedQuery.mockResolvedValue({
      rows: [{ keys: ['a'] }],
      metadata: { isPartial: false, pagesFetched: 2, rowsFetched: 1 },
    } as any);

    const params = {
      siteUrl: 'sc-domain:example.com',
      startDate: '2026-04-01',
      endDate: '2026-04-07',
      dimensions: ['query', 'page'] as const,
      rowLimit: 100,
      allowHighCardinality: true,
    };

    await gscDatasetManager.fetch('token', params);
    await gscDatasetManager.fetch('token', params);

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(gscDatasetManager.getStats().cacheHits.session).toBe(1);
  });

  it('query planner elimina duplicados dentro de un bundle', async () => {
    mockedQuery.mockResolvedValue({
      rows: [{ keys: ['same'] }],
      metadata: { isPartial: false, pagesFetched: 1, rowsFetched: 1 },
    } as any);

    const bundle = await gscDatasetManager.fetchBundle('token', [
      {
        id: 'first',
        query: {
          siteUrl: 'sc-domain:example.com',
          startDate: '2026-04-01',
          endDate: '2026-04-07',
          dimensions: ['country'],
          rowLimit: 50,
        },
      },
      {
        id: 'second-duplicate',
        query: {
          siteUrl: 'sc-domain:example.com',
          startDate: '2026-04-01',
          endDate: '2026-04-07',
          dimensions: ['country'],
          rowLimit: 50,
        },
      },
    ]);

    expect(bundle.first.rows).toHaveLength(1);
    expect(bundle['second-duplicate']).toBeUndefined();
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});
