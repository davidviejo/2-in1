'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useProjectContext } from '@/components/projects/project-context';

type Tag = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  _count?: { promptTags: number };
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
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<TagForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedTag = useMemo(() => tags.find((tag) => tag.id === selectedTagId) ?? null, [selectedTagId, tags]);

  useEffect(() => {
    if (!selectedTag) {
      setForm(defaultForm);
      return;
    }

    setForm({ name: selectedTag.name, description: selectedTag.description ?? '' });
  }, [selectedTag]);

  useEffect(() => {
    if (!currentProjectId) {
      setTags([]);
      return;
    }

    void loadTags(currentProjectId, searchTerm);
  }, [currentProjectId, searchTerm]);

  async function loadTags(projectId: string, query: string) {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set('q', query.trim());
    }

    const response = await fetch(`/api/projects/${projectId}/tags?${params.toString()}`, { cache: 'no-store' });

    if (!response.ok) {
      setTags([]);
      setStatusMessage('Project data is unavailable. Select another project.');
      return;
    }

    const data = (await response.json()) as { tags: Tag[] };
    setTags(data.tags ?? []);
  }

  async function submitTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentProjectId) {
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setStatusMessage(null);

    const method = selectedTag ? 'PATCH' : 'POST';
    const url = selectedTag ? `/api/projects/${currentProjectId}/tags/${selectedTag.id}` : `/api/projects/${currentProjectId}/tags`;

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
    await loadTags(currentProjectId, searchTerm);
    setStatusMessage(selectedTag ? 'Tag updated.' : 'Tag created.');
    setBusy(false);
  }

  async function deleteTag(tagId: string) {
    if (!currentProjectId) {
      return;
    }

    setBusy(true);
    const response = await fetch(`/api/projects/${currentProjectId}/tags/${tagId}`, { method: 'DELETE' });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      setStatusMessage(data.message ?? 'Unable to delete tag.');
      setBusy(false);
      return;
    }
    await loadTags(currentProjectId, searchTerm);
    setStatusMessage('Tag deleted.');
    setBusy(false);
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading project…</p>;
  }

  if (!hasProjects) {
    return <p className="text-sm text-slate-600">No accessible projects. Create one in Settings or request access.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Tags · {currentProject?.name}</h1>

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
                  <p className="text-[11px] text-slate-500">Usage: {tag._count?.promptTags ?? 0}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <a className="rounded border border-slate-300 bg-white px-2 py-1" href={`/prompts?tagIds=${encodeURIComponent(tag.id)}`}>Prompts</a>
                  <a className="rounded border border-slate-300 bg-white px-2 py-1" href={`/responses?tag=${encodeURIComponent(tag.name)}`}>Responses</a>
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
          {tags.length === 0 ? <p className="px-3 py-4 text-xs text-slate-500">No tags found for this project.</p> : null}
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
            <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled={busy || !currentProjectId} type="submit">
              {selectedTag ? 'Save tag' : 'Create tag'}
            </button>
          </form>
        </section>
      </div>

      {statusMessage ? <p className="text-xs font-medium text-slate-700">{statusMessage}</p> : null}
    </div>
  );
}
