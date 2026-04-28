'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useProjectContext } from '@/components/projects/project-context';
import { SharedReportingFilters } from '@/components/reporting/shared-filters';

type ResponseRow = {
  id: string;
  promptText: string;
  model?: string;
  responseStatus: string;
  runStatus: string;
  rawSnippet: string;
  mentionDetected: boolean;
  sentiment: string | null;
  citationCount: number;
  createdAt: string;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
const DEFAULT_PAGINATION: Pagination = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

type ResponseAudit = {
  id: string; runId: string; projectId: string; promptId: string; promptTitle: string; promptText: string; model: string;
  runStatus: string; parserVersion: string | null; runTimestamps: { executedAt: string; startedAt: string | null; completedAt: string | null; createdAt: string; updatedAt: string };
  responseStatus: string; rawText: string; cleanedText: string | null; mentionDetected: boolean; mentionType: string | null; createdAt: string;
  clientMention: { mentionText: string; mentionCount: number; brandAlias: { alias: string } | null } | null;
  competitorMentions: Array<{ id: string; mentionText: string; mentionCount: number; competitor: { name: string; domain: string } | null }>;
  citations: Array<{ id: string; sourceUrl: string; sourceDomain: string; title: string | null; snippet: string | null; position: number | null }>;
};

function formatDateTime(value: string | null): string { return value ? new Date(value).toLocaleString() : '—'; }
function defaultFrom() { const d = new Date(Date.now() - 27 * 24 * 60 * 60 * 1000); return d.toISOString().slice(0, 10); }
function defaultTo() { return new Date().toISOString().slice(0, 10); }

export function ResponsesManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [audit, setAudit] = useState<ResponseAudit | null>(null);

  const filters = useMemo(() => ({
    q: params.get('q') ?? '',
    from: params.get('from') ?? defaultFrom(),
    to: params.get('to') ?? defaultTo(),
    model: params.get('model') ?? '',
    tag: params.get('tag') ?? '',
    country: params.get('country') ?? '',
    language: params.get('language') ?? '',
    mentionStatus: params.get('mentionStatus') ?? ''
  }), [params]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }

  useEffect(() => { if (currentProjectId) void loadRows(currentProjectId, Number(params.get('page') ?? 1)); }, [currentProjectId, params]);
  useEffect(() => { if (currentProjectId && selectedResponseId) void loadAudit(currentProjectId, selectedResponseId); }, [currentProjectId, selectedResponseId]);

  async function loadRows(projectId: string, page: number) {
    const q = new URLSearchParams(params.toString());
    q.set('page', String(page)); q.set('pageSize', String(DEFAULT_PAGINATION.pageSize));
    const response = await fetch(`/api/projects/${projectId}/responses?${q.toString()}`, { cache: 'no-store' });
    if (!response.ok) { setRows([]); setAudit(null); return; }
    const data = await response.json() as { responses: ResponseRow[]; pagination: Pagination };
    setRows(data.responses ?? []); setPagination(data.pagination ?? DEFAULT_PAGINATION);
  }

  async function loadAudit(projectId: string, responseId: string) {
    const response = await fetch(`/api/projects/${projectId}/responses/${responseId}`, { cache: 'no-store' });
    if (!response.ok) return setAudit(null);
    const data = await response.json() as { response: ResponseAudit };
    setAudit(data.response ?? null);
  }

  if (loading) return <p className="text-sm text-slate-600">Loading project…</p>;
  if (!hasProjects) return <p className="text-sm text-slate-600">No accessible projects.</p>;

  return <div className="space-y-4">
    <h1 className="text-xl font-semibold text-slate-900">Responses · {currentProject?.name}</h1>
    <SharedReportingFilters
      search={filters.q} from={filters.from} to={filters.to} model={filters.model} tag={filters.tag} country={filters.country} language={filters.language}
      onChange={setFilter}
      extra={<select className="rounded border border-slate-300 px-2 py-1" value={filters.mentionStatus} onChange={(event) => setFilter('mentionStatus', event.target.value)}>
        <option value="">All mentions</option><option value="mentioned">Mentioned</option><option value="not_mentioned">Not mentioned</option>
      </select>}
    />
    <div className="flex justify-end">
      <a className="rounded border border-slate-300 bg-white px-2 py-1 text-xs" href={`/api/projects/${currentProjectId}/exports?dataset=responses_table`}>Export</a>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>
            <th className="px-2 py-1 font-medium">Prompt</th><th className="px-2 py-1 font-medium">Model</th><th className="px-2 py-1 font-medium">Snippet</th><th className="px-2 py-1 font-medium">Status</th><th className="px-2 py-1 font-medium">Mention</th><th className="px-2 py-1 font-medium">Sentiment</th><th className="px-2 py-1 font-medium">Citations</th><th className="px-2 py-1 font-medium">Date</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className={row.id === selectedResponseId ? 'bg-slate-50' : ''}>
            <td className="px-2 py-1"><button className="text-left hover:underline" onClick={() => setSelectedResponseId(row.id)} type="button">{row.promptText}</button></td>
            <td className="px-2 py-1">{row.model ?? '—'}</td>
            <td className="max-w-[360px] px-2 py-1 text-slate-700"><p className="line-clamp-3 whitespace-pre-wrap">{row.rawSnippet}</p></td>
            <td className="px-2 py-1">{row.responseStatus}</td><td className="px-2 py-1">{row.mentionDetected ? 'Yes' : 'No'}</td><td className="px-2 py-1">{row.sentiment ?? '—'}</td><td className="px-2 py-1">{row.citationCount ?? 0}</td><td className="px-2 py-1">{formatDateTime(row.createdAt)}</td>
          </tr>)}</tbody>
        </table>
      </section>
      <section className="space-y-2 rounded-md border border-slate-200 bg-white p-3 text-xs">
        {!audit ? <p>Select a response to inspect why it was counted.</p> : <>
          <p><b>Model:</b> {audit.model} · <b>Status:</b> {audit.responseStatus} · <b>Mention:</b> {audit.mentionDetected ? audit.mentionType ?? 'yes' : 'no'}</p>
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2">{audit.rawText}</pre>
          <p className="font-semibold">Citations ({audit.citations.length})</p>
          <ul className="space-y-1">{audit.citations.map((citation) => <li key={citation.id} className="rounded border border-slate-200 p-1">{citation.sourceDomain} · <a className="underline" href={citation.sourceUrl} target="_blank" rel="noreferrer">{citation.title ?? citation.sourceUrl}</a></li>)}</ul>
        </>}
      </section>
    </div>
    <div className="flex gap-2 text-xs">
      <button className="rounded border border-slate-300 px-2 py-1" disabled={pagination.page <= 1} onClick={() => setFilter('page', String(pagination.page - 1))} type="button">Prev</button>
      <button className="rounded border border-slate-300 px-2 py-1" disabled={pagination.page >= pagination.totalPages} onClick={() => setFilter('page', String(pagination.page + 1))} type="button">Next</button>
    </div>
  </div>;
}
