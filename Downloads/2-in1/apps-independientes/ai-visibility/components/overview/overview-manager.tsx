'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  DataTableShell,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  LoadingState,
  PageHeader,
  SectionCard
} from '@/components/dashboard-primitives';
import { useProjectContext } from '@/components/projects/project-context';

type PromptKpi = {
  promptId: string;
  promptTitle: string;
  validResponseCount: number;
  mentionRate: number | null;
};

type DomainShare = {
  domain: string;
  citations: number;
  share: number;
};

type DeltaValue = {
  current: number | null;
  previous: number | null;
  absolute: number | null;
  relative: number | null;
};

type SummaryPayload = {
  projectId: string;
  range: { from: string; to: string };
  summary: {
    validResponses: number;
    mentionRate: { value: number | null };
    citationRate: { value: number | null };
    shareOfVoice: { value: number | null };
    sourceShare: { totalCitations: number; byDomain: DomainShare[] };
    topCitedDomains: DomainShare[];
    strongestPrompts: PromptKpi[];
    weakestPrompts: PromptKpi[];
  };
  deltaVsPrevious: {
    validResponses: DeltaValue;
    mentionRate: DeltaValue;
    citationRate: DeltaValue;
    shareOfVoice: DeltaValue;
  };
};

type TimeseriesPoint = {
  periodStart: string;
  periodEnd: string;
  values: {
    brand_mentions: number;
    citation_rate: number;
    valid_responses: number;
  };
};

type TimeseriesPayload = {
  projectId: string;
  range: { from: string; to: string };
  granularity: 'day' | 'week';
  series: TimeseriesPoint[];
};

function formatPercent(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatCount(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return value.toLocaleString();
}

function formatDelta(delta: DeltaValue, valueType: 'count' | 'ratio'): string {
  if (delta.absolute === null) {
    return 'Δ —';
  }

  if (valueType === 'ratio') {
    const points = (delta.absolute * 100).toFixed(1);
    return `Δ ${points}pp`;
  }

  const sign = delta.absolute > 0 ? '+' : '';
  return `Δ ${sign}${delta.absolute.toLocaleString()}`;
}

function toDayInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createDefaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 27 * 24 * 60 * 60 * 1000);

  return {
    from: toDayInputValue(from),
    to: toDayInputValue(to)
  };
}

function formatPeriodLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildApiPath(projectId: string, path: string, range: { from: string; to: string }): string {
  return `/api/projects/${projectId}/${path}?from=${range.from}&to=${range.to}`;
}

