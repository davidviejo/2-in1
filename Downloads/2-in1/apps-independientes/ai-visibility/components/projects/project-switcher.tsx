'use client';

import { useProjectContext } from '@/components/projects/project-context';

export function ProjectSwitcher() {
  const { currentProjectId, loading, projects, setCurrentProjectId } = useProjectContext();

  return (
    <label className="space-y-1 text-xs font-medium text-slate-700">
      Project
      <select
        className="min-w-56 rounded border border-slate-300 px-2 py-1 text-sm"
        disabled={loading || projects.length === 0}
        onChange={(event) => setCurrentProjectId(event.target.value)}
        value={currentProjectId}
      >
        {projects.length === 0 ? <option value="">No projects available</option> : null}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}
