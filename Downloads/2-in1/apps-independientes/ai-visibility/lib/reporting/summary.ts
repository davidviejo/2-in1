import { prisma } from '@/lib/db';
import { computeKpis, ComputedKpis } from '@/lib/kpi/calculations';

import { combineDailySnapshotPayloads } from './kpi-snapshots';
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


type PromptRow = {
  id: string;
  title: string;
  isActive: boolean;
};

type SnapshotRow = {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  metricsJson: unknown;
};

type BuildSummaryInput = {
  projectId: string;
  currentRange: SummaryDateRange;
  previousRange: SummaryDateRange;
  useDailySnapshots?: boolean;
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
  const prompts: PromptRow[] = await prisma.prompt.findMany({
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

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function isWholeDayRange(range: SummaryDateRange): boolean {
  return range.from.getTime() === startOfUtcDay(range.from).getTime() && range.to.getTime() === endOfUtcDay(range.to).getTime();
}

function countDaysInRange(range: SummaryDateRange): number {
  return Math.floor((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

async function getLatestSourceMutation(projectId: string, range: SummaryDateRange): Promise<Date | null> {
  const [latestRun, latestResponse, latestCitation, latestMention] = await Promise.all([
    prisma.run.findFirst({
      where: {
        projectId,
        executedAt: {
          gte: range.from,
          lte: range.to
        }
      },
      select: { updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.response.findFirst({
      where: {
        run: {
          projectId,
          executedAt: {
            gte: range.from,
            lte: range.to
          }
        }
      },
      select: { updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.citation.findFirst({
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
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.responseBrandMention.findFirst({
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
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const candidates = [
    latestRun?.updatedAt,
    latestResponse?.updatedAt,
    latestCitation?.createdAt,
    latestMention?.createdAt
  ].filter((value): value is Date => Boolean(value));

  if (candidates.length === 0) {
    return null;
  }

  return new Date(Math.max(...candidates.map((value) => value.getTime())));
}

async function loadKpisFromSnapshots(projectId: string, range: SummaryDateRange, totalPrompts: number): Promise<ComputedKpis | null> {
  if (!isWholeDayRange(range)) {
    return null;
  }

  const snapshots: SnapshotRow[] = await prisma.kpiSnapshot.findMany({
    where: {
      projectId,
      granularity: 'DAY',
      promptId: null,
      competitorId: null,
      sourceDomain: null,
      model: null,
      periodStart: {
        gte: range.from,
        lte: range.to
      },
      periodEnd: {
        gte: range.from,
        lte: range.to
      }
    },
    select: {
      periodStart: true,
      periodEnd: true,
      generatedAt: true,
      metricsJson: true
    },
    orderBy: {
      periodStart: 'asc'
    }
  });

  if (snapshots.length !== countDaysInRange(range)) {
    return null;
  }

  for (const snapshot of snapshots) {
    if (snapshot.periodStart.getTime() !== startOfUtcDay(snapshot.periodStart).getTime()) {
      return null;
    }

    if (snapshot.periodEnd.getTime() !== endOfUtcDay(snapshot.periodStart).getTime()) {
      return null;
    }
  }

  const latestMutation = await getLatestSourceMutation(projectId, range);
  const earliestSnapshot = snapshots.reduce((earliest: Date | null, snapshot: SnapshotRow) => {
    if (!earliest || snapshot.generatedAt < earliest) {
      return snapshot.generatedAt;
    }

    return earliest;
  }, null as Date | null);

  if (latestMutation && earliestSnapshot && latestMutation > earliestSnapshot) {
    return null;
  }

  return combineDailySnapshotPayloads(
    snapshots.map((snapshot: SnapshotRow) => snapshot.metricsJson),
    {
      totalPrompts
    }
  );
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

async function resolveRangeKpis(projectId: string, range: SummaryDateRange, useDailySnapshots: boolean) {
  const prompts: PromptRow[] = await prisma.prompt.findMany({
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

  if (useDailySnapshots) {
    const snapshotKpis = await loadKpisFromSnapshots(projectId, range, prompts.filter((prompt: PromptRow) => prompt.isActive !== false).length);
    if (snapshotKpis) {
      return {
        prompts,
        kpis: snapshotKpis,
        source: 'snapshot' as const
      };
    }
  }

  const details = await loadKpiInputs(projectId, range);

  return {
    prompts: details.prompts,
    kpis: computeKpis(details),
    source: 'direct' as const
  };
}

export async function buildProjectSummary(input: BuildSummaryInput): Promise<ProjectSummaryResponse> {
  const useDailySnapshots = input.useDailySnapshots ?? false;

  const [currentData, previousData] = await Promise.all([
    resolveRangeKpis(input.projectId, input.currentRange, useDailySnapshots),
    resolveRangeKpis(input.projectId, input.previousRange, useDailySnapshots)
  ]);

  const summary = mapToSummaryPeriod(currentData.prompts.length, currentData.kpis);
  const previousSummary = mapToSummaryPeriod(previousData.prompts.length, previousData.kpis);

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
