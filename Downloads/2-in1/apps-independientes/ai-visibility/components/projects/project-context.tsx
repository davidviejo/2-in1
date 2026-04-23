'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Project = {
  id: string;
  name: string;
};

type ProjectContextValue = {
  currentProjectId: string;
  currentProject: Project | null;
  projects: Project[];
  loading: boolean;
  hasProjects: boolean;
  setCurrentProjectId: (projectId: string) => void;
  refreshProjects: () => Promise<void>;
};

const STORAGE_KEY = 'ai-visibility.current-project-id';

const ProjectContext = createContext<ProjectContextValue | null>(null);

async function fetchProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects', { cache: 'no-store' });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { projects?: Project[] };
  return data.projects ?? [];
}

function resolveProjectId(projects: Project[], preferredProjectId: string | null): string {
  if (!projects.length) {
    return '';
  }

  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }

  return projects[0].id;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectIdState] = useState('');
  const [loading, setLoading] = useState(true);

  const setCurrentProjectId = useCallback((projectId: string) => {
    setCurrentProjectIdState(projectId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, projectId);
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    setLoading(true);

    const nextProjects = await fetchProjects();
    const storedProjectId = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;

    setProjects(nextProjects);
    setCurrentProjectIdState((previousProjectId) => {
      const nextProjectId = resolveProjectId(nextProjects, previousProjectId || storedProjectId);

      if (typeof window !== 'undefined') {
        if (nextProjectId) {
          window.localStorage.setItem(STORAGE_KEY, nextProjectId);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }

      return nextProjectId;
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const value = useMemo<ProjectContextValue>(() => {
    const currentProject = projects.find((project) => project.id === currentProjectId) ?? null;

    return {
      currentProjectId,
      currentProject,
      projects,
      loading,
      hasProjects: projects.length > 0,
      setCurrentProjectId,
      refreshProjects
    };
  }, [currentProjectId, loading, projects, refreshProjects, setCurrentProjectId]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error('useProjectContext must be used inside ProjectProvider');
  }

  return context;
}
