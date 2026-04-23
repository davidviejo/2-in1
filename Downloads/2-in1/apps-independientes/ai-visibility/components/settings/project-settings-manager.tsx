'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type BrandAlias = {
  id: string;
  alias: string;
  normalizedAlias: string;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  primaryDomain: string;
  description: string | null;
  mainCountry: string;
  mainLanguage: string;
  isActive: boolean;
  chartColor: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  brandAliases: BrandAlias[];
};

type ProjectFormState = {
  name: string;
  primaryDomain: string;
  description: string;
  mainCountry: string;
  mainLanguage: string;
  isActive: boolean;
  chartColor: string;
  notes: string;
};

const defaultForm: ProjectFormState = {
  name: '',
  primaryDomain: '',
  description: '',
  mainCountry: 'US',
  mainLanguage: 'en',
  isActive: true,
  chartColor: '#1d4ed8',
  notes: ''
};

function toForm(project?: Project | null): ProjectFormState {
  if (!project) {
    return defaultForm;
  }

  return {
    name: project.name,
    primaryDomain: project.primaryDomain,
    description: project.description ?? '',
    mainCountry: project.mainCountry,
    mainLanguage: project.mainLanguage,
    isActive: project.isActive,
    chartColor: project.chartColor,
    notes: project.notes ?? ''
  };
}

export function ProjectSettingsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('new');
  const [form, setForm] = useState<ProjectFormState>(defaultForm);
  const [aliasInput, setAliasInput] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    setForm(toForm(selectedProject));
    setFieldErrors({});
    setStatusMessage(null);
  }, [selectedProject]);

  async function loadProjects() {
    setLoading(true);
    const response = await fetch('/api/projects', { cache: 'no-store' });
    const data = (await response.json()) as { projects: Project[] };

    setProjects(data.projects ?? []);
    if ((data.projects ?? []).length > 0) {
      setSelectedProjectId((current) => (current === 'new' ? data.projects[0].id : current));
    }
    setLoading(false);
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setStatusMessage(null);

    const method = selectedProject ? 'PATCH' : 'POST';
    const url = selectedProject ? `/api/projects/${selectedProject.id}` : '/api/projects';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = (await response.json()) as {
      project?: Project;
      fieldErrors?: Record<string, string>;
      error?: string;
    };

    if (!response.ok) {
      setFieldErrors(data.fieldErrors ?? {});
      setStatusMessage(data.error === 'validation_failed' ? 'Please fix validation errors.' : 'Request failed.');
      setBusy(false);
      return;
    }

    await loadProjects();

    if (data.project?.id) {
      setSelectedProjectId(data.project.id);
    }

    setStatusMessage(selectedProject ? 'Project updated.' : 'Project created.');
    setBusy(false);
  }

  async function addAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject) {
      setStatusMessage('Create a project before adding aliases.');
      return;
    }

    setBusy(true);
    setFieldErrors({});

    const response = await fetch(`/api/projects/${selectedProject.id}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: aliasInput })
    });

    const data = (await response.json()) as { fieldErrors?: Record<string, string> };

    if (!response.ok) {
      setFieldErrors(data.fieldErrors ?? {});
      setStatusMessage('Alias could not be added.');
      setBusy(false);
      return;
    }

    setAliasInput('');
    await loadProjects();
    setStatusMessage('Alias added.');
    setBusy(false);
  }

  async function removeAlias(aliasId: string) {
    if (!selectedProject) {
      return;
    }

    setBusy(true);
    await fetch(`/api/projects/${selectedProject.id}/aliases?aliasId=${aliasId}`, { method: 'DELETE' });
    await loadProjects();
    setStatusMessage('Alias removed.');
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Project settings</h1>
          <p className="text-xs text-slate-600">Dense setup for analyst workflows: profile, domain, and brand aliases.</p>
        </div>
      </header>

      {loading ? <p className="text-sm text-slate-600">Loading projects…</p> : null}

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-3 py-2">
            <h2 className="text-sm font-semibold text-slate-900">Projects</h2>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            <button
              className="w-full border-b border-slate-100 px-3 py-2 text-left text-xs font-medium text-blue-700 hover:bg-blue-50"
              onClick={() => setSelectedProjectId('new')}
              type="button"
            >
              + New project
            </button>
            {projects.map((project) => (
              <button
                className={`w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                  selectedProjectId === project.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'
                }`}
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{project.name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${project.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                    {project.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-500">{project.primaryDomain}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <form className="rounded-md border border-slate-200 bg-white" onSubmit={submitProject}>
            <div className="border-b border-slate-200 px-3 py-2">
              <h2 className="text-sm font-semibold text-slate-900">{selectedProject ? 'Edit project' : 'Create project'}</h2>
            </div>
            <div className="grid gap-2 p-3 md:grid-cols-2">
              {[
                ['Project name', 'name'],
                ['Primary domain', 'primaryDomain'],
                ['Main country', 'mainCountry'],
                ['Main language', 'mainLanguage'],
                ['Chart color', 'chartColor']
              ].map(([label, field]) => (
                <label className="space-y-1 text-xs font-medium text-slate-700" key={field}>
                  {label}
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value
                      }))
                    }
                    value={form[field as keyof ProjectFormState] as string}
                  />
                  {fieldErrors[field] ? <p className="text-[11px] text-red-700">{fieldErrors[field]}</p> : null}
                </label>
              ))}

              <label className="space-y-1 text-xs font-medium text-slate-700 md:col-span-2">
                Project description
                <textarea
                  className="min-h-16 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  value={form.description}
                />
              </label>

              <label className="space-y-1 text-xs font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  className="min-h-20 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  value={form.notes}
                />
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  type="checkbox"
                />
                Active
              </label>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
              <p className="text-[11px] text-slate-500">
                {selectedProject ? `Created ${new Date(selectedProject.createdAt).toLocaleString()} • Updated ${new Date(selectedProject.updatedAt).toLocaleString()}` : 'New project'}
              </p>
              <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled={busy} type="submit">
                {selectedProject ? 'Save changes' : 'Create project'}
              </button>
            </div>
          </form>

          <section className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2">
              <h2 className="text-sm font-semibold text-slate-900">Brand aliases</h2>
            </div>
            <form className="flex gap-2 border-b border-slate-200 p-3" onSubmit={addAlias}>
              <input
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                onChange={(event) => setAliasInput(event.target.value)}
                placeholder="Add alias"
                value={aliasInput}
              />
              <button className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium" disabled={busy || !selectedProject} type="submit">
                Add
              </button>
            </form>
            {fieldErrors.alias ? <p className="px-3 pt-2 text-xs text-red-700">{fieldErrors.alias}</p> : null}
            <div className="max-h-56 overflow-y-auto">
              {(selectedProject?.brandAliases ?? []).map((alias) => (
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2" key={alias.id}>
                  <div>
                    <p className="text-sm text-slate-900">{alias.alias}</p>
                    <p className="text-[11px] text-slate-500">Updated {new Date(alias.updatedAt).toLocaleString()}</p>
                  </div>
                  <button className="text-xs font-medium text-red-700" onClick={() => void removeAlias(alias.id)} type="button">
                    Remove
                  </button>
                </div>
              ))}
              {selectedProject && selectedProject.brandAliases.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-500">No aliases yet.</p>
              ) : null}
            </div>
          </section>

          {statusMessage ? <p className="text-xs font-medium text-slate-700">{statusMessage}</p> : null}
        </section>
      </div>
    </div>
  );
}
