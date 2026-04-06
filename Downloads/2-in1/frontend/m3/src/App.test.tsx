import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';

vi.mock('./components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('./components/ui/Spinner', () => ({
  Spinner: () => <div>loading</div>,
}));

vi.mock('./context/ProjectContext', () => ({
  ProjectProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProject: () => ({
    modules: [],
    globalScore: 0,
    clients: [{ id: 'frontend-project', name: 'Frontend Project', vertical: 'media' }],
    currentClientId: 'frontend-project',
    currentClient: { id: 'frontend-project', name: 'Frontend Project', vertical: 'media', notes: [], completedTasksLog: [] },
    generalNotes: [],
    switchClient: vi.fn(),
    addClient: vi.fn(),
    deleteClient: vi.fn(),
    resetCurrentProject: vi.fn(),
    addTask: vi.fn(),
    deleteTask: vi.fn(),
    toggleTask: vi.fn(),
    updateTaskNotes: vi.fn(),
    updateTaskImpact: vi.fn(),
    toggleTaskCommunicated: vi.fn(),
    toggleCustomRoadmapTask: vi.fn(),
    handleReorderRoadmap: vi.fn(),
    addManualCompletedTask: vi.fn(),
    deleteCompletedTaskLog: vi.fn(),
    addNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  }),
}));

vi.mock('./pages/Dashboard', () => ({
  default: () => <div>dashboard page</div>,
}));
vi.mock('./pages/ModuleDetail', () => ({ default: () => <div>module detail</div> }));
vi.mock('./pages/SpeedChallenge', () => ({ default: () => <div>speed challenge</div> }));
vi.mock('./pages/CompletedTasks', () => ({ default: () => <div>completed tasks</div> }));
vi.mock('./pages/ClientRoadmap', () => ({ default: () => <div>client roadmap</div> }));
vi.mock('./pages/KanbanBoard', () => ({ default: () => <div>kanban</div> }));
vi.mock('./pages/AIRoadmap', () => ({ default: () => <div>ai roadmap</div> }));
vi.mock('./pages/IAVisibility', () => ({ default: () => <div>ia visibility</div> }));
vi.mock('./pages/SeoChecklistPage', () => ({ default: () => <div>seo checklist</div> }));
vi.mock('./pages/Settings', () => ({ default: () => <div>settings</div> }));
vi.mock('./pages/admin/AdminIdeasPage', () => ({ default: () => <div>admin ideas</div> }));
vi.mock('./pages/portal/LandingPage', () => ({ default: () => <div>landing</div> }));
vi.mock('./pages/portal/ClientsLogin', () => ({ default: () => <div>clients login</div> }));
vi.mock('./pages/portal/ProjectsList', () => ({ default: () => <div>projects list</div> }));
vi.mock('./pages/portal/ProjectLogin', () => ({ default: () => <div>project login</div> }));
vi.mock('./pages/portal/ProjectOverview', () => ({ default: () => <div>project overview</div> }));
vi.mock('./pages/portal/OperatorPage', () => ({ default: () => <div>operator</div> }));

describe('AppRoutes', () => {
  it('renders the internal dashboard when entering /app', async () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText('dashboard page')).toBeTruthy();
    expect(screen.getByTestId('layout')).toBeTruthy();
  });

  it('renders IA Visibility route in the internal app', async () => {
    render(
      <MemoryRouter initialEntries={['/app/ia-visibility']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText('ia visibility')).toBeTruthy();
    expect(screen.getByTestId('layout')).toBeTruthy();
  });
});
