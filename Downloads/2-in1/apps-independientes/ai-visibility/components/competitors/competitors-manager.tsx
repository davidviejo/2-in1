'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { SharedReportingFilters } from '@/components/reporting/shared-filters';

import { useProjectContext } from '@/components/projects/project-context';

type Competitor = {
  id: string;
  projectId: string;
  name: string;
  domain: string;
  aliases: string[];
  isActive: boolean;
  chartColor: string;
  updatedAt: string;
};

type CompetitorForm = {
  name: string;
  domain: string;
  aliases: string;
  isActive: boolean;
  chartColor: string;
};
type MentionShareRow = { brandKey: string; brandName: string; mentionCount: number; share: number | null };
type PromptInsightRow = { competitorId: string; competitorName: string; strongestPrompt: { title: string } | null; weakestPrompt: { title: string } | null };
type ComparisonPayload = { comparison?: { mentionShareByBrand?: MentionShareRow[]; competitorPromptInsights?: PromptInsightRow[] } };

const defaultForm: CompetitorForm = {
  name: '',
  domain: '',
  aliases: '',
  isActive: true,
  chartColor: '#1d4ed8'
};

function toForm(competitor: Competitor | null): CompetitorForm {
  if (!competitor) {
    return defaultForm;
  }

  return {
    name: competitor.name,
    domain: competitor.domain,
    aliases: competitor.aliases.join(', '),
    isActive: competitor.isActive,
    chartColor: competitor.chartColor
  };
}

