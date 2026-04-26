export type KpiRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
export type KpiResponseStatus = 'SUCCEEDED' | 'FAILED' | 'CANCELED';
export type KpiMentionType = 'OWN_BRAND' | 'COMPETITOR';

export type KpiPromptRecord = {
  id: string;
  title: string;
  isActive?: boolean;
};

export type KpiRunRecord = {
  id: string;
  promptId: string;
  status: KpiRunStatus;
};

export type KpiResponseRecord = {
  id: string;
  runId: string;
  status: KpiResponseStatus;
  mentionDetected: boolean;
  sentiment: string | null;
};

export type KpiCitationRecord = {
  id: string;
  responseId: string;
  sourceDomain: string;
};

export type KpiMentionRecord = {
  id: string;
  responseId: string;
  mentionType: KpiMentionType;
  mentionCount: number;
};

export type PromptKpi = {
  promptId: string;
  promptTitle: string;
  validResponseCount: number;
  mentionRate: number | null;
  mentionRateNumerator: number;
  mentionRateDenominator: number;
  runCount: number;
};

export type ComputedKpis = {
  prompt_coverage: {
    value: number | null;
    numerator: number;
    denominator: number;
  };
  valid_response_count: number;
  mention_rate: {
    value: number | null;
    numerator: number;
    denominator: number;
  };
  citation_rate: {
    value: number | null;
    numerator: number;
    denominator: number;
  };
  share_of_voice: {
    value: number | null;
    ownBrandMentions: number;
    totalTrackedMentions: number;
  };
  source_share: {
    totalCitations: number;
    byDomain: Array<{ domain: string; citations: number; share: number }>;
  };
  sentiment_distribution: {
    denominator: number;
    buckets: {
      positive: { count: number; share: number | null };
      neutral: { count: number; share: number | null };
      negative: { count: number; share: number | null };
      other: { count: number; share: number | null };
    };
  };
  top_cited_domains: Array<{ domain: string; citations: number; share: number }>;
  top_prompts: PromptKpi[];
  weakest_prompts: PromptKpi[];
  run_outcomes: {
    totalRuns: number;
    failedRuns: number;
    noResultRuns: number;
  };
};

export type ComputeKpisInput = {
  prompts: KpiPromptRecord[];
  runs: KpiRunRecord[];
  responses: KpiResponseRecord[];
  citations: KpiCitationRecord[];
  mentions: KpiMentionRecord[];
  topN?: number;
};

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function normalizeSentiment(sentiment: string | null): 'positive' | 'neutral' | 'negative' | 'other' {
  const normalized = (sentiment ?? '').trim().toLowerCase();

  if (normalized === 'positive') {
    return 'positive';
  }

  if (normalized === 'neutral') {
    return 'neutral';
  }

  if (normalized === 'negative') {
    return 'negative';
  }

  return 'other';
}

