import { normalizeModelLabel } from '@/lib/filters/normalization';
import type { KpiCitationRecord, KpiMentionRecord, KpiResponseRecord, KpiRunRecord } from '@/lib/kpi/calculations';

type PromptRecord = {
  id: string;
  title: string;
  promptText: string;
  country: string;
  language: string;
  tags: Array<{ id: string; name: string }>;
};

type RunWithModel = KpiRunRecord & { model: string };

type PromptPeriodInput = {
  prompts: PromptRecord[];
  runs: RunWithModel[];
  responses: KpiResponseRecord[];
  citations: KpiCitationRecord[];
  mentions: KpiMentionRecord[];
};

type Rate = {
  value: number | null;
  numerator: number;
  denominator: number;
};

type ScalarDelta = {
  current: number | null;
  previous: number | null;
  absolute: number | null;
  relative: number | null;
};

export type PromptReportRow = {
  promptId: string;
  title: string;
  promptText: string;
  country: string;
  language: string;
  tags: Array<{ id: string; name: string }>;
  executions: number;
  validResponses: number;
  mentionRate: Rate;
  citationRate: Rate;
  topCitedDomains: Array<{ domain: string; citations: number; share: number }>;
  topModels: Array<{ model: string; executions: number; share: number }>;
  competitorPresence: Rate;
  sentimentSummary: {
    denominator: number;
    buckets: {
      positive: { count: number; share: number | null };
      neutral: { count: number; share: number | null };
      negative: { count: number; share: number | null };
      other: { count: number; share: number | null };
    };
  };
  deltaVsPrevious: {
    executions: ScalarDelta;
    validResponses: ScalarDelta;
    mentionRate: ScalarDelta;
    citationRate: ScalarDelta;
    competitorPresence: ScalarDelta;
  };
};

export type PromptSortField = 'executions' | 'validResponses' | 'mentionRate' | 'citationRate' | 'competitorPresence';

export type PromptSortDirection = 'asc' | 'desc';

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function computeDelta(current: number | null, previous: number | null): ScalarDelta {
  if (current === null || previous === null) {
    return { current, previous, absolute: null, relative: null };
  }

  const absolute = current - previous;
  return {
    current,
    previous,
    absolute,
    relative: previous === 0 ? null : absolute / previous
  };
}

function normalizeSentiment(value: string | null): keyof PromptReportRow['sentimentSummary']['buckets'] {
  const normalized = (value ?? '').trim().toLowerCase();

  if (normalized === 'positive' || normalized === 'neutral' || normalized === 'negative') {
    return normalized;
  }

  return 'other';
}

