'use client';

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

type SentimentDistribution = {
  denominator: number;
  buckets: {
    positive: { count: number; share: number | null };
    neutral: { count: number; share: number | null };
    negative: { count: number; share: number | null };
    other: { count: number; share: number | null };
  };
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
  previousComparableRange: { from: string; to: string };
  summary: {
    totalPrompts: number;
    promptsExecuted: number;
    validResponses: number;
    mentionRate: { value: number | null };
    citationRate: { value: number | null };
    shareOfVoice: { value: number | null };
    sourceShare: { totalCitations: number; byDomain: DomainShare[] };
    sentimentDistribution: SentimentDistribution;
    topCitedDomains: DomainShare[];
    strongestPrompts: PromptKpi[];
    weakestPrompts: PromptKpi[];
  };
  deltaVsPrevious: {
    totalPrompts: DeltaValue;
    promptsExecuted: DeltaValue;
    validResponses: DeltaValue;
    mentionRate: DeltaValue;
    citationRate: DeltaValue;
    shareOfVoice: DeltaValue;
  };
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
  const from = new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);

  return {
    from: toDayInputValue(from),
    to: toDayInputValue(to)
  };
}

export function OverviewManager() {
  const { currentProject, currentProjectId, hasProjects, loading } = useProjectContext();
  const [range, setRange] = useState(createDefaultRange);
  const [payload, setPayload] = useState<SummaryPayload | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProjectId) {
      setPayload(null);
      setError(null);
      return;
    }

    void loadSummary(currentProjectId, range.from, range.to);
  }, [currentProjectId, range.from, range.to]);

  async function loadSummary(projectId: string, from: string, to: string) {
    setIsLoadingSummary(true);
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/summary?from=${from}&to=${to}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      const fallbackError = response.status === 400 ? 'Invalid date range.' : 'Unable to load overview metrics.';
      setPayload(null);
      setError(fallbackError);
      setIsLoadingSummary(false);
      return;
    }

    const data = (await response.json()) as SummaryPayload;
    setPayload(data);
    setIsLoadingSummary(false);
  }

  const domainRows = useMemo(() => payload?.summary.topCitedDomains ?? [], [payload]);
  const strongestPrompts = useMemo(() => payload?.summary.strongestPrompts ?? [], [payload]);
  const weakestPrompts = useMemo(() => payload?.summary.weakestPrompts ?? [], [payload]);

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
        description="Top-level report-ready AI visibility metrics for the selected period."
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
      </FilterBar>

      {isLoadingSummary ? <LoadingState label="Loading summary metrics…" /> : null}
      {error ? <ErrorState title="Summary unavailable" description={error} /> : null}

      {payload && !isLoadingSummary ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Total prompts"
              trend={formatDelta(payload.deltaVsPrevious.totalPrompts, 'count')}
              value={formatCount(payload.summary.totalPrompts)}
            />
            <KpiCard
              label="Prompts executed"
              trend={formatDelta(payload.deltaVsPrevious.promptsExecuted, 'count')}
              value={formatCount(payload.summary.promptsExecuted)}
            />
            <KpiCard
              label="Valid responses"
              trend={formatDelta(payload.deltaVsPrevious.validResponses, 'count')}
              value={formatCount(payload.summary.validResponses)}
            />
            <KpiCard
              label="Mention rate"
              trend={formatDelta(payload.deltaVsPrevious.mentionRate, 'ratio')}
              value={formatPercent(payload.summary.mentionRate.value)}
            />
            <KpiCard
              label="Citation rate"
              trend={formatDelta(payload.deltaVsPrevious.citationRate, 'ratio')}
              value={formatPercent(payload.summary.citationRate.value)}
            />
            <KpiCard
              label="Share of voice"
              trend={formatDelta(payload.deltaVsPrevious.shareOfVoice, 'ratio')}
              value={formatPercent(payload.summary.shareOfVoice.value)}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Sentiment distribution"
              description={`Based on ${payload.summary.sentimentDistribution.denominator} valid responses.`}
            >
              <ul className="space-y-2 text-sm text-slate-700">
                {Object.entries(payload.summary.sentimentDistribution.buckets).map(([bucket, value]) => (
                  <li className="flex items-center justify-between" key={bucket}>
                    <span className="capitalize">{bucket}</span>
                    <span>
                      {value.count} · {formatPercent(value.share)}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Source share"
              description={`Total citations: ${payload.summary.sourceShare.totalCitations.toLocaleString()}`}
            >
              {payload.summary.sourceShare.byDomain.length === 0 ? (
                <EmptyState title="No citations" description="No source citations were found in this period." />
              ) : (
                <DataTableShell columns={['Domain', 'Citations', 'Share']}>
                  {payload.summary.sourceShare.byDomain.slice(0, 8).map((row) => (
                    <tr className="border-t border-slate-100" key={row.domain}>
                      <td className="px-3 py-2">{row.domain}</td>
                      <td className="px-3 py-2">{row.citations}</td>
                      <td className="px-3 py-2">{formatPercent(row.share)}</td>
                    </tr>
                  ))}
                </DataTableShell>
              )}
            </SectionCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <SectionCard title="Top cited domains">
              {domainRows.length === 0 ? (
                <EmptyState title="No domains" description="No cited domains available for this period." />
              ) : (
                <ol className="space-y-1 text-sm text-slate-700">
                  {domainRows.map((row) => (
                    <li className="flex justify-between" key={row.domain}>
                      <span>{row.domain}</span>
                      <span>{row.citations}</span>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>

            <SectionCard title="Strongest prompts" description="Highest mention-rate prompts with valid responses.">
              {strongestPrompts.length === 0 ? (
                <EmptyState title="No prompt strength" description="No prompt data with valid responses for this period." />
              ) : (
                <ol className="space-y-1 text-sm text-slate-700">
                  {strongestPrompts.map((prompt) => (
                    <li className="flex justify-between gap-2" key={prompt.promptId}>
                      <span className="truncate">{prompt.promptTitle}</span>
                      <span>{formatPercent(prompt.mentionRate)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>

            <SectionCard title="Weakest prompts" description="Lowest mention-rate prompts with valid responses.">
              {weakestPrompts.length === 0 ? (
                <EmptyState title="No prompt weakness" description="No prompt data with valid responses for this period." />
              ) : (
                <ol className="space-y-1 text-sm text-slate-700">
                  {weakestPrompts.map((prompt) => (
                    <li className="flex justify-between gap-2" key={prompt.promptId}>
                      <span className="truncate">{prompt.promptTitle}</span>
                      <span>{formatPercent(prompt.mentionRate)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>
          </section>
        </>
      ) : null}
    </div>
  );
}
