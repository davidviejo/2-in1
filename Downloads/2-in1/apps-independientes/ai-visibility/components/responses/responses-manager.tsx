'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useProjectContext } from '@/components/projects/project-context';

type ResponseRow = {
  id: string;
  promptText: string;
  model?: string;
  responseStatus: string;
  runStatus: string;
  rawSnippet: string;
  createdAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1
};

type ResponseAudit = {
  id: string;
  runId: string;
  projectId: string;
  promptId: string;
  promptTitle: string;
  promptText: string;
  model: string;
  runStatus: string;
  parserVersion: string | null;
  runTimestamps: {
    executedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  responseStatus: string;
  rawText: string;
  cleanedText: string | null;
  mentionDetected: boolean;
  mentionType: string | null;
  createdAt: string;
  updatedAt: string;
  clientMention: {
    id: string;
    mentionType: string;
    mentionText: string;
    mentionCount: number;
    competitor: { id: string; name: string; domain: string } | null;
    brandAlias: { id: string; alias: string } | null;
  } | null;
  competitorMentions: Array<{
    id: string;
    mentionType: string;
    mentionText: string;
    mentionCount: number;
    competitor: { id: string; name: string; domain: string } | null;
    brandAlias: { id: string; alias: string } | null;
  }>;
  citations: Array<{
    id: string;
    sourceUrl: string;
    sourceDomain: string;
    title: string | null;
    snippet: string | null;
    position: number | null;
    publishedAt: string | null;
    confidence: string | null;
  }>;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString();
}

export function ResponsesManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [audit, setAudit] = useState<ResponseAudit | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProjectId) {
      setRows([]);
      setPagination(DEFAULT_PAGINATION);
      setSelectedResponseId(null);
      setAudit(null);
      setAuditError(null);
      return;
    }

    void loadRows(currentProjectId, 1);
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId || !selectedResponseId) {
      setAudit(null);
      setAuditError(null);
      return;
    }

    void loadAudit(currentProjectId, selectedResponseId);
  }, [currentProjectId, selectedResponseId]);

  async function loadRows(projectId: string, page: number) {
    const response = await fetch(`/api/projects/${projectId}/responses?page=${page}&pageSize=${pagination.pageSize}`, { cache: 'no-store' });

    if (!response.ok) {
      setRows([]);
      setSelectedResponseId(null);
      setAudit(null);
      return;
    }

    const data = (await response.json()) as { responses: ResponseRow[]; pagination: Pagination };
    const nextRows = data.responses ?? [];
    setRows(nextRows);
    setPagination(data.pagination ?? DEFAULT_PAGINATION);

    if (nextRows.length === 0) {
      setSelectedResponseId(null);
      setAudit(null);
      return;
    }

    setSelectedResponseId((current) => (current && nextRows.some((row) => row.id === current) ? current : nextRows[0].id));
  }

  async function loadAudit(projectId: string, responseId: string) {
    setAuditError(null);
    const response = await fetch(`/api/projects/${projectId}/responses/${responseId}`, { cache: 'no-store' });

    if (!response.ok) {
      setAudit(null);
      setAuditError('Unable to load response audit details.');
      return;
    }

    const data = (await response.json()) as { response: ResponseAudit };
    setAudit(data.response ?? null);
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading project…</p>;
  }

  if (!hasProjects) {
    return <p className="text-sm text-slate-600">No accessible projects.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Responses · {currentProject?.name}</h1>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
        <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-1 font-medium">Prompt</th>
                <th className="px-2 py-1 font-medium">Run</th>
                <th className="px-2 py-1 font-medium">Response</th>
                <th className="px-2 py-1 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr className={row.id === selectedResponseId ? 'bg-slate-50' : undefined} key={row.id}>
                  <td className="px-2 py-1 text-slate-700">
                    <button className="text-left hover:underline" onClick={() => setSelectedResponseId(row.id)} type="button">
                      {row.promptText}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-slate-700">{row.runStatus}</td>
                  <td className="px-2 py-1 text-slate-700">{row.responseStatus}</td>
                  <td className="px-2 py-1 text-slate-700">{formatDateTime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="px-3 py-3 text-xs text-slate-500">No responses available.</p> : null}
          <div className="flex gap-2 p-3 text-xs">
            <button className="rounded border border-slate-300 px-2 py-1" disabled={pagination.page <= 1} onClick={() => currentProjectId && void loadRows(currentProjectId, pagination.page - 1)} type="button">
              Prev
            </button>
            <button className="rounded border border-slate-300 px-2 py-1" disabled={pagination.page >= pagination.totalPages} onClick={() => currentProjectId && void loadRows(currentProjectId, pagination.page + 1)} type="button">
              Next
            </button>
          </div>
        </section>
        <section className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
          {!audit && !auditError ? <p>Select a response to inspect audit details.</p> : null}
          {auditError ? <p className="text-rose-700">{auditError}</p> : null}
          {audit ? (
            <>
              <div className="flex flex-wrap gap-3">
                <Link className="text-blue-700 underline" href={`/settings`}>
                  Project: {currentProject?.name ?? audit.projectId}
                </Link>
                <Link className="text-blue-700 underline" href={`/prompts`}>
                  Prompt: {audit.promptTitle || audit.promptId}
                </Link>
                <a className="text-blue-700 underline" href={`/api/projects/${audit.projectId}/runs/${audit.runId}`}>
                  Run API: {audit.runId}
                </a>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <p><span className="font-semibold">Model:</span> {audit.model}</p>
                <p><span className="font-semibold">Parser version:</span> {audit.parserVersion ?? '—'}</p>
                <p><span className="font-semibold">Run status:</span> {audit.runStatus}</p>
                <p><span className="font-semibold">Response status:</span> {audit.responseStatus}</p>
                <p><span className="font-semibold">Executed:</span> {formatDateTime(audit.runTimestamps.executedAt)}</p>
                <p><span className="font-semibold">Started:</span> {formatDateTime(audit.runTimestamps.startedAt)}</p>
                <p><span className="font-semibold">Completed:</span> {formatDateTime(audit.runTimestamps.completedAt)}</p>
                <p><span className="font-semibold">Response created:</span> {formatDateTime(audit.createdAt)}</p>
              </div>

              <div>
                <p className="mb-1 font-semibold">Prompt</p>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2">{audit.promptText}</pre>
              </div>

              <div>
                <p className="mb-1 font-semibold">Raw response text</p>
                <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2">{audit.rawText}</pre>
              </div>

              <div>
                <p className="mb-1 font-semibold">Cleaned text</p>
                <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2">{audit.cleanedText ?? '—'}</pre>
              </div>

              <div>
                <p className="font-semibold">Detected client mention</p>
                {audit.clientMention ? (
                  <p>{audit.clientMention.mentionText} · count: {audit.clientMention.mentionCount} · alias: {audit.clientMention.brandAlias?.alias ?? 'n/a'}</p>
                ) : (
                  <p>None detected.</p>
                )}
              </div>

              <div>
                <p className="font-semibold">Competitor mentions</p>
                {audit.competitorMentions.length === 0 ? (
                  <p>No competitor mentions detected.</p>
                ) : (
                  <ul className="list-disc pl-4">
                    {audit.competitorMentions.map((mention) => (
                      <li key={mention.id}>
                        {mention.mentionText} · count: {mention.mentionCount} · competitor: {mention.competitor?.name ?? 'unknown'} ({mention.competitor?.domain ?? 'n/a'})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="font-semibold">Extracted citations</p>
                {audit.citations.length === 0 ? (
                  <p>No citations extracted.</p>
                ) : (
                  <ul className="space-y-2">
                    {audit.citations.map((citation) => (
                      <li className="rounded border border-slate-200 p-2" key={citation.id}>
                        <p>
                          #{citation.position ?? '—'} · {citation.sourceDomain} ·{' '}
                          <a className="text-blue-700 underline" href={citation.sourceUrl} rel="noreferrer" target="_blank">
                            {citation.title ?? citation.sourceUrl}
                          </a>
                        </p>
                        <p className="text-slate-600">{citation.snippet ?? 'No snippet.'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
