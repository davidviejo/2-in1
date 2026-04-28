'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useProjectContext } from '@/components/projects/project-context';
import { SharedReportingFilters } from '@/components/reporting/shared-filters';

type ExplorerRow = {
  key: string;
  count: number;
  share: number;
  isClientDomain: boolean;
  isCompetitorDomain: boolean;
  sourceType: string;
};

type ExplorerPayload = { groupBy: 'domain' | 'host' | 'page'; sortBy: 'count' | 'share'; totalCitations: number; groups: ExplorerRow[] };

function defaultFrom() { const d = new Date(Date.now() - 27 * 24 * 60 * 60 * 1000); return d.toISOString().slice(0, 10); }
function defaultTo() { return new Date().toISOString().slice(0, 10); }

export function CitationsManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [payload, setPayload] = useState<ExplorerPayload | null>(null);

  const filters = useMemo(() => ({
    q: params.get('q') ?? '',
    from: params.get('from') ?? defaultFrom(),
    to: params.get('to') ?? defaultTo(),
    model: params.get('model') ?? '',
    tag: params.get('tag') ?? '',
    country: params.get('country') ?? '',
    language: params.get('language') ?? '',
    groupBy: (params.get('groupBy') as 'domain' | 'host' | 'page') ?? 'domain',
    sort: (params.get('sort') as 'count' | 'share') ?? 'count'
  }), [params]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key); else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  useEffect(() => { if (currentProjectId) void load(currentProjectId); }, [currentProjectId, params]);

  async function load(projectId: string) {
    const q = new URLSearchParams(params.toString());
    if (!q.get('groupBy')) q.set('groupBy', 'domain');
    if (!q.get('sort')) q.set('sort', 'count');
    const response = await fetch(`/api/projects/${projectId}/citations?${q.toString()}`, { cache: 'no-store' });
    if (!response.ok) return setPayload(null);
    setPayload(await response.json() as ExplorerPayload);
  }

  if (loading) return <p className="text-sm text-slate-600">Loading project…</p>;
  if (!hasProjects) return <p className="text-sm text-slate-600">No accessible projects.</p>;

  const cols = filters.groupBy === 'page' ? 'Page URL' : filters.groupBy === 'host' ? 'Host' : 'Domain';

  return <div className="space-y-4">
    <h1 className="text-xl font-semibold text-slate-900">Citations · {currentProject?.name}</h1>
    <div className="flex gap-2 text-xs">
      {['domain', 'host', 'page'].map((tab) => <button key={tab} className={`rounded border px-2 py-1 ${filters.groupBy === tab ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`} onClick={() => setFilter('groupBy', tab)} type="button">By {tab[0].toUpperCase()}{tab.slice(1)}</button>)}
    </div>
    <SharedReportingFilters search={filters.q} from={filters.from} to={filters.to} model={filters.model} tag={filters.tag} country={filters.country} language={filters.language} onChange={setFilter}
      extra={<select className="rounded border border-slate-300 px-2 py-1" value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}><option value="count">Sort by count</option><option value="share">Sort by share</option></select>} />
    <div className="flex justify-end"><a className="rounded border border-slate-300 bg-white px-2 py-1 text-xs" href={`/api/projects/${currentProjectId}/exports?dataset=citations_table`}>Export</a></div>
    <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-slate-200 bg-slate-50"><tr><th className="px-2 py-1">{cols}</th><th className="px-2 py-1">Count</th><th className="px-2 py-1">Share</th><th className="px-2 py-1">Client</th><th className="px-2 py-1">Competitor</th><th className="px-2 py-1">Source type</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{payload?.groups.map((row) => <tr key={row.key}><td className="px-2 py-1 max-w-[520px] truncate">{row.key}</td><td className="px-2 py-1">{row.count}</td><td className="px-2 py-1">{(row.share * 100).toFixed(1)}%</td><td className="px-2 py-1">{row.isClientDomain ? 'Yes' : 'No'}</td><td className="px-2 py-1">{row.isCompetitorDomain ? 'Yes' : 'No'}</td><td className="px-2 py-1">{row.sourceType}</td></tr>)}</tbody>
      </table>
      {!payload || payload.groups.length === 0 ? <p className="px-3 py-3 text-xs text-slate-500">No citations for current filters.</p> : null}
    </section>
  </div>;
}