export function computeKpis(input: ComputeKpisInput): ComputedKpis {
  const topN = Math.max(1, input.topN ?? 5);

  const runById = new Map(input.runs.map((run) => [run.id, run]));

  const responsesByRunId = new Map<string, KpiResponseRecord[]>();
  for (const response of input.responses) {
    const list = responsesByRunId.get(response.runId) ?? [];
    list.push(response);
    responsesByRunId.set(response.runId, list);
  }

  const citationsByResponseId = new Map<string, KpiCitationRecord[]>();
  for (const citation of input.citations) {
    const list = citationsByResponseId.get(citation.responseId) ?? [];
    list.push(citation);
    citationsByResponseId.set(citation.responseId, list);
  }

  const mentionsByResponseId = new Map<string, KpiMentionRecord[]>();
  for (const mention of input.mentions) {
    const list = mentionsByResponseId.get(mention.responseId) ?? [];
    list.push(mention);
    mentionsByResponseId.set(mention.responseId, list);
  }

  const validResponses = input.responses.filter((response) => {
    const run = runById.get(response.runId);
    return response.status === 'SUCCEEDED' && run?.status === 'SUCCEEDED';
  });

  const validResponseIds = new Set(validResponses.map((response) => response.id));

  let mentionRateNumerator = 0;
  let citationRateNumerator = 0;
  let ownBrandMentions = 0;
  let competitorMentions = 0;
  let sentimentPositive = 0;
  let sentimentNeutral = 0;
  let sentimentNegative = 0;
  let sentimentOther = 0;

  const citationsByDomain = new Map<string, number>();
  const promptStats = new Map<string, PromptKpi>();

  for (const prompt of input.prompts) {
    promptStats.set(prompt.id, {
      promptId: prompt.id,
      promptTitle: prompt.title,
      validResponseCount: 0,
      mentionRate: null,
      mentionRateNumerator: 0,
      mentionRateDenominator: 0,
      runCount: 0
    });
  }

  for (const run of input.runs) {
    const stats = promptStats.get(run.promptId);
    if (stats) {
      stats.runCount += 1;
    }
  }

  for (const response of validResponses) {
    const run = runById.get(response.runId);
    if (!run) {
      continue;
    }

    const prompt = promptStats.get(run.promptId);
    if (!prompt) {
      continue;
    }

    prompt.validResponseCount += 1;
    prompt.mentionRateDenominator += 1;

    if (response.mentionDetected) {
      mentionRateNumerator += 1;
      prompt.mentionRateNumerator += 1;
    }

    const responseCitations = citationsByResponseId.get(response.id) ?? [];
    if (responseCitations.length > 0) {
      citationRateNumerator += 1;
    }

    for (const citation of responseCitations) {
      const domain = citation.sourceDomain.trim().toLowerCase();
      citationsByDomain.set(domain, (citationsByDomain.get(domain) ?? 0) + 1);
    }

    for (const mention of mentionsByResponseId.get(response.id) ?? []) {
      const amount = mention.mentionCount > 0 ? mention.mentionCount : 0;
      if (mention.mentionType === 'OWN_BRAND') {
        ownBrandMentions += amount;
      }

      if (mention.mentionType === 'COMPETITOR') {
        competitorMentions += amount;
      }
    }

    const sentimentBucket = normalizeSentiment(response.sentiment);
    if (sentimentBucket === 'positive') {
      sentimentPositive += 1;
    } else if (sentimentBucket === 'neutral') {
      sentimentNeutral += 1;
    } else if (sentimentBucket === 'negative') {
      sentimentNegative += 1;
    } else {
      sentimentOther += 1;
    }
  }

  for (const prompt of promptStats.values()) {
    prompt.mentionRate = safeRate(prompt.mentionRateNumerator, prompt.mentionRateDenominator);
  }

  const promptRows = Array.from(promptStats.values());
  const activePrompts = input.prompts.filter((prompt) => prompt.isActive !== false);
  const coveredPromptIds = new Set(input.runs.map((run) => run.promptId));
  const coveredActivePrompts = activePrompts.filter((prompt) => coveredPromptIds.has(prompt.id));

  const domainRows = Array.from(citationsByDomain.entries())
    .map(([domain, citations]) => ({ domain, citations }))
    .sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain));

  const totalCitations = domainRows.reduce((sum, entry) => sum + entry.citations, 0);

  const sourceShareRows = domainRows.map((entry) => ({
    ...entry,
    share: totalCitations > 0 ? entry.citations / totalCitations : 0
  }));

  const promptComparator = (a: PromptKpi, b: PromptKpi) => {
    if ((b.mentionRate ?? -1) !== (a.mentionRate ?? -1)) {
      return (b.mentionRate ?? -1) - (a.mentionRate ?? -1);
    }

    if (b.validResponseCount !== a.validResponseCount) {
      return b.validResponseCount - a.validResponseCount;
    }

    return a.promptTitle.localeCompare(b.promptTitle);
  };

  const topPrompts = promptRows
    .filter((row) => row.validResponseCount > 0)
    .sort(promptComparator)
    .slice(0, topN);

  const weakestPrompts = promptRows
    .filter((row) => row.validResponseCount > 0)
    .sort((a, b) => promptComparator(b, a))
    .slice(0, topN);

  const failedRuns = input.runs.filter((run) => run.status === 'FAILED' || run.status === 'CANCELED').length;
  const noResultRuns = input.runs.filter((run) => {
    if (run.status !== 'SUCCEEDED') {
      return false;
    }

    const responses = responsesByRunId.get(run.id) ?? [];
    return !responses.some((response) => validResponseIds.has(response.id));
  }).length;

  const sentimentDenominator = validResponses.length;
  const totalTrackedMentions = ownBrandMentions + competitorMentions;

  return {
    prompt_coverage: {
      value: safeRate(coveredActivePrompts.length, activePrompts.length),
      numerator: coveredActivePrompts.length,
      denominator: activePrompts.length
    },
    valid_response_count: validResponses.length,
    mention_rate: {
      value: safeRate(mentionRateNumerator, validResponses.length),
      numerator: mentionRateNumerator,
      denominator: validResponses.length
    },
    citation_rate: {
      value: safeRate(citationRateNumerator, validResponses.length),
      numerator: citationRateNumerator,
      denominator: validResponses.length
    },
    share_of_voice: {
      value: safeRate(ownBrandMentions, totalTrackedMentions),
      ownBrandMentions,
      totalTrackedMentions
    },
    source_share: {
      totalCitations,
      byDomain: sourceShareRows
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
    top_cited_domains: sourceShareRows.slice(0, topN),
    top_prompts: topPrompts,
    weakest_prompts: weakestPrompts,
    run_outcomes: {
      totalRuns: input.runs.length,
      failedRuns,
      noResultRuns
    }
  };
}
