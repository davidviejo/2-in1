import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClientError } from './httpClient';
import { openaiApi } from './openaiApi';

describe('openaiApi integration contracts', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    sessionStorage.clear();
  });

  it('returns valid response for enhance-task', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'Tarea vitaminizada' }),
    });

    const response = await openaiApi.enhanceTask({
      task: { title: 'Actualizar schema' },
      vertical: 'media',
    });

    expect(response.result).toBe('Tarea vitaminizada');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ai\/openai\/enhance-task$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns valid clusters for clusterize endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        clusters: [{ id: '1', cluster: 'seo tecnico', reason: 'title+h1' }],
      }),
    });

    const response = await openaiApi.clusterize([{ id: '1', url: 'https://example.com', title: 'SEO', h1: 'SEO técnico' }]);

    expect(response.clusters).toEqual([{ id: '1', cluster: 'seo tecnico', reason: 'title+h1' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ai\/openai\/clusterize$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces backend auth/configuration errors', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(openaiApi.seoAnalysis({ content: 'x', type: 'audit' })).rejects.toBeInstanceOf(HttpClientError);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 424,
      json: async () => ({ error: 'OpenAI no configurado en servidor' }),
    });

    await expect(openaiApi.seoAnalysis({ content: 'x', type: 'audit' })).rejects.toMatchObject({
      status: 424,
      message: 'OpenAI no configurado en servidor',
    });
  });
});
