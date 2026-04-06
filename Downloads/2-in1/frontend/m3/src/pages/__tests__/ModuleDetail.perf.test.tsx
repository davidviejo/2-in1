import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ModuleDetail from '../ModuleDetail';
import { ModuleData, Task } from '../../types';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as SettingsContextModule from '../../context/SettingsContext';
import * as ToastContextModule from '../../components/ui/ToastContext';

// Mock scrollTo
window.scrollTo = vi.fn();

const mockSettings = {
  settings: {
    openaiApiKey: '',
    mistralApiKey: '',
    geminiApiKey: '',
    openaiModel: '',
    mistralModel: '',
    geminiModel: '',
  },
  updateSettings: vi.fn(),
  getApiKey: vi.fn(),
};

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  addToast: vi.fn(),
  removeToast: vi.fn(),
};

const createMockTasks = (count: number): Task[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i}`,
    title: `Task ${i}`,
    description: `Description for task ${i}`,
    impact: 'Medium',
    status: 'incomplete',
    category: 'General',
    isCustom: false,
    communicated: false,
    isInCustomRoadmap: false,
  }));
};

const mockModules: ModuleData[] = [
  {
    id: 1,
    title: 'Module 1',
    subtitle: 'Subtitle 1',
    levelRange: '0-10',
    description: 'Description 1',
    iconName: 'icon',
    tasks: createMockTasks(500),
  },
];

describe('ModuleDetail Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock hooks
    vi.spyOn(SettingsContextModule, 'useSettings').mockReturnValue(mockSettings as any);
    vi.spyOn(ToastContextModule, 'useToast').mockReturnValue(mockToast as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('measures render time when expanding a task', async () => {
    const onToggleTask = vi.fn();
    const onAddTask = vi.fn();
    const onDeleteTask = vi.fn();
    const onUpdateTaskNotes = vi.fn();
    const onUpdateTaskImpact = vi.fn();
    const onToggleCustomRoadmap = vi.fn();
    const onToggleTaskCommunicated = vi.fn();

    render(
      <MemoryRouter initialEntries={['/module/1']}>
        <Routes>
          <Route
            path="/module/:id"
            element={
              <ModuleDetail
                modules={mockModules}
                onToggleTask={onToggleTask}
                onAddTask={onAddTask}
                onDeleteTask={onDeleteTask}
                onUpdateTaskNotes={onUpdateTaskNotes}
                onUpdateTaskImpact={onUpdateTaskImpact}
                clientVertical="test"
                onToggleCustomRoadmap={onToggleCustomRoadmap}
                onToggleTaskCommunicated={onToggleTaskCommunicated}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const taskToClick = screen.getByText('Task 100');

    const start = performance.now();
    fireEvent.click(taskToClick);
    const end = performance.now();

    console.log(`Expansion time with 500 items: ${(end - start).toFixed(2)}ms`);

    // Verify it expanded
    expect(screen.queryByText('Description for task 100')).toBeTruthy();
  });
});
