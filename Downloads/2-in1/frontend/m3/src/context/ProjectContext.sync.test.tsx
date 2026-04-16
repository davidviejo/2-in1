import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider, useProject } from './ProjectContext';

const saveSnapshotMock = vi.fn();

vi.mock('../services/projectRemoteRepository', () => ({
  ProjectRemoteRepository: {
    bootstrap: vi.fn().mockResolvedValue({
      version: 1,
      updatedAt: 1,
      currentClientId: 'client-1',
      clients: [
        {
          id: 'client-1',
          name: 'Cliente Demo',
          vertical: 'media',
          createdAt: 1,
          modules: [],
          notes: [],
          completedTasksLog: [],
          customRoadmapOrder: [],
        },
      ],
      generalNotes: [],
    }),
    saveSnapshot: saveSnapshotMock,
  },
}));

vi.mock('../services/clientRepository', () => ({
  ClientRepository: {
    getClients: vi.fn().mockReturnValue([]),
    getGeneralNotes: vi.fn().mockReturnValue([]),
    getCurrentClientId: vi.fn().mockReturnValue(''),
    saveClients: vi.fn(),
    saveCurrentClientId: vi.fn(),
    saveGeneralNotes: vi.fn(),
  },
}));

vi.mock('../strategies/StrategyFactory', () => ({
  StrategyFactory: {
    getStrategy: vi.fn().mockReturnValue({
      getModules: () => [],
      getTemplateVersion: () => 'v1',
    }),
  },
}));

const HookProbe = ({ onReady }: { onReady: (ctx: ReturnType<typeof useProject>) => void }) => {
  const ctx = useProject();
  useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);
  return null;
};

describe('ProjectContext sync behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveSnapshotMock.mockReset();
    saveSnapshotMock.mockResolvedValue({
      version: 2,
      updatedAt: Date.now(),
      currentClientId: 'client-1',
      clients: [],
      generalNotes: [],
    });
  });

  it('debounces saveSnapshot calls and flushes in critical actions', async () => {
    let contextValue: ReturnType<typeof useProject> | null = null;

    render(
      <ProjectProvider>
        <HookProbe onReady={(ctx) => (contextValue = ctx)} />
      </ProjectProvider>,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      contextValue?.addNote('nota rápida 1', 'general');
      contextValue?.addNote('nota rápida 2', 'general');
    });

    expect(saveSnapshotMock).toHaveBeenCalledTimes(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(950);
    });
    expect(saveSnapshotMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      contextValue?.addClient('Cliente crítico', 'media');
      await vi.runOnlyPendingTimersAsync();
    });
    expect(saveSnapshotMock).toHaveBeenCalledTimes(2);
  });
});
