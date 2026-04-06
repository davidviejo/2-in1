import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { ClientRepository } from '../services/clientRepository';
import { ReactNode } from 'react';

// Mock ClientRepository
vi.mock('../services/clientRepository', () => ({
  ClientRepository: {
    getClients: vi.fn(),
    saveClients: vi.fn(),
    getCurrentClientId: vi.fn(),
    saveCurrentClientId: vi.fn(),
    getGeneralNotes: vi.fn(),
    saveGeneralNotes: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <ProjectProvider>{children}</ProjectProvider>
);

describe('ProjectContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ClientRepository.getClients as any).mockReturnValue([
      {
        id: '1',
        name: 'Test Project',
        vertical: 'media',
        modules: [],
        createdAt: 12345,
        notes: [],
        completedTasksLog: [],
        customRoadmapOrder: [],
      },
    ]);
    (ClientRepository.getCurrentClientId as any).mockReturnValue('1');
    (ClientRepository.getGeneralNotes as any).mockReturnValue([]);
  });

  it('should initialize with clients from repository', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    expect(result.current.clients).toHaveLength(1);
    expect(result.current.currentClientId).toBe('1');
  });

  it('should add a new client', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    act(() => {
      result.current.addClient('New Project', 'ecom');
    });

    expect(result.current.clients).toHaveLength(2);
    expect(result.current.clients[1].name).toBe('New Project');
    expect(result.current.clients[1].vertical).toBe('ecom');
    expect(result.current.currentClientId).not.toBe('1'); // Should switch to new client
  });

  it('should switch client', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    act(() => {
      result.current.addClient('Client 2', 'local');
    });

    const newClientId = result.current.clients[1].id;

    act(() => {
      result.current.switchClient('1');
    });

    expect(result.current.currentClientId).toBe('1');

    act(() => {
      result.current.switchClient(newClientId);
    });

    expect(result.current.currentClientId).toBe(newClientId);
  });

  it('should add a general note', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    act(() => {
      result.current.addNote('Test Note', 'general');
    });

    expect(result.current.generalNotes).toHaveLength(1);
    expect(result.current.generalNotes[0].content).toBe('Test Note');
  });

  it('should restore project data', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    const backupClient = {
      id: 'backup-client',
      name: 'Backup Client',
      vertical: 'media' as const,
      modules: [],
      createdAt: 12345,
      notes: [],
      completedTasksLog: [],
      customRoadmapOrder: [],
    };

    const backupNotes = [{ id: 'n1', content: 'Backup Note', createdAt: 12345 }];

    act(() => {
      result.current.restoreProjectData([backupClient], backupNotes, 'backup-client');
    });

    expect(result.current.clients.find((c) => c.id === 'backup-client')).toBeDefined();
    expect(result.current.generalNotes).toHaveLength(1); // Since mock returns empty initially
    expect(result.current.generalNotes[0].content).toBe('Backup Note');
    expect(result.current.currentClientId).toBe('backup-client');
  });

  it('should overwrite existing client on restore', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    const originalClient = result.current.clients[0];

    const backupVersion = {
      ...originalClient,
      name: 'Restored Name',
    };

    act(() => {
      result.current.restoreProjectData([backupVersion], [], originalClient.id);
    });

    const restored = result.current.clients.find((c) => c.id === originalClient.id);
    expect(restored?.name).toBe('Restored Name');
  });

  it('should update iaVisibility config and manage history', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    act(() => {
      result.current.updateIAVisibilityConfig({
        language: 'en',
        competitors: ['competidor-1'],
      });
    });

    expect(result.current.currentClient?.iaVisibility?.config.language).toBe('en');
    expect(result.current.currentClient?.iaVisibility?.config.competitors).toEqual(['competidor-1']);

    act(() => {
      result.current.saveIAVisibilityRunResult({
        id: 'run-1',
        createdAt: 123,
        prompt: '¿Qué marca recomiendas?',
        answer: 'Marca A',
        competitorMentions: [],
        sentimentSummary: { positive: 1, neutral: 0, negative: 0 },
      });
      result.current.saveIAVisibilityRunResult({
        id: 'run-2',
        createdAt: 124,
        prompt: '¿Qué herramienta SEO es mejor?',
        answer: 'Herramienta B',
        competitorMentions: [],
        sentimentSummary: { positive: 0, neutral: 1, negative: 0 },
      });
    });

    expect(result.current.currentClient?.iaVisibility?.history).toHaveLength(2);

    act(() => {
      result.current.filterIAVisibilityHistory(['run-2']);
    });

    expect(result.current.currentClient?.iaVisibility?.history.map((entry) => entry.id)).toEqual([
      'run-2',
    ]);

    act(() => {
      result.current.clearIAVisibilityHistory();
    });

    expect(result.current.currentClient?.iaVisibility?.history).toEqual([]);
  });

});
