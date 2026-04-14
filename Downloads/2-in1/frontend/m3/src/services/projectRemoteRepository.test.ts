import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRemoteRepository } from './projectRemoteRepository';

vi.mock('../strategies/StrategyFactory', () => ({
  StrategyFactory: {
    primeTemplates: vi.fn().mockResolvedValue(undefined),
    getStrategy: vi.fn().mockReturnValue({
      getModules: () => [],
      getTemplateVersion: () => 'test-v1',
    }),
  },
}));

const createClient = () => ({
  id: 'client-1',
  name: 'Cliente 1',
  vertical: 'media',
  modules: [],
  createdAt: Date.now(),
  notes: [],
  completedTasksLog: [],
  customRoadmapOrder: [],
});

describe('ProjectRemoteRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('seeds remote snapshot from local cache when server is empty', async () => {
    const localClient = createClient();
    localStorage.setItem('mediaflow_clients_cache_v2', JSON.stringify([localClient]));
    localStorage.setItem('mediaflow_general_notes', '[]');
    localStorage.setItem('mediaflow_current_client_id', localClient.id);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: 1, updatedAt: 1, currentClientId: '', clients: [], generalNotes: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            version: 2,
            updatedAt: 2,
            currentClientId: localClient.id,
            clients: [localClient],
            generalNotes: [],
          }),
          { status: 200 },
        ),
      );

    const snapshot = await ProjectRemoteRepository.bootstrap();

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(putCall).toBeDefined();
    const putPayload = JSON.parse(String(putCall?.[1]?.body));
    expect(putPayload.clients).toHaveLength(1);
    expect(snapshot.clients).toHaveLength(1);
  });

  it('does not seed when local cache is empty', async () => {
    localStorage.setItem('mediaflow_clients_cache_v2', '[]');
    localStorage.setItem('mediaflow_general_notes', '[]');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: 1, updatedAt: 1, currentClientId: '', clients: [], generalNotes: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: 1, updatedAt: 2, currentClientId: '', clients: [], generalNotes: [] }), { status: 200 }),
      );

    const snapshot = await ProjectRemoteRepository.bootstrap();

    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
    expect(snapshot.clients).toEqual([]);
  });
});
