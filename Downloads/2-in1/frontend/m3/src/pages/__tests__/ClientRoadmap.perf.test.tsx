import React, { Profiler } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ClientRoadmap from '../ClientRoadmap';
import { ModuleData, Task } from '../../types';

// Mocks
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../components/ui/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../services/mistralService', () => ({
  enhanceTaskWithMistral: vi.fn(),
  isMistralConfigured: vi.fn(() => true),
}));

vi.mock('../../services/openaiService', () => ({
  enhanceTaskWithOpenAI: vi.fn(),
  isOpenAIConfigured: vi.fn(() => true),
}));

// Mock DnD to render children directly
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: any) => <div>{children}</div>,
  Droppable: ({ children }: any) =>
    children({
      draggableProps: {},
      innerRef: vi.fn(),
      placeholder: null,
    }),
  Draggable: ({ children, draggableId, index }: any) =>
    children(
      {
        draggableProps: { 'data-testid': `draggable-${draggableId}` },
        dragHandleProps: {},
        innerRef: vi.fn(),
      },
      { isDragging: false },
    ),
}));

// Create a large dataset
const generateModules = (count: number): ModuleData[] => {
  const tasks: Task[] = Array.from({ length: count }, (_, i) => ({
    id: `task-${i}`,
    title: `Task ${i}`,
    description: `Description for task ${i}`,
    impact: 'High',
    status: 'pending',
    isInCustomRoadmap: true,
    userNotes: '',
    communicated: false,
    category: 'General',
  }));

  return [
    {
      id: 1,
      title: 'Module 1',
      tasks: tasks,
    } as any,
  ];
};

const modules = generateModules(50); // 50 items to make it significant
const customRoadmapOrder = modules[0].tasks.map((t) => t.id);

describe('ClientRoadmap Performance', () => {
  it('measures re-render performance when expanding a task', async () => {
    const renderTimes: number[] = [];
    const onRender = (
      id: string,
      phase: string,
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number,
    ) => {
      if (phase === 'update') {
        renderTimes.push(actualDuration);
      }
    };

    const props = {
      modules: modules,
      customRoadmapOrder: customRoadmapOrder,
      onReorder: vi.fn(),
      onToggleTask: vi.fn(),
      onRemoveFromRoadmap: vi.fn(),
      onUpdateTaskNotes: vi.fn(),
      onUpdateTaskImpact: vi.fn(),
      clientVertical: 'media',
      clientName: 'Test Client',
      onToggleTaskCommunicated: vi.fn(),
    };

    render(
      <MemoryRouter>
        <Profiler id="ClientRoadmap" onRender={onRender}>
          <ClientRoadmap {...props} />
        </Profiler>
      </MemoryRouter>,
    );

    // Find the first task and click to expand
    const firstTask = screen.getByText('Task 0');
    // We need to click the container that has the onClick handler for expansion
    // In the code: <div className="p-4 flex items-start gap-4 cursor-pointer" onClick={() => setExpandedTask(...) } ...>
    // So clicking the title should work as it bubbles up, or we can find the parent.

    await act(async () => {
      fireEvent.click(firstTask);
    });

    console.log('Update Render Times (ms):', renderTimes);
    // We expect at least one update.
    expect(renderTimes.length).toBeGreaterThan(0);

    // Check average if multiple updates
    const avgTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    console.log(`Average update time: ${avgTime.toFixed(2)}ms`);
  });
});
