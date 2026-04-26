import { prisma } from '@/lib/db';

import { buildByModelFromInputs, type KpiInputsWithModel, type ModelReportRow } from '@/lib/reporting/by-model-core';
import type { SummaryDateRange } from '@/lib/reporting/summary-validation';

type BuildByModelInput = {
  projectId: string;
  range: SummaryDateRange;
};

export type ProjectByModelResponse = {
  projectId: string;
  range: {
    from: string;
    to: string;
  };
  models: ModelReportRow[];
  generatedAt: string;
};

async function loadKpiInputs(projectId: string, range: SummaryDateRange): Promise<KpiInputsWithModel> {
  const [prompts, runs, responses, citations, mentions] = await Promise.all([
    prisma.prompt.findMany({
      where: {
        projectId,
        deletedAt: null
      },
      select: {
        id: true,
        title: true,
        isActive: true
      }
    }),
    prisma.run.findMany({
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
        status: true,
        model: true
      }
    }),
    prisma.response.findMany({
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
    }),
    prisma.citation.findMany({
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
    }),
    prisma.responseBrandMention.findMany({
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
    })
  ]);

  return { prompts, runs, responses, citations, mentions };
}

export async function buildProjectByModelReport(input: BuildByModelInput): Promise<ProjectByModelResponse> {
  const records = await loadKpiInputs(input.projectId, input.range);

  return {
    projectId: input.projectId,
    range: {
      from: input.range.from.toISOString(),
      to: input.range.to.toISOString()
    },
    models: buildByModelFromInputs(records),
    generatedAt: new Date().toISOString()
  };
}
