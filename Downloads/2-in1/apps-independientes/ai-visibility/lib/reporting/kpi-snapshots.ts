import { computeKpis, type ComputedKpis, type ComputeKpisInput, type PromptKpi } from '@/lib/kpi/calculations';

export type PromptSnapshotAccumulator = {
  promptId: string;
  promptTitle: string;
  validResponseCount: number;
  mentionRateNumerator: number;
  mentionRateDenominator: number;
  runCount: number;
};

export type DailyKpiSnapshotPayload = {
  schemaVersion: 1;
  generatedFrom: {
    granularity: 'DAY';
  };
  kpis: ComputedKpis;
  support: {
    executedPromptIds: string[];
    promptStats: PromptSnapshotAccumulator[];
  };
};

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function buildPromptStats(input: ComputeKpisInput): PromptSnapshotAccumulator[] {
  const rows = new Map<string, PromptSnapshotAccumulator>();
  for (const prompt of input.prompts) {
    rows.set(prompt.id, {
      promptId: prompt.id,
      promptTitle: prompt.title,
      validResponseCount: 0,
      mentionRateNumerator: 0,
      mentionRateDenominator: 0,
      runCount: 0
    });
  }

  const runById = new Map(input.runs.map((run) => [run.id, run]));
  for (const run of input.runs) {
    const row = rows.get(run.promptId);
    if (row) {
      row.runCount += 1;
    }
  }

  for (const response of input.responses) {
    const run = runById.get(response.runId);
    if (!run || response.status !== 'SUCCEEDED' || run.status !== 'SUCCEEDED') {
      continue;
    }

    const row = rows.get(run.promptId);
    if (!row) {
      continue;
    }

    row.validResponseCount += 1;
    row.mentionRateDenominator += 1;
    if (response.mentionDetected) {
      row.mentionRateNumerator += 1;
    }
  }

  return Array.from(rows.values());
}

export function buildDailyKpiSnapshotPayload(input: ComputeKpisInput): DailyKpiSnapshotPayload {
  return {
    schemaVersion: 1,
    generatedFrom: {
      granularity: 'DAY'
    },
    kpis: computeKpis(input),
    support: {
      executedPromptIds: Array.from(new Set(input.runs.map((run) => run.promptId))),
      promptStats: buildPromptStats(input)
    }
  };
}

function promptComparator(a: PromptKpi, b: PromptKpi): number {
  if ((b.mentionRate ?? -1) !== (a.mentionRate ?? -1)) {
    return (b.mentionRate ?? -1) - (a.mentionRate ?? -1);
  }

  if (b.validResponseCount !== a.validResponseCount) {
    return b.validResponseCount - a.validResponseCount;
  }

  return a.promptTitle.localeCompare(b.promptTitle);
}

function normalizePayload(payload: unknown): DailyKpiSnapshotPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as DailyKpiSnapshotPayload;
  if (candidate.schemaVersion !== 1) {
    return null;
  }

  if (!candidate.kpis || !candidate.support) {
    return null;
  }

  if (!Array.isArray(candidate.support.executedPromptIds) || !Array.isArray(candidate.support.promptStats)) {
    return null;
  }

  return candidate;
}

