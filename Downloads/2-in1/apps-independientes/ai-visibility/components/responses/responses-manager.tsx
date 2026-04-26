'use client';

import { useEffect, useState } from 'react';

import { useProjectContext } from '@/components/projects/project-context';

type ResponseRow = {
  id: string;
  promptText: string;
  model?: string;
  responseStatus: string;
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

export function ResponsesManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);

  useEffect(() => {
    if (!currentProjectId) {
      setRows([]);
      setPagination(DEFAULT_PAGINATION);
      return;
    }

    void loadRows(currentProjectId, 1);
  }, [currentProjectId]);

  async function loadRows(projectId: string, page: number) {
    const response = await fetch(`/api/projects/${projectId}/responses?page=${page}&pageSize=${pagination.pageSize}`, { cache: 'no-store' });

    if (!response.ok) {
      setRows([]);
      return;
    }

    const data = (await response.json()) as { responses: ResponseRow[]; pagination: Pagination };
    setRows(data.responses ?? []);
    setPagination(data.pagination ?? DEFAULT_PAGINATION);
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
      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-1 font-medium">Prompt</th>
              <th className="px-2 py-1 font-medium">Status</th>
              <th className="px-2 py-1 font-medium">Snippet</th>
              <th className="px-2 py-1 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-2 py-1 text-slate-700">{row.promptText}</td>
                <td className="px-2 py-1 text-slate-700">{row.responseStatus}</td>
                <td className="px-2 py-1 text-slate-700">{row.rawSnippet}</td>
                <td className="px-2 py-1 text-slate-700">{new Date(row.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-3 py-3 text-xs text-slate-500">No responses available.</p> : null}
      </section>
      <div className="flex gap-2 text-xs">
        <button className="rounded border border-slate-300 px-2 py-1" disabled={pagination.page <= 1} onClick={() => currentProjectId && void loadRows(currentProjectId, pagination.page - 1)} type="button">
          Prev
        </button>
        <button className="rounded border border-slate-300 px-2 py-1" disabled={pagination.page >= pagination.totalPages} onClick={() => currentProjectId && void loadRows(currentProjectId, pagination.page + 1)} type="button">
          Next
        </button>
      </div>
    </div>
  );
}
