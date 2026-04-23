import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGSCRequestCache, querySearchAnalyticsPaged } from './googleSearchConsole';

describe('googleSearchConsole querySearchAnalyticsPaged', () => {
  beforeEach(() => {
    clearGSCRequestCache();
    vi.restoreAllMocks();
  });

  it('devuelve datos para consulta básica', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [{ keys: ['2026-04-01'], clicks: 10, impressions: 100, ctr: 0.1, position: 5 }] }),
    } as Response);

    const result = await querySearchAnalyticsPaged('token', {
      siteUrl: 'https://example.com',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      dimensions: ['date'],
      rowLimit: 25,
    });

    expect(result.rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aplica fallback de alta cardinalidad page+query a page por defecto', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [] }),
    } as Response);

    await querySearchAnalyticsPaged('token', {
      siteUrl: 'https://example.com',
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      dimensions: ['query', 'page'],
      rowLimit: 25,
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((request as RequestInit).body));
    expect(body.dimensions).toEqual(['page']);
  });

  it('valida fechas antes de llamar a la API (400 prevention)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(
      querySearchAnalyticsPaged('token', {
        siteUrl: 'https://example.com',
        startDate: '2026-04-30',
        endDate: '2026-04-01',
        dimensions: ['date'],
      }),
    ).rejects.toThrow('startDate');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reintenta con backoff ante quotaExceeded y recupera', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: TimerHandler) => {
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rows: [] }),
      } as Response);

    const result = await querySearchAnalyticsPaged('token', {
      siteUrl: 'https://example.com',
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      dimensions: ['date'],
      rowLimit: 25,
    });

    expect(result.rows).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('usa caché y evita reconsulta para la misma clave', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [] }),
    } as Response);

    const payload = {
      siteUrl: 'https://example.com',
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      dimensions: ['date'] as const,
      rowLimit: 25,
    };

    await querySearchAnalyticsPaged('token', payload);
    await querySearchAnalyticsPaged('token', payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
