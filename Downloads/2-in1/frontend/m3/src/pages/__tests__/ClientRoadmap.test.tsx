import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientRoadmap from '../ClientRoadmap';
import { ModuleData, Task } from '../../types';

// Mocks
vi.mock('../../components/ui/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../services/mistralService', () => ({
  enhanceTaskWithMistral: vi.fn(),
  isMistralConfigured: vi.fn(() => true),
}));

vi.mock('../../services/openaiService', () => ({
  enhanceTaskWithOpenAI: vi.fn(),
  isOpenAIConfigured: vi.fn(() => true),
}));

// Mock DnD to render children directly as it can be tricky in tests
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: any) => <div>{children}</div>,
  Droppable: ({ children }: any) =>
    children({
      draggableProps: {},
      innerRef: vi.fn(),
      placeholder: null,
    }),
  Draggable: ({ children }: any) =>
    children(
      {
        draggableProps: {},
        dragHandleProps: {},
        innerRef: vi.fn(),
      },
      { isDragging: false },
    ),
}));

const mockModules: ModuleData[] = [
  {
    id: 1,
    title: 'Module 1',
    tasks: [
      {
        id: 'task-1',
        title: 'Task 1',
        description: 'Description 1',
        impact: 'High',
        status: 'pending',
        isInCustomRoadmap: true,
      } as Task,
      {
        id: 'task-2',
        title: 'Task 2',
        description: 'Description 2',
        impact: 'Medium',
        status: 'pending',
        isInCustomRoadmap: true,
      } as Task,
    ],
  } as any,
];

describe('ClientRoadmap', () => {
  const defaultProps = {
    modules: mockModules,
    customRoadmapOrder: ['task-1', 'task-2'],
    onReorder: vi.fn(),
    onToggleTask: vi.fn(),
    onRemoveFromRoadmap: vi.fn(),
    onUpdateTaskNotes: vi.fn(),
    onUpdateTaskImpact: vi.fn(),
    clientVertical: 'media',
    clientName: 'Test Client',
    onToggleTaskCommunicated: vi.fn(),
  };

  it('renders tasks in the correct order', () => {
    render(
      <MemoryRouter>
        <ClientRoadmap {...defaultProps} />
      </MemoryRouter>,
    );

    const tasks = screen.getAllByRole('heading', { level: 3 });
    expect(tasks[0].textContent).toContain('Task 1');
    expect(tasks[1].textContent).toContain('Task 2');
  });

  it('renders tasks in reordered order based on customRoadmapOrder', () => {
    const props = {
      ...defaultProps,
      customRoadmapOrder: ['task-2', 'task-1'],
    };
    render(
      <MemoryRouter>
        <ClientRoadmap {...props} />
      </MemoryRouter>,
    );

    const tasks = screen.getAllByRole('heading', { level: 3 });
    expect(tasks[0].textContent).toContain('Task 2');
    expect(tasks[1].textContent).toContain('Task 1');
  });

  it('updates when customRoadmapOrder prop changes', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ClientRoadmap {...defaultProps} />
      </MemoryRouter>,
    );

    let tasks = screen.getAllByRole('heading', { level: 3 });
    expect(tasks[0].textContent).toContain('Task 1');

    const newProps = {
      ...defaultProps,
      customRoadmapOrder: ['task-2', 'task-1'],
    };

    rerender(
      <MemoryRouter>
        <ClientRoadmap {...newProps} />
      </MemoryRouter>,
    );

    tasks = screen.getAllByRole('heading', { level: 3 });
    expect(tasks[0].textContent).toContain('Task 2');
    expect(tasks[1].textContent).toContain('Task 1');
  });
});
