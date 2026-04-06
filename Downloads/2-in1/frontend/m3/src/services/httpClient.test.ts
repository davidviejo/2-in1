import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient, HttpClientError } from './httpClient';

describe('httpClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    sessionStorage.clear();
  });

  it('injects Authorization header from sessionStorage', async () => {
    sessionStorage.setItem('portal_token', 'token-123');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const client = createHttpClient({ service: 'api' });
    await client.post('api/test', { hello: 'world' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/test$/),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('throws normalized error with payload when request fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'backend exploded', traceId: 'abc-1' }),
    });

    const client = createHttpClient({ service: 'api' });

    await expect(client.get('api/fail')).rejects.toMatchObject({
      name: 'HttpClientError',
      message: 'backend exploded',
      status: 500,
      payload: { error: 'backend exploded', traceId: 'abc-1' },
    });
  });

  it('aborts on timeout with a standard timeout message', async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementationOnce(async (_url: string, init?: RequestInit) => {
      await new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const client = createHttpClient({ service: 'api', timeoutMs: 10 });
    const request = client.get('api/slow');
    const assertion = expect(request).rejects.toMatchObject({
      name: 'HttpClientError',
      message: 'Request timeout after 10ms',
      isTimeout: true,
    });

    await vi.advanceTimersByTimeAsync(20);
    await assertion;
  });

  it('uses a longer default timeout for engine requests', async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementationOnce(async (_url: string, init?: RequestInit) => {
      await new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const engineClient = createHttpClient({ service: 'engine' });
    const request = engineClient.get('engine/slow');
    let settled = false;
    request.catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(12000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(78001);
    await expect(request).rejects.toMatchObject({
      message: 'Request timeout after 90000ms',
      isTimeout: true,
    });
  });

  it('uses resolveApiUrl/resolveEngineUrl as baseURL fallback', () => {
    const apiClient = createHttpClient({ service: 'api' });
    const engineClient = createHttpClient({ service: 'engine' });

    expect(apiClient.baseURL).toBeTruthy();
    expect(engineClient.baseURL).toBeTruthy();
    expect(engineClient.baseURL).toContain('://');
  });
});
