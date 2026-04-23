'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Project = {
  id: string;
  name: string;
};

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<CompetitorForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedCompetitor = useMemo(
    () => competitors.find((competitor) => competitor.id === selectedCompetitorId) ?? null,
    [competitors, selectedCompetitorId]
  );

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    setForm(toForm(selectedCompetitor));
    setFieldErrors({});
  }, [selectedCompetitor]);

  async function loadProjects() {
    setLoading(true);
    const response = await fetch('/api/projects', { cache: 'no-store' });
    const data = (await response.json()) as { projects: Project[] };
    const nextProjects = data.projects ?? [];

    setProjects(nextProjects);

    if (nextProjects.length > 0) {
      setSelectedProjectId((current) => current || nextProjects[0].id);
    }

    setLoading(false);
  }

  const loadCompetitors = useCallback(async (projectId: string, query: string) => {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set('q', query.trim());
    }

    const response = await fetch(`/api/projects/${projectId}/competitors?${params.toString()}`, { cache: 'no-store' });
    const data = (await response.json()) as { competitors: Competitor[] };

    setCompetitors(data.competitors ?? []);

    if (selectedCompetitorId && !(data.competitors ?? []).some((item) => item.id === selectedCompetitorId)) {
      setSelectedCompetitorId(null);
    }
  }, [selectedCompetitorId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    void loadCompetitors(selectedProjectId, searchTerm);
  }, [loadCompetitors, searchTerm, selectedProjectId]);

  async function submitCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setStatusMessage(null);

    const method = selectedCompetitor ? 'PATCH' : 'POST';
    const url = selectedCompetitor
      ? `/api/projects/${selectedProjectId}/competitors/${selectedCompetitor.id}`
      : `/api/projects/${selectedProjectId}/competitors`;

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
    await loadCompetitors(selectedProjectId, searchTerm);
    setStatusMessage(selectedCompetitor ? 'Competitor updated.' : 'Competitor created.');
    setBusy(false);
  }

  async function deleteCompetitor(competitorId: string) {
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);

    await fetch(`/api/projects/${selectedProjectId}/competitors/${competitorId}`, { method: 'DELETE' });

    if (selectedCompetitorId === competitorId) {
      setSelectedCompetitorId(null);
      setForm(defaultForm);
    }

    await loadCompetitors(selectedProjectId, searchTerm);
    setStatusMessage('Competitor deleted.');
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Competitors</h1>
          <p className="text-xs text-slate-600">Manage competitors by project with aliases for mention detection.</p>
        </div>
      </header>

      {loading ? <p className="text-sm text-slate-600">Loading projects…</p> : null}

      <section className="rounded-md border border-slate-200 bg-white p-3">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Project
          <select
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            onChange={(event) => {
              setSelectedProjectId(event.target.value);
              setSelectedCompetitorId(null);
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
            {competitors.length === 0 ? <p className="px-3 py-4 text-xs text-slate-500">No competitors found.</p> : null}
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

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Chart color
              <input
                className="h-9 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, chartColor: event.target.value }))}
                type="color"
                value={form.chartColor}
              />
              {fieldErrors.chartColor ? <p className="text-[11px] text-red-700">{fieldErrors.chartColor}</p> : null}
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
              Active
            </label>

            <div className="flex gap-2">
              <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled={busy || !selectedProjectId} type="submit">
                {selectedCompetitor ? 'Save changes' : 'Create competitor'}
              </button>
              {selectedCompetitor ? (
                <button
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                  onClick={() => {
                    setSelectedCompetitorId(null);
                    setForm(defaultForm);
                  }}
                  type="button"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>

      {statusMessage ? <p className="text-xs font-medium text-slate-700">{statusMessage}</p> : null}
    </div>
  );
}
