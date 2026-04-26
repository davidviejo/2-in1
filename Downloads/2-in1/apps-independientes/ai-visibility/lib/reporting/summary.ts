import { prisma } from '@/lib/db';
import { computeKpis, ComputedKpis } from '@/lib/kpi/calculations';

import type { SummaryDateRange } from './summary-validation';

type ScalarDelta = {
  current: number | null;
  previous: number | null;
  absolute: number | null;
  relative: number | null;
};

type SummaryPeriod = {
  totalPrompts: number;
  promptsExecuted: number;
  validResponses: number;
  mentionRate: ComputedKpis['mention_rate'];
  citationRate: ComputedKpis['citation_rate'];
  shareOfVoice: ComputedKpis['share_of_voice'];
  sourceShare: ComputedKpis['source_share'];
  sentimentDistribution: ComputedKpis['sentiment_distribution'];
  topCitedDomains: ComputedKpis['top_cited_domains'];
  strongestPrompts: ComputedKpis['top_prompts'];
  weakestPrompts: ComputedKpis['weakest_prompts'];
};

export type ProjectSummaryResponse = {
  projectId: string;
  range: {
    from: string;
    to: string;
  };
  previousComparableRange: {
    from: string;
    to: string;
  };
  summary: SummaryPeriod;
  deltaVsPrevious: {
    totalPrompts: ScalarDelta;
    promptsExecuted: ScalarDelta;
    validResponses: ScalarDelta;
    mentionRate: ScalarDelta;
    citationRate: ScalarDelta;
    shareOfVoice: ScalarDelta;
  };
  generatedAt: string;
};

type BuildSummaryInput = {
  projectId: string;
  currentRange: SummaryDateRange;
  previousRange: SummaryDateRange;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function computeDelta(current: number | null, previous: number | null): ScalarDelta {
  if (current === null || previous === null) {
    return {
      current,
      previous,
      absolute: null,
      relative: null
    };
  }

  const absolute = current - previous;
  const relative = previous === 0 ? null : absolute / previous;

  return {
    current,
    previous,
    absolute,
    relative
  };
}

async function loadKpiInputs(projectId: string, range: SummaryDateRange) {
  const prompts = await prisma.prompt.findMany({
    where: {
      projectId,
      deletedAt: null
    },
    select: {
      id: true,
      title: true,
      isActive: true
    }
  });

  const runs = await prisma.run.findMany({
    where: {
      projectId,
      executedAt: {
        gte: range.from,
        lte: range.to
      }
    },
    select: {
      id: true,
      promptId: true,
      status: true
    }
  });

  const responses = await prisma.response.findMany({
    where: {
      run: {
        projectId,
        executedAt: {
          gte: range.from,
          lte: range.to
        }
      }
    },
    select: {
      id: true,
      runId: true,
      status: true,
      mentionDetected: true,
      sentiment: true
    }
  });

  const citations = await prisma.citation.findMany({
    where: {
      response: {
        run: {
          projectId,
          executedAt: {
            gte: range.from,
            lte: range.to
          }
        }
      }
    },
    select: {
      id: true,
      responseId: true,
      sourceDomain: true
    }
  });

  const mentions = await prisma.responseBrandMention.findMany({
    where: {
      projectId,
      response: {
        run: {
          projectId,
          executedAt: {
            gte: range.from,
            lte: range.to
          }
        }
      }
    },
    select: {
      id: true,
      responseId: true,
      mentionType: true,
      mentionCount: true
    }
  });

  return { prompts, runs, responses, citations, mentions };
}

function mapToSummaryPeriod(totalPrompts: number, kpis: ComputedKpis): SummaryPeriod {
  const promptsExecuted = kpis.prompt_coverage.numerator;

  return {
    totalPrompts,
    promptsExecuted,
    validResponses: kpis.valid_response_count,
    mentionRate: kpis.mention_rate,
    citationRate: kpis.citation_rate,
    shareOfVoice: kpis.share_of_voice,
    sourceShare: kpis.source_share,
    sentimentDistribution: kpis.sentiment_distribution,
    topCitedDomains: kpis.top_cited_domains,
    strongestPrompts: kpis.top_prompts,
    weakestPrompts: kpis.weakest_prompts
  };
}

export async function buildProjectSummary(input: BuildSummaryInput): Promise<ProjectSummaryResponse> {
  const [currentData, previousData] = await Promise.all([
    loadKpiInputs(input.projectId, input.currentRange),
    loadKpiInputs(input.projectId, input.previousRange)
  ]);

  const currentKpis = computeKpis(currentData);
  const previousKpis = computeKpis(previousData);

  const summary = mapToSummaryPeriod(currentData.prompts.length, currentKpis);
  const previousSummary = mapToSummaryPeriod(previousData.prompts.length, previousKpis);

  return {
    projectId: input.projectId,
    range: {
      from: toIso(input.currentRange.from),
      to: toIso(input.currentRange.to)
    },
    previousComparableRange: {
      from: toIso(input.previousRange.from),
      to: toIso(input.previousRange.to)
    },
    summary,
    deltaVsPrevious: {
      totalPrompts: computeDelta(summary.totalPrompts, previousSummary.totalPrompts),
      promptsExecuted: computeDelta(summary.promptsExecuted, previousSummary.promptsExecuted),
      validResponses: computeDelta(summary.validResponses, previousSummary.validResponses),
      mentionRate: computeDelta(summary.mentionRate.value, previousSummary.mentionRate.value),
      citationRate: computeDelta(summary.citationRate.value, previousSummary.citationRate.value),
      shareOfVoice: computeDelta(summary.shareOfVoice.value, previousSummary.shareOfVoice.value)
    },
    generatedAt: new Date().toISOString()
  };
}
