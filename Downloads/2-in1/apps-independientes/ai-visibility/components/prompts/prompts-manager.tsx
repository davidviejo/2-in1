'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { HistoricalImporter } from '@/components/imports/historical-importer';
import { useProjectContext } from '@/components/projects/project-context';
import { SharedReportingFilters } from '@/components/reporting/shared-filters';
import { normalizeCountry, normalizeLanguage, normalizeSearchTerm } from '@/lib/filters/normalization';

type PromptTag = { tag: { id: string; name: string; description: string | null } };

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

type PromptMetric = {
  promptId: string;
  validResponses: number;
  mentionRate: { value: number | null };
  citationRate: { value: number | null };
  bestAnalysisMode: string | null;
  worstAnalysisMode: string | null;
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
  if (!prompt) return defaultForm;
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
  if (value === null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function currentRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 27 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function PromptsManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptMetrics, setPromptMetrics] = useState<Record<string, PromptMetric>>({});
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(params.get('q') ?? '');
  const [countryFilter, setCountryFilter] = useState(params.get('country') ?? '');
  const [languageFilter, setLanguageFilter] = useState(params.get('language') ?? '');
  const [tagFilter, setTagFilter] = useState(params.get('tagIds') ?? '');
  const [analysisModeFilter, setAnalysisModeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [intentFilter, setIntentFilter] = useState('');
  const [pagination, setPagination] = useState<Pagination>(defaultPagination);
  const [form, setForm] = useState<PromptForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [runMode, setRunMode] = useState<'chatgpt' | 'gemini' | 'ai_mode' | 'ai_overview'>('chatgpt');
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const selectedPrompt = useMemo(() => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null, [prompts, selectedPromptId]);

  useEffect(() => setForm(toForm(selectedPrompt)), [selectedPrompt]);

  useEffect(() => {
    if (!currentProjectId) return;
    void Promise.all([loadPrompts(currentProjectId, 1), loadPromptMetrics(currentProjectId)]);
  }, [currentProjectId, analysisModeFilter]);

  useEffect(() => {
    if (!currentProjectId) return;
    void loadPrompts(currentProjectId, 1);
  }, [activeFilter, countryFilter, currentProjectId, intentFilter, languageFilter, searchTerm, tagFilter]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (searchTerm) next.set('q', searchTerm);
    if (countryFilter) next.set('country', countryFilter);
    if (languageFilter) next.set('language', languageFilter);
    if (tagFilter) next.set('tagIds', tagFilter);
    if (activeFilter !== 'all') next.set('active', activeFilter);
    if (intentFilter) next.set('intentClassification', intentFilter);
    router.replace(`${pathname}?${next.toString()}`);
  }, [activeFilter, countryFilter, intentFilter, languageFilter, pathname, router, searchTerm, tagFilter]);

  async function loadPromptMetrics(projectId: string) {
    const range = currentRange();
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (analysisModeFilter) params.set('analysisMode', analysisModeFilter);
    const response = await fetch(`/api/projects/${projectId}/by-prompt?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return setPromptMetrics({});
    const data = (await response.json()) as { prompts: PromptMetric[] };
    const map: Record<string, PromptMetric> = {};
    for (const row of data.prompts ?? []) map[row.promptId] = row;
    setPromptMetrics(map);
  }

  async function loadPrompts(projectId: string, page: number) {
    const params = new URLSearchParams();
    const normalizedSearch = normalizeSearchTerm(searchTerm);
    if (normalizedSearch) params.set('q', normalizedSearch);
    const normalizedCountry = normalizeCountry(countryFilter);
    if (normalizedCountry) params.set('country', normalizedCountry);
    const normalizedLanguage = normalizeLanguage(languageFilter);
    if (normalizedLanguage) params.set('language', normalizedLanguage);
    if (activeFilter !== 'all') params.set('active', activeFilter);
    const normalizedIntent = normalizeSearchTerm(intentFilter);
    if (normalizedIntent) params.set('intentClassification', normalizedIntent);
    if (tagFilter) params.set('tagIds', tagFilter);
    params.set('page', String(page));
    params.set('pageSize', String(pagination.pageSize));
    const response = await fetch(`/api/projects/${projectId}/prompts?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return setPrompts([]);
    const data = (await response.json()) as { prompts: Prompt[]; pagination: Pagination };
    setPrompts(data.prompts ?? []);
    setPagination(data.pagination ?? defaultPagination);
  }

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentProjectId) return;
    setBusy(true);
    setFieldErrors({});
    const method = selectedPrompt ? 'PATCH' : 'POST';
    const url = selectedPrompt ? `/api/projects/${currentProjectId}/prompts/${selectedPrompt.id}` : `/api/projects/${currentProjectId}/prompts`;
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = (await response.json()) as { fieldErrors?: Record<string, string>; error?: string };
    if (!response.ok) {
      setFieldErrors(data.fieldErrors ?? {});
      setBusy(false);
      return;
    }
    setSelectedPromptId(null);
    setForm(defaultForm);
    await Promise.all([loadPrompts(currentProjectId, pagination.page), loadPromptMetrics(currentProjectId)]);
    setBusy(false);
  }

  async function deletePrompt(promptId: string) {
    if (!currentProjectId) return;
    setBusy(true);
    await fetch(`/api/projects/${currentProjectId}/prompts/${promptId}`, { method: 'DELETE' });
    await Promise.all([loadPrompts(currentProjectId, pagination.page), loadPromptMetrics(currentProjectId)]);
    setBusy(false);
  }

  async function runLiveAnalysis(promptId: string, country: string, language: string) {
    if (!currentProjectId) return;
    setBusy(true);
    setRunMessage(null);

    const response = await fetch(`/api/projects/${currentProjectId}/analyses/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptId,
        analysisMode: runMode,
        country,
        language,
        environment: 'live-api'
      })
    });

    const data = (await response.json()) as { runId?: string; message?: string; fieldErrors?: Record<string, string> };

    if (!response.ok) {
      setRunMessage(data.message ?? data.fieldErrors?.analysisMode ?? 'Analysis failed. Check API credentials in env.');
      setBusy(false);
      return;
    }

    setRunMessage(`Live run completed (${runMode}) · Run ID: ${data.runId ?? 'n/a'}`);
    await Promise.all([loadPrompts(currentProjectId, pagination.page), loadPromptMetrics(currentProjectId)]);
    setBusy(false);
  }

  if (loading) return <p className="text-sm text-slate-600">Loading project…</p>;
  if (!hasProjects) return <p className="text-sm text-slate-600">No accessible projects.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Prompts · {currentProject?.name}</h1>
      <HistoricalImporter onImported={() => { if (currentProjectId) { void loadPromptMetrics(currentProjectId); } }} />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="space-y-2 border-b border-slate-200 p-3">
            <div className="space-y-2">
              <SharedReportingFilters
                search={searchTerm}
                from=""
                to=""
                model=""
                tag={tagFilter}
                country={countryFilter}
                language={languageFilter}
                showDateRange={false}
                onChange={(key, value) => {
                  if (key === 'q') setSearchTerm(value);
                  if (key === 'tag') setTagFilter(value);
                  if (key === 'country') setCountryFilter(value);
                  if (key === 'language') setLanguageFilter(value);
                }}
                extra={<div className="flex gap-2">
              <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={analysisModeFilter} onChange={(event) => setAnalysisModeFilter(event.target.value)}>
                <option value="">All modes</option><option value="chatgpt">ChatGPT</option><option value="gemini">Gemini</option><option value="ai_mode">Google AI Mode</option><option value="ai_overview">Google AI Overview</option>
              </select>
              <input className="rounded border border-slate-300 px-2 py-1 text-xs" onChange={(event) => setIntentFilter(event.target.value)} placeholder="Intent classification" value={intentFilter} />
              <select className="rounded border border-slate-300 px-2 py-1 text-xs" onChange={(event) => setActiveFilter(event.target.value as 'all' | 'active' | 'inactive')} value={activeFilter}><option value="all">All states</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
                </div>}
              />
              <div className="flex justify-end">
                <a className="rounded border border-slate-300 bg-white px-2 py-1 text-xs" href={`/api/projects/${currentProjectId}/exports?dataset=prompts_table`}>Export</a>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>
              <th className="w-[28%] px-2 py-1 font-medium">Prompt text</th><th className="px-2 py-1 font-medium">Tags</th><th className="px-2 py-1 font-medium">Country</th><th className="px-2 py-1 font-medium">Lang</th><th className="px-2 py-1 font-medium">Responses</th><th className="px-2 py-1 font-medium">Mention rate</th><th className="px-2 py-1 font-medium">Citation rate</th><th className="px-2 py-1 font-medium">Last run</th><th className="px-2 py-1 font-medium">Best/Worst mode</th><th className="px-2 py-1 font-medium">Actions</th><th className="px-2 py-1 font-medium">Live</th>
            </tr></thead><tbody className="divide-y divide-slate-100">
              {prompts.map((prompt) => { const metric = promptMetrics[prompt.id]; return <tr className="align-top" key={prompt.id}>
                <td className="px-2 py-1"><button className="line-clamp-2 text-left text-slate-900 hover:underline" onClick={() => setSelectedPromptId(prompt.id)} type="button">{prompt.promptText}</button></td>
                <td className="px-2 py-1 text-slate-700">{prompt.promptTags.map((item) => item.tag.name).join(', ') || '—'}</td>
                <td className="px-2 py-1 text-slate-700">{prompt.country}</td><td className="px-2 py-1 text-slate-700">{prompt.language}</td>
                <td className="px-2 py-1 text-slate-700">{metric?.validResponses ?? prompt.responsesCount}</td>
                <td className="px-2 py-1 text-slate-700">{formatRate(metric?.mentionRate?.value ?? prompt.mentionRate)}</td>
                <td className="px-2 py-1 text-slate-700">{formatRate(metric?.citationRate?.value ?? prompt.citationRate)}</td>
                <td className="px-2 py-1 text-slate-700">{formatDate(prompt.lastRunDate)}</td>
                <td className="px-2 py-1 text-slate-700">{metric?.bestAnalysisMode ?? '—'} / {metric?.worstAnalysisMode ?? '—'}</td>
                <td className="px-2 py-1"><div className="flex gap-1"><button className="rounded border border-slate-300 bg-white px-2 py-0.5" onClick={() => setSelectedPromptId(prompt.id)} type="button">Edit</button><button className="rounded border border-red-300 bg-white px-2 py-0.5 text-red-700" onClick={() => void deletePrompt(prompt.id)} type="button">Archive</button></div></td>
                <td className="px-2 py-1">
                  <button className="rounded border border-blue-300 bg-white px-2 py-0.5 text-blue-700" onClick={() => void runLiveAnalysis(prompt.id, prompt.country, prompt.language)} type="button">
                    Run live
                  </button>
                </td>
              </tr>; })}
            </tbody></table>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-3">
          <form className="space-y-3" onSubmit={submitPrompt}><h2 className="text-sm font-semibold text-slate-900">{selectedPrompt ? 'Edit prompt' : 'Create prompt'}</h2>
            <textarea className="min-h-24 w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, promptText: event.target.value }))} value={form.promptText} />
            <div className="grid grid-cols-2 gap-2"><input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" maxLength={2} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value.toUpperCase() }))} value={form.country} /><input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))} value={form.language} /></div>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Live analysis mode
              <select className="w-full rounded border border-slate-300 px-2 py-1 text-sm" onChange={(event) => setRunMode(event.target.value as 'chatgpt' | 'gemini' | 'ai_mode' | 'ai_overview')} value={runMode}>
                <option value="chatgpt">ChatGPT</option>
                <option value="gemini">Gemini</option>
                <option value="ai_mode">Google AI Mode</option>
                <option value="ai_overview">Google AI Overview</option>
              </select>
            </label>
            <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled={busy || !currentProjectId} type="submit">{selectedPrompt ? 'Save prompt' : 'Create prompt'}</button>
            {fieldErrors.promptText ? <p className="text-[11px] text-red-700">{fieldErrors.promptText}</p> : null}
            {runMessage ? <p className="text-[11px] text-slate-700">{runMessage}</p> : null}
          </form>
        </section>
      </div>
    </div>
  );
}
