import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ClientRepository } from './clientRepository';

vi.mock('../strategies/StrategyFactory', () => ({
  StrategyFactory: {
    getStrategy: vi.fn().mockReturnValue({
      getModules: () => [
        { id: 8, title: 'Extras', subtitle: '', levelRange: '', description: '', iconName: '', tasks: [] },
        { id: 9, title: 'MIA', subtitle: '', levelRange: '', description: '', iconName: '', tasks: [] },
      ],
      getTemplateVersion: () => "test-v1",
    }),
  },
}));

describe('ClientRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes legacy frontend verticals to media when restoring saved clients', () => {
    localStorage.setItem(
      'mediaflow_clients',
      JSON.stringify([
        {
          id: 'frontend-project',
          name: 'Frontend Project',
          vertical: 'frontend',
          modules: [],
          createdAt: Date.now(),
        },
      ]),
    );

    const clients = ClientRepository.getClients();

    expect(clients[0].vertical).toBe('media');
  });

  it('saves clients with unsupported verticals normalized to media', () => {
    ClientRepository.saveClients([
      {
        id: 'frontend-project',
        name: 'Frontend Project',
        vertical: 'frontend' as never,
        modules: [],
        createdAt: Date.now(),
      },
    ]);

    const saved = JSON.parse(localStorage.getItem('mediaflow_clients_cache_v2') || '[]');

    expect(saved[0].vertical).toBe('media');
  });



  it('migrates modules when template version changes preserving completed task states', () => {
    localStorage.setItem(
      'mediaflow_clients_cache_v2',
      JSON.stringify([
        {
          id: 'client-1',
          name: 'Client 1',
          vertical: 'media',
          templateVersion: 'old-version',
          modules: [
            {
              id: 8,
              title: 'Extras',
              subtitle: '',
              levelRange: '',
              description: '',
              iconName: '',
              tasks: [{ id: 'm8-legacy', title: 'Legacy', description: '', impact: 'Low', status: 'completed', isCustom: true }],
            },
            {
              id: 9,
              title: 'MIA',
              subtitle: '',
              levelRange: '',
              description: '',
              iconName: '',
              tasks: [],
            },
          ],
          createdAt: Date.now(),
        },
      ]),
    );

    const clients = ClientRepository.getClients();

    expect(clients[0].templateVersion).toBe('test-v1');
    expect(clients[0].modules.find((m) => m.id === 8)?.tasks[0].status).toBe('completed');
  });

  it('initializes iaVisibility defaults for legacy clients without the field', () => {
    localStorage.setItem(
      'mediaflow_clients',
      JSON.stringify([
        {
          id: 'legacy-client',
          name: 'Legacy Client',
          vertical: 'media',
          modules: [],
          createdAt: Date.now(),
        },
      ]),
    );

    const clients = ClientRepository.getClients();

    expect(clients[0].iaVisibility).toBeDefined();
    expect(clients[0].iaVisibility?.history).toEqual([]);
    expect(clients[0].iaVisibility?.config.language).toBe('es');
  });

  it('normalizes partial iaVisibility payloads from legacy storage', () => {
    localStorage.setItem(
      'mediaflow_clients',
      JSON.stringify([
        {
          id: 'legacy-ia-client',
          name: 'Legacy IA Client',
          vertical: 'media',
          modules: [],
          createdAt: Date.now(),
          iaVisibility: {
            config: {
              language: 'en',
              competitors: ['A', 'B'],
            },
            history: [{ id: 'run-1', prompt: 'test', answer: 'ok', createdAt: Date.now() }],
          },
        },
      ]),
    );

    const clients = ClientRepository.getClients();

    expect(clients[0].iaVisibility?.config.language).toBe('en');
    expect(clients[0].iaVisibility?.config.tone).toBe('neutral');
    expect(clients[0].iaVisibility?.history[0].sentimentSummary).toEqual({
      positive: 0,
      neutral: 0,
      negative: 0,
    });
  });

});