export function OverviewManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const [range, setRange] = useState(createDefaultRange);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProjectId) {
      setSummary(null);
      setTimeseries(null);
      setError(null);
      return;
    }

    void loadOverview(currentProjectId, range.from, range.to);
  }, [currentProjectId, range.from, range.to]);

  async function loadOverview(projectId: string, from: string, to: string) {
    setIsLoading(true);
    setError(null);

    const [summaryResponse, timeseriesResponse] = await Promise.all([
      fetch(`/api/projects/${projectId}/summary?from=${from}&to=${to}`, { cache: 'no-store' }),
      fetch(`/api/projects/${projectId}/timeseries?from=${from}&to=${to}&granularity=day`, { cache: 'no-store' })
    ]);

    if (!summaryResponse.ok || !timeseriesResponse.ok) {
      const fallbackError = summaryResponse.status === 400 || timeseriesResponse.status === 400
        ? 'Invalid date range.'
        : 'Unable to load overview reporting.';
      setSummary(null);
      setTimeseries(null);
      setError(fallbackError);
      setIsLoading(false);
      return;
    }

    const summaryData = (await summaryResponse.json()) as SummaryPayload;
    const timeseriesData = (await timeseriesResponse.json()) as TimeseriesPayload;

    setSummary(summaryData);
    setTimeseries(timeseriesData);
    setIsLoading(false);
  }

  const trendRows = useMemo(() => timeseries?.series ?? [], [timeseries]);
  const domainRows = useMemo(() => summary?.summary.topCitedDomains ?? [], [summary]);
  const strongestPrompts = useMemo(() => summary?.summary.strongestPrompts ?? [], [summary]);
  const weakestPrompts = useMemo(() => summary?.summary.weakestPrompts ?? [], [summary]);

  const maxMentions = useMemo(() => {
    const values = trendRows.map((row) => row.values.brand_mentions);
    return values.length > 0 ? Math.max(...values, 1) : 1;
  }, [trendRows]);

  const topDomain = summary?.summary.sourceShare.byDomain[0] ?? null;

  if (loading) {
    return <LoadingState label="Loading project…" />;
  }

  if (!hasProjects) {
    return <EmptyState title="No projects" description="You need at least one project to view reporting summaries." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Overview · ${currentProject?.name ?? 'Project'}`}
        description="Analyst scan view of KPI health, trend movement, source quality, and prompt performance."
      />

      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          From
          <input
            className="rounded border border-slate-300 bg-white px-2 py-1"
            onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
            type="date"
            value={range.from}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          To
          <input
            className="rounded border border-slate-300 bg-white px-2 py-1"
            onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
            type="date"
            value={range.to}
          />
        </label>
        {currentProjectId ? (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">Quick links:</span>
            <Link className="rounded border border-slate-300 px-2 py-1 hover:bg-white" href="/responses">
              Responses
            </Link>
            <Link className="rounded border border-slate-300 px-2 py-1 hover:bg-white" href="/citations">
              Citations
            </Link>
            <a
              className="rounded border border-slate-300 px-2 py-1 hover:bg-white"
              href={buildApiPath(currentProjectId, 'summary', range)}
              rel="noreferrer"
              target="_blank"
            >
              Summary API
            </a>
          </div>
        ) : null}
      </FilterBar>

      {isLoading ? <LoadingState label="Loading overview reporting…" /> : null}
      {error ? <ErrorState title="Overview unavailable" description={error} /> : null}

      {summary && timeseries && !isLoading ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="Valid responses"
              trend={formatDelta(summary.deltaVsPrevious.validResponses, 'count')}
              value={formatCount(summary.summary.validResponses)}
            />
            <KpiCard
              label="Mention rate"
              trend={formatDelta(summary.deltaVsPrevious.mentionRate, 'ratio')}
              value={formatPercent(summary.summary.mentionRate.value)}
            />
            <KpiCard
              label="Citation rate"
              trend={formatDelta(summary.deltaVsPrevious.citationRate, 'ratio')}
              value={formatPercent(summary.summary.citationRate.value)}
            />
            <KpiCard
              label="Share of voice"
              trend={formatDelta(summary.deltaVsPrevious.shareOfVoice, 'ratio')}
              value={formatPercent(summary.summary.shareOfVoice.value)}
            />
            <KpiCard
              label="Source share"
              trend={topDomain ? `${topDomain.domain}` : 'No citation mix'}
              value={topDomain ? formatPercent(topDomain.share) : '—'}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="KPI strip drill-down" description="Every metric links to source data for auditability.">
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center justify-between gap-3">
                  <span>Valid responses</span>
                  <a className="text-blue-700 underline" href={buildApiPath(summary.projectId, 'summary', range)} rel="noreferrer" target="_blank">Summary API source</a>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Mention rate</span>
                  <a className="text-blue-700 underline" href={buildApiPath(summary.projectId, 'timeseries', range) + '&granularity=day'} rel="noreferrer" target="_blank">Timeseries API source</a>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Citation rate</span>
                  <a className="text-blue-700 underline" href={buildApiPath(summary.projectId, 'citations', range)} rel="noreferrer" target="_blank">Citation records</a>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Share of voice</span>
                  <a className="text-blue-700 underline" href={buildApiPath(summary.projectId, 'summary', range)} rel="noreferrer" target="_blank">Summary formula source</a>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Source share</span>
                  <a className="text-blue-700 underline" href={buildApiPath(summary.projectId, 'citations', range)} rel="noreferrer" target="_blank">Citation drill-down</a>
                </li>
              </ul>
            </SectionCard>

            <SectionCard title="Quick links" description="Jump from summary to row-level inspections.">
              <div className="grid gap-2 text-sm">
                <Link className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href="/responses">Open Responses explorer</Link>
                <Link className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href="/citations">Open Citations explorer</Link>
                <a className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href={buildApiPath(summary.projectId, 'responses', range)} rel="noreferrer" target="_blank">Response API ({range.from} → {range.to})</a>
                <a className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href={buildApiPath(summary.projectId, 'citations', range)} rel="noreferrer" target="_blank">Citation API ({range.from} → {range.to})</a>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Trends" description="Mentions over time and citation rate by day (UTC).">
              {trendRows.length === 0 ? (
                <EmptyState title="No trend data" description="No reporting activity found for the selected range." />
              ) : (
                <DataTableShell columns={['Period', 'Mentions', 'Citation rate']}>
                  {trendRows.map((point) => (
                    <tr className="border-t border-slate-100" key={point.periodStart}>
                      <td className="px-3 py-2">{formatPeriodLabel(point.periodStart)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-right">{point.values.brand_mentions}</span>
                          <div className="h-2 w-24 rounded bg-slate-100">
                            <div className="h-2 rounded bg-slate-500" style={{ width: `${Math.max((point.values.brand_mentions / maxMentions) * 100, 4)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">{formatPercent(point.values.citation_rate)}</td>
                    </tr>
                  ))}
                </DataTableShell>
              )}
            </SectionCard>

            <SectionCard title="Source intelligence" description="Top cited domains in selected range.">
              {domainRows.length === 0 ? (
                <EmptyState title="No domains" description="No cited domains available for this period." />
              ) : (
                <DataTableShell columns={['Domain', 'Citations', 'Share', 'Drill-down']}>
                  {domainRows.map((row) => (
                    <tr className="border-t border-slate-100" key={row.domain}>
                      <td className="px-3 py-2">{row.domain}</td>
                      <td className="px-3 py-2">{row.citations}</td>
                      <td className="px-3 py-2">{formatPercent(row.share)}</td>
                      <td className="px-3 py-2">
                        <Link className="text-blue-700 underline" href="/citations">View citations</Link>
                      </td>
                    </tr>
                  ))}
                </DataTableShell>
              )}
            </SectionCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Prompt intelligence · strongest" description="Highest mention-rate prompts with valid responses.">
              {strongestPrompts.length === 0 ? (
                <EmptyState title="No strongest prompts" description="No prompt data with valid responses for this period." />
              ) : (
                <DataTableShell columns={['Prompt', 'Valid responses', 'Mention rate', 'Drill-down']}>
                  {strongestPrompts.map((prompt) => (
                    <tr className="border-t border-slate-100" key={prompt.promptId}>
                      <td className="px-3 py-2">{prompt.promptTitle}</td>
                      <td className="px-3 py-2">{prompt.validResponseCount}</td>
                      <td className="px-3 py-2">{formatPercent(prompt.mentionRate)}</td>
                      <td className="px-3 py-2">
                        <a className="text-blue-700 underline" href={buildApiPath(summary.projectId, 'by-prompt', range) + '&sortBy=mentionRate&sortDir=desc'} rel="noreferrer" target="_blank">By-prompt API</a>
                      </td>
                    </tr>
                  ))}
                </DataTableShell>
              )}
            </SectionCard>

            <SectionCard title="Prompt intelligence · weakest" description="Lowest mention-rate prompts with valid responses.">
              {weakestPrompts.length === 0 ? (
                <EmptyState title="No weakest prompts" description="No prompt data with valid responses for this period." />
              ) : (
                <DataTableShell columns={['Prompt', 'Valid responses', 'Mention rate', 'Drill-down']}>
                  {weakestPrompts.map((prompt) => (
                    <tr className="border-t border-slate-100" key={prompt.promptId}>
                      <td className="px-3 py-2">{prompt.promptTitle}</td>
                      <td className="px-3 py-2">{prompt.validResponseCount}</td>
                      <td className="px-3 py-2">{formatPercent(prompt.mentionRate)}</td>
                      <td className="px-3 py-2">
                        <a className="text-blue-700 underline" href={buildApiPath(summary.projectId, 'by-prompt', range) + '&sortBy=mentionRate&sortDir=asc'} rel="noreferrer" target="_blank">By-prompt API</a>
                      </td>
                    </tr>
                  ))}
                </DataTableShell>
              )}
            </SectionCard>
          </section>
        </>
      ) : null}
    </div>
  );
}
