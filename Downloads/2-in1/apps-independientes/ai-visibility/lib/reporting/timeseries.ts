import { prisma } from '@/lib/db';

import { buildTimeseriesFromRecords, SUPPORTED_METRICS } from '@/lib/reporting/timeseries-core';
import { toRunWhereFilters, type ReportingFilters } from '@/lib/reporting/report-filters';

import type { SummaryDateRange } from '@/lib/reporting/summary-validation';
import type { TimeseriesGranularity } from '@/lib/reporting/timeseries-validation';

type BuildTimeseriesInput = {
  projectId: string;
  range: SummaryDateRange;
  granularity: TimeseriesGranularity;
  filters?: ReportingFilters;
};

export type ProjectTimeseriesResponse = {
  projectId: string;
  range: {
    from: string;
    to: string;
  };
  granularity: TimeseriesGranularity;
  timezone: 'UTC';
  metrics: typeof SUPPORTED_METRICS;
  series: ReturnType<typeof buildTimeseriesFromRecords>;
  generatedAt: string;
};

export async function buildProjectTimeseries(input: BuildTimeseriesInput): Promise<ProjectTimeseriesResponse> {
  const [responses, citations, mentions] = await Promise.all([
    prisma.response.findMany({
      where: {
        run: {
          projectId: input.projectId,
          executedAt: {
            gte: input.range.from,
            lte: input.range.to
          }
        }
      },
      select: {
        id: true,
        status: true,
        mentionDetected: true,
        sentiment: true,
        run: {
          select: {
            id: true,
            status: true,
            executedAt: true
          }
        }
      }
    }),
    prisma.citation.findMany({
      where: {
        response: {
          run: {
            projectId: input.projectId,
            ...toRunWhereFilters(input.filters ?? {}),
            ...toRunWhereFilters(input.filters ?? {}),
            ...toRunWhereFilters(input.filters ?? {}),
            executedAt: {
              gte: input.range.from,
              lte: input.range.to
            }
          }
        }
      },
      select: {
        responseId: true
      }
    }),
    prisma.responseBrandMention.findMany({
      where: {
        projectId: input.projectId,
        response: {
          run: {
            projectId: input.projectId,
            ...toRunWhereFilters(input.filters ?? {}),
            ...toRunWhereFilters(input.filters ?? {}),
            executedAt: {
              gte: input.range.from,
              lte: input.range.to
            }
          }
        }
      },
      select: {
        responseId: true,
        mentionType: true,
        mentionCount: true
      }
    })
  ]);

  const series = buildTimeseriesFromRecords(input.range, input.granularity, responses, citations, mentions);

  return {
    projectId: input.projectId,
    range: {
      from: input.range.from.toISOString(),
      to: input.range.to.toISOString()
    },
    granularity: input.granularity,
    timezone: 'UTC',
    metrics: SUPPORTED_METRICS,
    series,
    generatedAt: new Date().toISOString()
  };
}
