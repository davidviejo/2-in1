'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Project = { id: string; name: string };
type Tag = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
};

type TagForm = {
  name: string;
  description: string;
};

const defaultForm: TagForm = {
  name: '',
  description: ''
};

export function TagsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<TagForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedTag = useMemo(() => tags.find((tag) => tag.id === selectedTagId) ?? null, [selectedTagId, tags]);

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedTag) {
      setForm(defaultForm);
      return;
    }

    setForm({ name: selectedTag.name, description: selectedTag.description ?? '' });
  }, [selectedTag]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    void loadTags(selectedProjectId, searchTerm);
  }, [searchTerm, selectedProjectId]);

  async function loadProjects() {
    const response = await fetch('/api/projects', { cache: 'no-store' });
    const data = (await response.json()) as { projects: Project[] };
    const nextProjects = data.projects ?? [];

    setProjects(nextProjects);

    if (nextProjects[0] && !selectedProjectId) {
      setSelectedProjectId(nextProjects[0].id);
    }
  }

  async function loadTags(projectId: string, query: string) {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set('q', query.trim());
    }

    const response = await fetch(`/api/projects/${projectId}/tags?${params.toString()}`, { cache: 'no-store' });
    const data = (await response.json()) as { tags: Tag[] };

    setTags(data.tags ?? []);
  }

  async function submitTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setStatusMessage(null);

    const method = selectedTag ? 'PATCH' : 'POST';
    const url = selectedTag ? `/api/projects/${selectedProjectId}/tags/${selectedTag.id}` : `/api/projects/${selectedProjectId}/tags`;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = (await response.json()) as { fieldErrors?: Record<string, string>; error?: string };

    if (!response.ok) {
      setFieldErrors(data.fieldErrors ?? {});
      setStatusMessage(data.error === 'validation_failed' ? 'Please fix validation errors.' : 'Request failed.');
      setBusy(false);
      return;
    }

    setSelectedTagId(null);
    setForm(defaultForm);
    await loadTags(selectedProjectId, searchTerm);
    setStatusMessage(selectedTag ? 'Tag updated.' : 'Tag created.');
    setBusy(false);
  }

  async function deleteTag(tagId: string) {
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    await fetch(`/api/projects/${selectedProjectId}/tags/${tagId}`, { method: 'DELETE' });
    await loadTags(selectedProjectId, searchTerm);
    setStatusMessage('Tag deleted.');
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Tags</h1>

      <section className="rounded-md border border-slate-200 bg-white p-3">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Project
          <select
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            onChange={(event) => {
              setSelectedProjectId(event.target.value);
              setSelectedTagId(null);
              setForm(defaultForm);
            }}
            value={selectedProjectId}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <input
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by tag name"
              value={searchTerm}
            />
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {tags.map((tag) => (
              <li className="flex items-center justify-between px-3 py-2" key={tag.id}>
                <div>
                  <p className="font-medium text-slate-900">{tag.name}</p>
                  <p className="text-xs text-slate-500">{tag.description || 'No description'}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button className="rounded border border-slate-300 bg-white px-2 py-1" onClick={() => setSelectedTagId(tag.id)} type="button">
                    Edit
                  </button>
                  <button className="rounded border border-red-300 bg-white px-2 py-1 text-red-700" onClick={() => void deleteTag(tag.id)} type="button">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-3">
          <form className="space-y-3" onSubmit={submitTag}>
            <h2 className="text-sm font-semibold text-slate-900">{selectedTag ? 'Edit tag' : 'Create tag'}</h2>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Name
              <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} />
              {fieldErrors.name ? <p className="text-[11px] text-red-700">{fieldErrors.name}</p> : null}
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Description (optional)
              <textarea className="min-h-20 w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} value={form.description} />
              {fieldErrors.description ? <p className="text-[11px] text-red-700">{fieldErrors.description}</p> : null}
            </label>
            <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled={busy || !selectedProjectId} type="submit">
              {selectedTag ? 'Save tag' : 'Create tag'}
            </button>
          </form>
        </section>
      </div>

      {statusMessage ? <p className="text-xs font-medium text-slate-700">{statusMessage}</p> : null}
    </div>
  );
}
