'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useProjectContext } from '@/components/projects/project-context';

type Tag = { id: string; name: string; description: string | null };
type PromptTag = { tag: Tag };

type Prompt = {
  id: string;
  title: string;
  promptText: string;
  objective: string | null;
  language: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  promptTags: PromptTag[];
};

type PromptForm = {
  title: string;
  promptText: string;
  objective: string;
  language: string;
  status: Prompt['status'];
  tagIds: string[];
};

const defaultForm: PromptForm = {
  title: '',
  promptText: '',
  objective: '',
  language: 'es',
  status: 'ACTIVE',
  tagIds: []
};

function toForm(prompt: Prompt | null): PromptForm {
  if (!prompt) {
    return defaultForm;
  }

  return {
    title: prompt.title,
    promptText: prompt.promptText,
    objective: prompt.objective ?? '',
    language: prompt.language,
    status: prompt.status,
    tagIds: prompt.promptTags.map((item) => item.tag.id)
  };
}

export function PromptsManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const [tags, setTags] = useState<Tag[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [form, setForm] = useState<PromptForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedPrompt = useMemo(() => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null, [prompts, selectedPromptId]);

  useEffect(() => {
    setForm(toForm(selectedPrompt));
  }, [selectedPrompt]);

  useEffect(() => {
    if (!currentProjectId) {
      setTags([]);
      setPrompts([]);
      return;
    }

    void Promise.all([loadTags(currentProjectId), loadPrompts(currentProjectId, searchTerm, activeTagIds)]);
  }, [activeTagIds, currentProjectId, searchTerm]);

  async function loadTags(projectId: string) {
    const response = await fetch(`/api/projects/${projectId}/tags`, { cache: 'no-store' });

    if (!response.ok) {
      setTags([]);
      return;
    }

    const data = (await response.json()) as { tags: Tag[] };
    setTags(data.tags ?? []);
  }

  async function loadPrompts(projectId: string, query: string, tagIds: string[]) {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set('q', query.trim());
    }

    if (tagIds.length > 0) {
      params.set('tagIds', tagIds.join(','));
    }

    const response = await fetch(`/api/projects/${projectId}/prompts?${params.toString()}`, { cache: 'no-store' });

    if (!response.ok) {
      setPrompts([]);
      setStatusMessage('Project data is unavailable. Select another project.');
      return;
    }

    const data = (await response.json()) as { prompts: Prompt[] };
    setPrompts(data.prompts ?? []);
  }

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentProjectId) {
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setStatusMessage(null);

    const method = selectedPrompt ? 'PATCH' : 'POST';
    const url = selectedPrompt
      ? `/api/projects/${currentProjectId}/prompts/${selectedPrompt.id}`
      : `/api/projects/${currentProjectId}/prompts`;

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

    setSelectedPromptId(null);
    setForm(defaultForm);
    await loadPrompts(currentProjectId, searchTerm, activeTagIds);
    setStatusMessage(selectedPrompt ? 'Prompt updated.' : 'Prompt created.');
    setBusy(false);
  }

  async function deletePrompt(promptId: string) {
    if (!currentProjectId) {
      return;
    }

    setBusy(true);
    await fetch(`/api/projects/${currentProjectId}/prompts/${promptId}`, { method: 'DELETE' });
    await loadPrompts(currentProjectId, searchTerm, activeTagIds);
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
      <h1 className="text-xl font-semibold text-slate-900">Prompts · {currentProject?.name}</h1>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="space-y-2 border-b border-slate-200 p-3">
            <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search prompts" value={searchTerm} />
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isActive = activeTagIds.includes(tag.id);

                return (
                  <button
                    className={`rounded-full border px-2 py-1 text-xs ${isActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                    key={tag.id}
                    onClick={() => {
                      setActiveTagIds((current) => (current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id]));
                    }}
                    type="button"
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <ul className="divide-y divide-slate-100 text-sm">
            {prompts.map((prompt) => (
              <li className="flex items-center justify-between px-3 py-2" key={prompt.id}>
                <div>
                  <p className="font-medium text-slate-900">{prompt.title}</p>
                  <p className="text-xs text-slate-500">{prompt.status} · {prompt.language}</p>
                  <p className="text-xs text-slate-500">Tags: {prompt.promptTags.map((item) => item.tag.name).join(', ') || '—'}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button className="rounded border border-slate-300 bg-white px-2 py-1" onClick={() => setSelectedPromptId(prompt.id)} type="button">Edit</button>
                  <button className="rounded border border-red-300 bg-white px-2 py-1 text-red-700" onClick={() => void deletePrompt(prompt.id)} type="button">Delete</button>
                </div>
              </li>
            ))}
          </ul>
          {prompts.length === 0 ? <p className="px-3 py-4 text-xs text-slate-500">No prompts found for this project.</p> : null}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-3">
          <form className="space-y-3" onSubmit={submitPrompt}>
            <h2 className="text-sm font-semibold text-slate-900">{selectedPrompt ? 'Edit prompt' : 'Create prompt'}</h2>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Title
              <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
              {fieldErrors.title ? <p className="text-[11px] text-red-700">{fieldErrors.title}</p> : null}
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Prompt text
              <textarea className="min-h-20 w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, promptText: event.target.value }))} value={form.promptText} />
              {fieldErrors.promptText ? <p className="text-[11px] text-red-700">{fieldErrors.promptText}</p> : null}
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Objective
              <textarea className="min-h-14 w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} value={form.objective} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Tags
              <select
                className="min-h-24 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                multiple
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions, (option) => option.value);
                  setForm((current) => ({ ...current, tagIds: values }));
                }}
                value={form.tagIds}
              >
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Language
                <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))} value={form.language} />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Status
                <select className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Prompt['status'] }))} value={form.status}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </label>
            </div>
            <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled={busy || !currentProjectId} type="submit">
              {selectedPrompt ? 'Save prompt' : 'Create prompt'}
            </button>
          </form>
        </section>
      </div>

      {statusMessage ? <p className="text-xs font-medium text-slate-700">{statusMessage}</p> : null}
    </div>
  );
}