function buildPeriodRows(input: PromptPeriodInput): Map<string, Omit<PromptReportRow, 'deltaVsPrevious'>> {
  const runById = new Map(input.runs.map((run) => [run.id, run]));
  const promptById = new Map(input.prompts.map((prompt) => [prompt.id, prompt]));
  const responseIdsByPrompt = new Map<string, Set<string>>();

  const rows = new Map<string, Omit<PromptReportRow, 'deltaVsPrevious'>>();

  for (const prompt of input.prompts) {
    rows.set(prompt.id, {
      promptId: prompt.id,
      title: prompt.title,
      promptText: prompt.promptText,
      country: prompt.country,
      language: prompt.language,
      tags: prompt.tags,
      executions: 0,
      validResponses: 0,
      mentionRate: { value: null, numerator: 0, denominator: 0 },
      citationRate: { value: null, numerator: 0, denominator: 0 },
      topCitedDomains: [],
      topModels: [],
      competitorPresence: { value: null, numerator: 0, denominator: 0 },
      sentimentSummary: {
        denominator: 0,
        buckets: {
          positive: { count: 0, share: null },
          neutral: { count: 0, share: null },
          negative: { count: 0, share: null },
          other: { count: 0, share: null }
        }
      }
    });
  }

  const modelCounts = new Map<string, Map<string, number>>();
  const domainCounts = new Map<string, Map<string, number>>();

  for (const run of input.runs) {
    const row = rows.get(run.promptId);
    if (!row) {
      continue;
    }

    row.executions += 1;
    const normalizedModel = normalizeModelLabel(run.model) ?? 'unknown';
    const perPrompt = modelCounts.get(run.promptId) ?? new Map<string, number>();
    perPrompt.set(normalizedModel, (perPrompt.get(normalizedModel) ?? 0) + 1);
    modelCounts.set(run.promptId, perPrompt);
  }

  for (const response of input.responses) {
    const run = runById.get(response.runId);
    if (!run || run.status !== 'SUCCEEDED' || response.status !== 'SUCCEEDED') {
      continue;
    }

    const row = rows.get(run.promptId);
    if (!row) {
      continue;
    }

    row.validResponses += 1;
    row.mentionRate.denominator += 1;
    row.citationRate.denominator += 1;
    row.competitorPresence.denominator += 1;
    row.sentimentSummary.denominator += 1;

    if (response.mentionDetected) {
      row.mentionRate.numerator += 1;
    }

    const sentimentBucket = normalizeSentiment(response.sentiment);
    row.sentimentSummary.buckets[sentimentBucket].count += 1;

    const ids = responseIdsByPrompt.get(run.promptId) ?? new Set<string>();
    ids.add(response.id);
    responseIdsByPrompt.set(run.promptId, ids);
  }

  for (const citation of input.citations) {
    for (const [promptId, responseIds] of responseIdsByPrompt.entries()) {
      if (!responseIds.has(citation.responseId)) {
        continue;
      }

      const row = rows.get(promptId);
      if (!row) {
        continue;
      }

      row.citationRate.numerator += 1;
      const perPrompt = domainCounts.get(promptId) ?? new Map<string, number>();
      const domain = citation.sourceDomain.trim().toLowerCase();
      perPrompt.set(domain, (perPrompt.get(domain) ?? 0) + 1);
      domainCounts.set(promptId, perPrompt);
      break;
    }
  }

  for (const mention of input.mentions) {
    if (mention.mentionType !== 'COMPETITOR' || mention.mentionCount <= 0) {
      continue;
    }

    for (const [promptId, responseIds] of responseIdsByPrompt.entries()) {
      if (!responseIds.has(mention.responseId)) {
        continue;
      }

      const row = rows.get(promptId);
      if (row) {
        row.competitorPresence.numerator += 1;
      }
      break;
    }
  }

  for (const [promptId, row] of rows.entries()) {
    row.mentionRate.value = safeRate(row.mentionRate.numerator, row.mentionRate.denominator);
    row.competitorPresence.value = safeRate(row.competitorPresence.numerator, row.competitorPresence.denominator);

    // numerator here is valid responses with >=1 citation
    if (row.citationRate.denominator > 0) {
      const promptResponseIds = responseIdsByPrompt.get(promptId) ?? new Set<string>();
      const citedResponseIds = new Set<string>();
      for (const citation of input.citations) {
        if (promptResponseIds.has(citation.responseId)) {
          citedResponseIds.add(citation.responseId);
        }
      }
      row.citationRate.numerator = citedResponseIds.size;
      row.citationRate.value = safeRate(citedResponseIds.size, row.citationRate.denominator);
    }

    const totalModels = Array.from(modelCounts.get(promptId)?.values() ?? []).reduce((sum, count) => sum + count, 0);
    row.topModels = Array.from(modelCounts.get(promptId)?.entries() ?? [])
      .map(([model, executions]) => ({ model, executions, share: totalModels > 0 ? executions / totalModels : 0 }))
      .sort((a, b) => b.executions - a.executions || a.model.localeCompare(b.model))
      .slice(0, 5);

    const totalCitations = Array.from(domainCounts.get(promptId)?.values() ?? []).reduce((sum, count) => sum + count, 0);
    row.topCitedDomains = Array.from(domainCounts.get(promptId)?.entries() ?? [])
      .map(([domain, citations]) => ({ domain, citations, share: totalCitations > 0 ? citations / totalCitations : 0 }))
      .sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain))
      .slice(0, 5);

    for (const bucket of Object.values(row.sentimentSummary.buckets)) {
      bucket.share = safeRate(bucket.count, row.sentimentSummary.denominator);
    }
  }

  for (const run of input.runs) {
    if (!promptById.has(run.promptId) && !rows.has(run.promptId)) {
      continue;
    }
  }

  return rows;
}

export function buildByPromptReportRows(
  current: PromptPeriodInput,
  previous: PromptPeriodInput,
  sortBy: PromptSortField,
  sortDir: PromptSortDirection
): PromptReportRow[] {
  const currentRows = buildPeriodRows(current);
  const previousRows = buildPeriodRows(previous);

  const merged: PromptReportRow[] = Array.from(currentRows.values()).map((row) => {
    const prev = previousRows.get(row.promptId);

    return {
      ...row,
      deltaVsPrevious: {
        executions: computeDelta(row.executions, prev?.executions ?? 0),
        validResponses: computeDelta(row.validResponses, prev?.validResponses ?? 0),
        mentionRate: computeDelta(row.mentionRate.value, prev?.mentionRate.value ?? null),
        citationRate: computeDelta(row.citationRate.value, prev?.citationRate.value ?? null),
        competitorPresence: computeDelta(row.competitorPresence.value, prev?.competitorPresence.value ?? null)
      }
    };
  });

  const directionFactor = sortDir === 'asc' ? 1 : -1;

  merged.sort((a, b) => {
    const aValue =
      sortBy === 'executions'
        ? a.executions
        : sortBy === 'validResponses'
          ? a.validResponses
          : sortBy === 'mentionRate'
            ? a.mentionRate.value ?? -1
            : sortBy === 'citationRate'
              ? a.citationRate.value ?? -1
              : a.competitorPresence.value ?? -1;

    const bValue =
      sortBy === 'executions'
        ? b.executions
        : sortBy === 'validResponses'
          ? b.validResponses
          : sortBy === 'mentionRate'
            ? b.mentionRate.value ?? -1
            : sortBy === 'citationRate'
              ? b.citationRate.value ?? -1
              : b.competitorPresence.value ?? -1;

    if (aValue !== bValue) {
      return (aValue - bValue) * directionFactor;
    }

    return a.title.localeCompare(b.title);
  });

  return merged;
}