export function combineDailySnapshotPayloads(
  rawPayloads: unknown[],
  options: { totalPrompts: number; topN?: number }
): ComputedKpis | null {
  const payloads = rawPayloads.map(normalizePayload);
  if (payloads.some((payload) => payload === null)) {
    return null;
  }

  const validPayloads = payloads as DailyKpiSnapshotPayload[];
  const topN = Math.max(1, options.topN ?? 5);

  const mentionRateNumerator = validPayloads.reduce((sum, payload) => sum + payload.kpis.mention_rate.numerator, 0);
  const mentionRateDenominator = validPayloads.reduce((sum, payload) => sum + payload.kpis.mention_rate.denominator, 0);
  const citationRateNumerator = validPayloads.reduce((sum, payload) => sum + payload.kpis.citation_rate.numerator, 0);
  const citationRateDenominator = validPayloads.reduce((sum, payload) => sum + payload.kpis.citation_rate.denominator, 0);
  const ownBrandMentions = validPayloads.reduce((sum, payload) => sum + payload.kpis.share_of_voice.ownBrandMentions, 0);
  const totalTrackedMentions = validPayloads.reduce(
    (sum, payload) => sum + payload.kpis.share_of_voice.totalTrackedMentions,
    0
  );

  const domainCounts = new Map<string, number>();
  for (const payload of validPayloads) {
    for (const row of payload.kpis.source_share.byDomain) {
      domainCounts.set(row.domain, (domainCounts.get(row.domain) ?? 0) + row.citations);
    }
  }

  const domainRows = Array.from(domainCounts.entries())
    .map(([domain, citations]) => ({ domain, citations }))
    .sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain));

  const totalCitations = domainRows.reduce((sum, row) => sum + row.citations, 0);
  const sourceRows = domainRows.map((row) => ({
    ...row,
    share: totalCitations > 0 ? row.citations / totalCitations : 0
  }));

  const sentimentPositive = validPayloads.reduce(
    (sum, payload) => sum + payload.kpis.sentiment_distribution.buckets.positive.count,
    0
  );
  const sentimentNeutral = validPayloads.reduce(
    (sum, payload) => sum + payload.kpis.sentiment_distribution.buckets.neutral.count,
    0
  );
  const sentimentNegative = validPayloads.reduce(
    (sum, payload) => sum + payload.kpis.sentiment_distribution.buckets.negative.count,
    0
  );
  const sentimentOther = validPayloads.reduce(
    (sum, payload) => sum + payload.kpis.sentiment_distribution.buckets.other.count,
    0
  );
  const sentimentDenominator = sentimentPositive + sentimentNeutral + sentimentNegative + sentimentOther;

  const promptStatsById = new Map<string, PromptSnapshotAccumulator>();
  const executedPromptIds = new Set<string>();
  for (const payload of validPayloads) {
    for (const promptId of payload.support.executedPromptIds) {
      executedPromptIds.add(promptId);
    }

    for (const row of payload.support.promptStats) {
      const existing = promptStatsById.get(row.promptId);
      if (!existing) {
        promptStatsById.set(row.promptId, { ...row });
      } else {
        existing.validResponseCount += row.validResponseCount;
        existing.mentionRateNumerator += row.mentionRateNumerator;
        existing.mentionRateDenominator += row.mentionRateDenominator;
        existing.runCount += row.runCount;
      }
    }
  }

  const promptRows: PromptKpi[] = Array.from(promptStatsById.values()).map((row) => ({
    promptId: row.promptId,
    promptTitle: row.promptTitle,
    validResponseCount: row.validResponseCount,
    mentionRateNumerator: row.mentionRateNumerator,
    mentionRateDenominator: row.mentionRateDenominator,
    mentionRate: safeRate(row.mentionRateNumerator, row.mentionRateDenominator),
    runCount: row.runCount
  }));

  const topPrompts = promptRows
    .filter((row) => row.validResponseCount > 0)
    .sort(promptComparator)
    .slice(0, topN);

  const weakestPrompts = promptRows
    .filter((row) => row.validResponseCount > 0)
    .sort((a, b) => promptComparator(b, a))
    .slice(0, topN);

  const failedRuns = validPayloads.reduce((sum, payload) => sum + payload.kpis.run_outcomes.failedRuns, 0);
  const noResultRuns = validPayloads.reduce((sum, payload) => sum + payload.kpis.run_outcomes.noResultRuns, 0);
  const totalRuns = validPayloads.reduce((sum, payload) => sum + payload.kpis.run_outcomes.totalRuns, 0);

  return {
    prompt_coverage: {
      value: safeRate(executedPromptIds.size, options.totalPrompts),
      numerator: executedPromptIds.size,
      denominator: options.totalPrompts
    },
    valid_response_count: mentionRateDenominator,
    mention_rate: {
      value: safeRate(mentionRateNumerator, mentionRateDenominator),
      numerator: mentionRateNumerator,
      denominator: mentionRateDenominator
    },
    citation_rate: {
      value: safeRate(citationRateNumerator, citationRateDenominator),
      numerator: citationRateNumerator,
      denominator: citationRateDenominator
    },
    share_of_voice: {
      value: safeRate(ownBrandMentions, totalTrackedMentions),
      ownBrandMentions,
      totalTrackedMentions
    },
    source_share: {
      totalCitations,
      byDomain: sourceRows
    },
    sentiment_distribution: {
      denominator: sentimentDenominator,
      buckets: {
        positive: { count: sentimentPositive, share: safeRate(sentimentPositive, sentimentDenominator) },
        neutral: { count: sentimentNeutral, share: safeRate(sentimentNeutral, sentimentDenominator) },
        negative: { count: sentimentNegative, share: safeRate(sentimentNegative, sentimentDenominator) },
        other: { count: sentimentOther, share: safeRate(sentimentOther, sentimentDenominator) }
      }
    },
    top_cited_domains: sourceRows.slice(0, topN),
    top_prompts: topPrompts,
    weakest_prompts: weakestPrompts,
    run_outcomes: {
      totalRuns,
      failedRuns,
      noResultRuns
    }
  };
}
