'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { HistoricalImporter } from '@/components/imports/historical-importer';
import { useProjectContext } from '@/components/projects/project-context';

type Tag = { id: string; name: string; description: string | null };
type PromptTag = { tag: Tag };

type Prompt = {
  id: string;
  promptText: string;
  country: string;
  language: string;
  isActive: boolean;
  priority: number;
  notes: string | null;
  intentClassification: string | null;
  promptTags: PromptTag[];
  responsesCount: number;
  mentionRate: number | null;
  citationRate: number | null;
  lastRunDate: string | null;
};

type PromptForm = {
  promptText: string;
  country: string;
  language: string;
  isActive: boolean;
  priority: number;
  notes: string;
  tagIds: string[];
  intentClassification: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const defaultForm: PromptForm = {
  promptText: '',
  country: 'US',
  language: 'en',
  isActive: true,
  priority: 100,
  notes: '',
  tagIds: [],
  intentClassification: ''
};

const defaultPagination: Pagination = {
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 1
};

function toForm(prompt: Prompt | null): PromptForm {
  if (!prompt) {
    return defaultForm;
  }

  return {
    promptText: prompt.promptText,
    country: prompt.country,
    language: prompt.language,
    isActive: prompt.isActive,
    priority: prompt.priority,
    notes: prompt.notes ?? '',
    tagIds: prompt.promptTags.map((item) => item.tag.id),
    intentClassification: prompt.intentClassification ?? ''
  };
}

function formatRate(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleDateString();
}

export function PromptsManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const [tags, setTags] = useState<Tag[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [intentFilter, setIntentFilter] = useState('');
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>(defaultPagination);
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
      setPagination(defaultPagination);
      return;
    }

    void Promise.all([loadTags(currentProjectId), loadPrompts(currentProjectId, 1)]);
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId) {
      return;
    }

    void loadPrompts(currentProjectId, 1);
  }, [activeFilter, activeTagIds, countryFilter, currentProjectId, intentFilter, languageFilter, searchTerm]);



  async function refreshPromptWorkspace() {
    if (!currentProjectId) {
      return;
    }

    await Promise.all([loadTags(currentProjectId), loadPrompts(currentProjectId, 1)]);
  }

  async function loadTags(projectId: string) {
    const response = await fetch(`/api/projects/${projectId}/tags`, { cache: 'no-store' });

    if (!response.ok) {
      setTags([]);
      return;
    }

    const data = (await response.json()) as { tags: Tag[] };
    setTags(data.tags ?? []);
  }

  async function loadPrompts(projectId: string, page: number) {
    const params = new URLSearchParams();

    if (searchTerm.trim()) {
      params.set('q', searchTerm.trim());
    }

    if (countryFilter.trim()) {
      params.set('country', countryFilter.trim().toUpperCase());
    }

    if (languageFilter.trim()) {
      params.set('language', languageFilter.trim().toLowerCase());
    }

    if (activeFilter !== 'all') {
      params.set('active', activeFilter);
    }

    if (intentFilter.trim()) {
      params.set('intentClassification', intentFilter.trim());
    }

    if (activeTagIds.length > 0) {
      params.set('tagIds', activeTagIds.join(','));
    }

    params.set('page', String(page));
    params.set('pageSize', String(pagination.pageSize));

    const response = await fetch(`/api/projects/${projectId}/prompts?${params.toString()}`, { cache: 'no-store' });

    if (!response.ok) {
      setPrompts([]);
      setStatusMessage('Project data is unavailable. Select another project.');
      return;
    }

    const data = (await response.json()) as { prompts: Prompt[]; pagination: Pagination };
    setPrompts(data.prompts ?? []);
    setPagination(data.pagination ?? defaultPagination);
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
    await loadPrompts(currentProjectId, pagination.page);
    setStatusMessage(selectedPrompt ? 'Prompt updated.' : 'Prompt created.');
    setBusy(false);
  }

  async function deletePrompt(promptId: string) {
    if (!currentProjectId) {
      return;
    }

    setBusy(true);
    await fetch(`/api/projects/${currentProjectId}/prompts/${promptId}`, { method: 'DELETE' });
    await loadPrompts(currentProjectId, pagination.page);
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

      <HistoricalImporter onImported={refreshPromptWorkspace} />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="space-y-2 border-b border-slate-200 p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <input className="rounded border border-slate-300 px-2 py-1 text-xs" onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search prompt text/notes" value={searchTerm} />
              <input className="rounded border border-slate-300 px-2 py-1 text-xs" maxLength={2} onChange={(event) => setCountryFilter(event.target.value)} placeholder="Country (US)" value={countryFilter} />
              <input className="rounded border border-slate-300 px-2 py-1 text-xs" onChange={(event) => setLanguageFilter(event.target.value)} placeholder="Language (en)" value={languageFilter} />
              <input className="rounded border border-slate-300 px-2 py-1 text-xs" onChange={(event) => setIntentFilter(event.target.value)} placeholder="Intent classification" value={intentFilter} />
              <select className="rounded border border-slate-300 px-2 py-1 text-xs" onChange={(event) => setActiveFilter(event.target.value as 'all' | 'active' | 'inactive')} value={activeFilter}>
                <option value="all">All states</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isActive = activeTagIds.includes(tag.id);

                return (
                  <button
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${isActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
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

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-[28%] px-2 py-1 font-medium">Prompt text</th>
                  <th className="px-2 py-1 font-medium">Country</th>
                  <th className="px-2 py-1 font-medium">Lang</th>
                  <th className="px-2 py-1 font-medium">Responses</th>
                  <th className="px-2 py-1 font-medium">Mention rate</th>
                  <th className="px-2 py-1 font-medium">Citation rate</th>
                  <th className="px-2 py-1 font-medium">Last run</th>
                  <th className="px-2 py-1 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prompts.map((prompt) => (
                  <tr className="align-top" key={prompt.id}>
                    <td className="px-2 py-1">
                      <p className="line-clamp-2 text-slate-900">{prompt.promptText}</p>
                      <p className="text-[11px] text-slate-500">
                        P{prompt.priority} · {prompt.isActive ? 'Active' : 'Inactive'} · Tags: {prompt.promptTags.map((item) => item.tag.name).join(', ') || '—'}
                      </p>
                    </td>
                    <td className="px-2 py-1 text-slate-700">{prompt.country}</td>
                    <td className="px-2 py-1 text-slate-700">{prompt.language}</td>
                    <td className="px-2 py-1 text-slate-700">{prompt.responsesCount}</td>
                    <td className="px-2 py-1 text-slate-700">{formatRate(prompt.mentionRate)}</td>
                    <td className="px-2 py-1 text-slate-700">{formatRate(prompt.citationRate)}</td>
                    <td className="px-2 py-1 text-slate-700">{formatDate(prompt.lastRunDate)}</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button className="rounded border border-slate-300 bg-white px-2 py-0.5" onClick={() => setSelectedPromptId(prompt.id)} type="button">Edit</button>
                        <button className="rounded border border-red-300 bg-white px-2 py-0.5 text-red-700" onClick={() => void deletePrompt(prompt.id)} type="button">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {prompts.length === 0 ? <p className="px-3 py-4 text-xs text-slate-500">No prompts found for this project.</p> : null}
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span>
              Page {pagination.page} / {pagination.totalPages} · {pagination.total} total
            </span>
            <div className="flex gap-2">
              <button className="rounded border border-slate-300 px-2 py-1" disabled={pagination.page <= 1} onClick={() => currentProjectId && void loadPrompts(currentProjectId, pagination.page - 1)} type="button">
                Prev
              </button>
              <button
                className="rounded border border-slate-300 px-2 py-1"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => currentProjectId && void loadPrompts(currentProjectId, pagination.page + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-3">
          <form className="space-y-3" onSubmit={submitPrompt}>
            <h2 className="text-sm font-semibold text-slate-900">{selectedPrompt ? 'Edit prompt' : 'Create prompt'}</h2>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Prompt text
              <textarea className="min-h-24 w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, promptText: event.target.value }))} value={form.promptText} />
              {fieldErrors.promptText ? <p className="text-[11px] text-red-700">{fieldErrors.promptText}</p> : null}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Country
                <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" maxLength={2} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value.toUpperCase() }))} value={form.country} />
                {fieldErrors.country ? <p className="text-[11px] text-red-700">{fieldErrors.country}</p> : null}
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Language
                <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))} value={form.language} />
                {fieldErrors.language ? <p className="text-[11px] text-red-700">{fieldErrors.language}</p> : null}
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Priority
                <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" min={1} onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value) }))} type="number" value={form.priority} />
                {fieldErrors.priority ? <p className="text-[11px] text-red-700">{fieldErrors.priority}</p> : null}
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Intent classification (optional)
                <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, intentClassification: event.target.value }))} value={form.intentClassification} />
                {fieldErrors.intentClassification ? <p className="text-[11px] text-red-700">{fieldErrors.intentClassification}</p> : null}
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" />
              Active
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Notes
              <textarea className="min-h-16 w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} value={form.notes} />
              {fieldErrors.notes ? <p className="text-[11px] text-red-700">{fieldErrors.notes}</p> : null}
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
