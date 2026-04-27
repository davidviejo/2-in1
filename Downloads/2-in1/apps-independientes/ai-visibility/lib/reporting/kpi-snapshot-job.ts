import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { type ComputeKpisInput } from '@/lib/kpi/calculations';

import { buildDailyKpiSnapshotPayload } from './kpi-snapshots';
import type { SummaryDateRange } from './summary-validation';

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function* iterateDays(range: SummaryDateRange): Generator<{ dayStart: Date; dayEnd: Date }> {
  let cursor = startOfUtcDay(range.from);
  const terminal = endOfUtcDay(range.to);

  while (cursor <= terminal) {
    const dayStart = cursor;
    const dayEnd = endOfUtcDay(cursor);
    yield { dayStart, dayEnd };

    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
}

async function loadKpiInputs(projectId: string, range: SummaryDateRange): Promise<ComputeKpisInput> {
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

  return {
    prompts,
    runs,
    responses,
    citations,
    mentions
  };
}

export async function regenerateDailyKpiSnapshots(input: {
  projectId: string;
  range: SummaryDateRange;
}): Promise<{ daysProcessed: number }> {
  let daysProcessed = 0;

  for (const day of iterateDays(input.range)) {
    const dayInput = await loadKpiInputs(input.projectId, {
      from: day.dayStart,
      to: day.dayEnd
    });

    const payload = buildDailyKpiSnapshotPayload(dayInput);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.kpiSnapshot.deleteMany({
        where: {
          projectId: input.projectId,
          granularity: 'DAY',
          promptId: null,
          competitorId: null,
          sourceDomain: null,
          model: null,
          periodStart: day.dayStart,
          periodEnd: day.dayEnd
        }
      });

      await tx.kpiSnapshot.create({
        data: {
          projectId: input.projectId,
          granularity: 'DAY',
          periodStart: day.dayStart,
          periodEnd: day.dayEnd,
          metricsJson: payload
        }
      });
    });

    daysProcessed += 1;
  }

  return { daysProcessed };
}
