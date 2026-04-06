import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { ProjectProvider, useProject } from './ProjectContext';
import { vi, test, expect, describe } from 'vitest';

// Mock dependencies
vi.mock('../services/clientRepository', () => ({
  ClientRepository: {
    getClients: vi.fn().mockReturnValue([
      {
        id: 'client-1',
        name: 'Test Client',
        vertical: 'media',
        modules: [
          { id: 1, title: 'Module 1', tasks: [] },
          { id: 9, title: 'Module 9', tasks: [], isCustom: true },
        ],
        customRoadmapOrder: [],
      },
    ]),
    getGeneralNotes: vi.fn().mockReturnValue([]),
    getCurrentClientId: vi.fn().mockReturnValue('client-1'),
    saveClients: vi.fn(),
    saveCurrentClientId: vi.fn(),
    saveGeneralNotes: vi.fn(),
  },
}));

vi.mock('../strategies/StrategyFactory', () => ({
  StrategyFactory: {
    getStrategy: vi.fn().mockReturnValue({
      getModules: () => [],
    }),
  },
}));

const TestComponent = ({ onMount }: { onMount: (context: any) => void }) => {
  const context = useProject();
  useEffect(() => {
    onMount(context);
  }, [context]); // Removed onMount from deps to avoid loop if onMount is not memoized in test
  return <div>Test</div>;
};

describe('ProjectContext - addTasksBulk', () => {
  test('adds multiple tasks correctly', async () => {
    let context: any;
    const onMount = (ctx: any) => {
      context = ctx;
    };

    render(
      <ProjectProvider>
        <TestComponent onMount={onMount} />
      </ProjectProvider>,
    );

    const tasksToAdd = [
      {
        moduleId: 1,
        title: 'Task 1',
        description: 'Desc 1',
        impact: 'High' as const,
        category: 'Test',
        status: 'pending',
        isInRoadmap: true,
      },
      {
        moduleId: 1,
        title: 'Task 2',
        description: 'Desc 2',
        impact: 'Medium' as const,
        category: 'Test',
        status: 'pending',
        isInRoadmap: true,
      },
      {
        moduleId: 9,
        title: 'Task 3',
        description: 'Desc 3',
        impact: 'Low' as const,
        category: 'Test',
        status: 'pending',
        isInRoadmap: false,
      },
    ];

    await act(async () => {
      context.addTasksBulk(tasksToAdd);
    });

    // Check if tasks were added
    // Re-access context? No, context variable in test is stale?
    // Wait, the context variable is updated via onMount when context changes?
    // ProjectContext updates value reference on change.
    // So TestComponent will re-render and call onMount with NEW context.

    // However, onMount is called in useEffect.
    // So `context` variable in test scope will be updated.

    // Let's verify via console log or just trust it.

    const module1 = context.modules.find((m: any) => m.id === 1);
    expect(module1.tasks).toHaveLength(2);
    expect(module1.tasks[0].title).toBe('Task 1');
    expect(module1.tasks[1].title).toBe('Task 2');

    const module9 = context.modules.find((m: any) => m.id === 9);
    expect(module9.tasks).toHaveLength(1);
    expect(module9.tasks[0].title).toBe('Task 3');

    // Check customRoadmapOrder
    const roadmapOrder = context.currentClient.customRoadmapOrder;
    expect(roadmapOrder).toHaveLength(2);
    expect(roadmapOrder).toContain(module1.tasks[0].id);
    expect(roadmapOrder).toContain(module1.tasks[1].id);
    expect(roadmapOrder).not.toContain(module9.tasks[0].id);
  });
});
