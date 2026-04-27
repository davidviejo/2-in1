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
    return `Δ ${(delta.absolute * 100).toFixed(1)}pp`;
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

function buildApiPath(projectId: string, path: string, range: { from: string; to: string }, extra = ''): string {
  const suffix = extra ? `&${extra}` : '';
  return `/api/projects/${projectId}/${path}?from=${range.from}&to=${range.to}${suffix}`;
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

    const abortController = new AbortController();
    void loadOverview(currentProjectId, range.from, range.to, abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [currentProjectId, range.from, range.to]);

  async function loadOverview(projectId: string, from: string, to: string, signal: AbortSignal) {
    setIsLoading(true);
    setError(null);

    try {
      const [summaryResponse, timeseriesResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/summary?from=${from}&to=${to}`, { cache: 'no-store', signal }),
        fetch(`/api/projects/${projectId}/timeseries?from=${from}&to=${to}&granularity=day`, { cache: 'no-store', signal })
      ]);

      if (!summaryResponse.ok || !timeseriesResponse.ok) {
        const fallbackError =
          summaryResponse.status === 400 || timeseriesResponse.status === 400
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
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setSummary(null);
      setTimeseries(null);
      setError('Unable to load overview reporting. Please retry.');
      setIsLoading(false);
    }
  }

  const trendRows = useMemo(() => timeseries?.series ?? [], [timeseries]);
  const domainRows = useMemo(() => summary?.summary.topCitedDomains ?? [], [summary]);
  const strongestPrompts = useMemo(() => summary?.summary.strongestPrompts ?? [], [summary]);
  const weakestPrompts = useMemo(() => summary?.summary.weakestPrompts ?? [], [summary]);

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
        title="Overview"
        description="Fast analyst scan: KPI health, trends, source quality, and prompt performance with drill-down links."
      />

      <FilterBar>
        <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Project</p>
          <p className="font-semibold text-slate-900">{currentProject?.name ?? 'Unknown project'}</p>
        </div>
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
            <Link className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" href="/responses">
              Responses
            </Link>
            <Link className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" href="/citations">
              Citations
            </Link>
            <a
              className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100"
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
              href={buildApiPath(summary.projectId, 'responses', range)}
              label="Valid responses"
              sourceLabel="source: responses endpoint"
              trend={formatDelta(summary.deltaVsPrevious.validResponses, 'count')}
              value={formatCount(summary.summary.validResponses)}
            />
            <KpiCard
              href={buildApiPath(summary.projectId, 'summary', range)}
              label="Mention rate"
              sourceLabel="source: summary endpoint"
              trend={formatDelta(summary.deltaVsPrevious.mentionRate, 'ratio')}
              value={formatPercent(summary.summary.mentionRate.value)}
            />
            <KpiCard
              href={buildApiPath(summary.projectId, 'citations', range)}
              label="Citation rate"
              sourceLabel="source: citations endpoint"
              trend={formatDelta(summary.deltaVsPrevious.citationRate, 'ratio')}
              value={formatPercent(summary.summary.citationRate.value)}
            />
            <KpiCard
              href={buildApiPath(summary.projectId, 'summary', range)}
              label="Share of voice"
              sourceLabel="source: summary endpoint"
              trend={formatDelta(summary.deltaVsPrevious.shareOfVoice, 'ratio')}
              value={formatPercent(summary.summary.shareOfVoice.value)}
            />
            <KpiCard
              href={buildApiPath(summary.projectId, 'citations', range, 'groupBy=domain&sort=share')}
              label="Source share"
              sourceLabel="source: citations explorer"
              trend={topDomain ? `top domain: ${topDomain.domain}` : 'No citation mix'}
              value={topDomain ? formatPercent(topDomain.share) : '—'}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Trends · mentions over time" description="Daily mentions with API drill-down for each row.">
              {trendRows.length === 0 ? (
                <EmptyState title="No mention trend data" description="No reporting activity found for the selected range." />
              ) : (
                <DataTableShell columns={['Period', 'Mentions', 'Source']}>
                  {trendRows.map((point) => (
                    <tr className="border-t border-slate-100" key={`mentions-${point.periodStart}`}>
                      <td className="px-3 py-2">{formatPeriodLabel(point.periodStart)}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{point.values.brand_mentions.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <a
                          className="text-blue-700 underline"
                          href={buildApiPath(summary.projectId, 'timeseries', range, 'granularity=day')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          timeseries endpoint
                        </a>
                      </td>
                    </tr>
                  ))}
                </DataTableShell>
              )}
            </SectionCard>

            <SectionCard title="Trends · citation rate over time" description="Daily citation rate rows linked to source endpoint.">
              {trendRows.length === 0 ? (
                <EmptyState title="No citation trend data" description="No reporting activity found for the selected range." />
              ) : (
                <DataTableShell columns={['Period', 'Citation rate', 'Source']}>
                  {trendRows.map((point) => (
                    <tr className="border-t border-slate-100" key={`citation-rate-${point.periodStart}`}>
                      <td className="px-3 py-2">{formatPeriodLabel(point.periodStart)}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{formatPercent(point.values.citation_rate)}</td>
                      <td className="px-3 py-2">
                        <a
                          className="text-blue-700 underline"
                          href={buildApiPath(summary.projectId, 'timeseries', range, 'granularity=day')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          timeseries endpoint
                        </a>
                      </td>
                    </tr>
                  ))}
                </DataTableShell>
              )}
            </SectionCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Source intelligence" description="Top cited domains with citation and share context.">
              {domainRows.length === 0 ? (
                <EmptyState title="No domains" description="No cited domains available for this period." />
              ) : (
                <DataTableShell columns={['Domain', 'Citations', 'Share', 'Drill-down']}>
                  {domainRows.map((row) => (
                    <tr className="border-t border-slate-100" key={row.domain}>
                      <td className="px-3 py-2">{row.domain}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{row.citations.toLocaleString()}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{formatPercent(row.share)}</td>
                      <td className="px-3 py-2">
                        <a
                          className="text-blue-700 underline"
                          href={buildApiPath(summary.projectId, 'citations', range, 'groupBy=domain&sort=count')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          citations endpoint
                        </a>
                      </td>
                    </tr>
                  ))}
                </DataTableShell>
              )}
            </SectionCard>

            <SectionCard title="Quick links" description="Move from summary KPIs to row-level explorers quickly.">
              <div className="grid gap-2 text-sm">
                <Link className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href="/responses">
                  Open Responses explorer
                </Link>
                <Link className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href="/citations">
                  Open Citations explorer
                </Link>
                <a
                  className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  href={buildApiPath(summary.projectId, 'responses', range)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Response API ({range.from} → {range.to})
                </a>
                <a
                  className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  href={buildApiPath(summary.projectId, 'citations', range)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Citation API ({range.from} → {range.to})
                </a>
              </div>
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
                      <td className="px-3 py-2 font-medium text-slate-900">{prompt.validResponseCount.toLocaleString()}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{formatPercent(prompt.mentionRate)}</td>
                      <td className="px-3 py-2">
                        <a
                          className="text-blue-700 underline"
                          href={buildApiPath(summary.projectId, 'by-prompt', range, 'sortBy=mentionRate&sortDir=desc')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          by-prompt endpoint
                        </a>
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
                      <td className="px-3 py-2 font-medium text-slate-900">{prompt.validResponseCount.toLocaleString()}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{formatPercent(prompt.mentionRate)}</td>
                      <td className="px-3 py-2">
                        <a
                          className="text-blue-700 underline"
                          href={buildApiPath(summary.projectId, 'by-prompt', range, 'sortBy=mentionRate&sortDir=asc')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          by-prompt endpoint
                        </a>
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