export function CompetitorsManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<CompetitorForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonPayload | null>(null);
  const [from, setFrom] = useState(new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const selectedCompetitor = useMemo(
    () => competitors.find((competitor) => competitor.id === selectedCompetitorId) ?? null,
    [competitors, selectedCompetitorId]
  );

  useEffect(() => {
    setForm(toForm(selectedCompetitor));
    setFieldErrors({});
  }, [selectedCompetitor]);

  const loadCompetitors = useCallback(async (projectId: string, query: string) => {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set('q', query.trim());
    }

    const response = await fetch(`/api/projects/${projectId}/competitors?${params.toString()}`, { cache: 'no-store' });

    if (!response.ok) {
      setCompetitors([]);
      setStatusMessage('Project data is unavailable. Select another project.');
      return;
    }

    const data = (await response.json()) as { competitors: Competitor[] };

    setCompetitors(data.competitors ?? []);

    if (selectedCompetitorId && !(data.competitors ?? []).some((item) => item.id === selectedCompetitorId)) {
      setSelectedCompetitorId(null);
    }
  }, [selectedCompetitorId]);

  useEffect(() => {
    if (!currentProjectId) {
      setCompetitors([]);
      return;
    }

    void loadCompetitors(currentProjectId, searchTerm);
  }, [currentProjectId, loadCompetitors, searchTerm]);

  useEffect(() => {
    if (!currentProjectId) return;
    void loadComparison(currentProjectId);
  }, [currentProjectId, from, to]);

  async function loadComparison(projectId: string) {
    const response = await fetch(`/api/projects/${projectId}/competitors/comparison?from=${from}&to=${to}`, { cache: 'no-store' });
    if (!response.ok) return setComparison(null);
    setComparison(await response.json());
  }

  async function submitCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentProjectId) {
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setStatusMessage(null);

    const method = selectedCompetitor ? 'PATCH' : 'POST';
    const url = selectedCompetitor
      ? `/api/projects/${currentProjectId}/competitors/${selectedCompetitor.id}`
      : `/api/projects/${currentProjectId}/competitors`;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = (await response.json()) as {
      fieldErrors?: Record<string, string>;
      error?: string;
    };

    if (!response.ok) {
      setFieldErrors(data.fieldErrors ?? {});
      setStatusMessage(data.error === 'validation_failed' ? 'Please fix validation errors.' : 'Request failed.');
      setBusy(false);
      return;
    }

    setForm(defaultForm);
    setSelectedCompetitorId(null);
    await loadCompetitors(currentProjectId, searchTerm);
    setStatusMessage(selectedCompetitor ? 'Competitor updated.' : 'Competitor created.');
    setBusy(false);
  }

  async function deleteCompetitor(competitorId: string) {
    if (!currentProjectId) {
      return;
    }

    setBusy(true);

    await fetch(`/api/projects/${currentProjectId}/competitors/${competitorId}`, { method: 'DELETE' });

    if (selectedCompetitorId === competitorId) {
      setSelectedCompetitorId(null);
      setForm(defaultForm);
    }

    await loadCompetitors(currentProjectId, searchTerm);
    setStatusMessage('Competitor deleted.');
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
      <header className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Competitors · {currentProject?.name}</h1>
          <p className="text-xs text-slate-600">Manage competitors by project with aliases for mention detection.</p>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <input
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name or domain"
              value={searchTerm}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Domain</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Color</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {competitors.map((competitor) => (
                  <tr key={competitor.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{competitor.name}</p>
                      <p className="text-xs text-slate-500">Aliases: {competitor.aliases.join(', ') || '—'}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{competitor.domain}</td>
                    <td className="px-3 py-2 text-slate-700">{competitor.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: competitor.chartColor }} />
                        {competitor.chartColor}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 text-xs">
                        <button
                          className="rounded border border-slate-300 bg-white px-2 py-1"
                          onClick={() => setSelectedCompetitorId(competitor.id)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded border border-red-300 bg-white px-2 py-1 text-red-700"
                          onClick={() => void deleteCompetitor(competitor.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {competitors.length === 0 ? <p className="px-3 py-4 text-xs text-slate-500">No competitors found for this project.</p> : null}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white">
          <form className="space-y-3 p-3" onSubmit={submitCompetitor}>
            <h2 className="text-sm font-semibold text-slate-900">{selectedCompetitor ? 'Edit competitor' : 'Add competitor'}</h2>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Name
              <input
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                value={form.name}
              />
              {fieldErrors.name ? <p className="text-[11px] text-red-700">{fieldErrors.name}</p> : null}
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Domain
              <input
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                value={form.domain}
              />
              {fieldErrors.domain ? <p className="text-[11px] text-red-700">{fieldErrors.domain}</p> : null}
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Aliases (comma separated)
              <textarea
                className="min-h-20 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, aliases: event.target.value }))}
                placeholder="acme inc, acme software"
                value={form.aliases}
              />
              {fieldErrors.aliases ? <p className="text-[11px] text-red-700">{fieldErrors.aliases}</p> : null}
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" />
              Active competitor
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Chart color
              <input
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, chartColor: event.target.value }))}
                value={form.chartColor}
              />
              {fieldErrors.chartColor ? <p className="text-[11px] text-red-700">{fieldErrors.chartColor}</p> : null}
            </label>

            <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled={busy || !currentProjectId} type="submit">
              {selectedCompetitor ? 'Save competitor' : 'Create competitor'}
            </button>
          </form>
        </section>
      </div>

      {statusMessage ? <p className="text-xs font-medium text-slate-700">{statusMessage}</p> : null}
      <section className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-semibold text-slate-900">Comparison analytics</h2>
        <SharedReportingFilters search="" from={from} to={to} model="" tag="" country="" language="" onChange={(key, value) => {
          if (key === 'from') setFrom(value);
          if (key === 'to') setTo(value);
        }} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold">Mention share</h3>
            <table className="min-w-full text-xs"><thead><tr><th className="text-left">Brand</th><th className="text-left">Mentions</th><th className="text-left">Share</th></tr></thead>
              <tbody>{comparison?.comparison?.mentionShareByBrand?.map((row) => <tr key={row.brandKey}><td>{row.brandName}</td><td>{row.mentionCount}</td><td>{row.share === null ? '—' : `${(row.share * 100).toFixed(1)}%`}</td></tr>)}</tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold">Top prompts won/lost</h3>
            <table className="min-w-full text-xs"><thead><tr><th className="text-left">Competitor</th><th className="text-left">Won</th><th className="text-left">Lost</th></tr></thead>
              <tbody>{comparison?.comparison?.competitorPromptInsights?.map((row) => <tr key={row.competitorId}><td>{row.competitorName}</td><td>{row.strongestPrompt?.title ?? '—'}</td><td>{row.weakestPrompt?.title ?? '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
