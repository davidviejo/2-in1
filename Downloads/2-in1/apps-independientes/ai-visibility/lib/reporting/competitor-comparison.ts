import { prisma } from '@/lib/db';

import { buildCompetitorComparison, type CompetitorComparisonResult } from '@/lib/reporting/competitor-comparison-core';
import type { SummaryDateRange } from '@/lib/reporting/summary-validation';

type BuildCompetitorComparisonInput = {
  projectId: string;
  range: SummaryDateRange;
};

export type ProjectCompetitorComparisonResponse = {
  projectId: string;
  range: {
    from: string;
    to: string;
  };
  comparison: CompetitorComparisonResult;
  generatedAt: string;
};

export async function buildProjectCompetitorComparison(
  input: BuildCompetitorComparisonInput
): Promise<ProjectCompetitorComparisonResponse> {
  const [project, competitors, prompts, runs, responses, mentions, citations] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: input.projectId },
      select: {
        name: true,
        primaryDomain: true
      }
    }),
    prisma.competitor.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        domain: true
      }
    }),
    prisma.prompt.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: null
      },
      select: {
        id: true,
        title: true
      }
    }),
    prisma.run.findMany({
      where: {
        projectId: input.projectId,
        executedAt: {
          gte: input.range.from,
          lte: input.range.to
        }
      },
      select: {
        id: true,
        promptId: true,
        status: true
      }
    }),
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
        runId: true,
        status: true,
        sentiment: true
      }
    }),
    prisma.responseBrandMention.findMany({
      where: {
        projectId: input.projectId,
        response: {
          run: {
            projectId: input.projectId,
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
        competitorId: true,
        mentionCount: true
      }
    }),
    prisma.citation.findMany({
      where: {
        response: {
          run: {
            projectId: input.projectId,
            executedAt: {
              gte: input.range.from,
              lte: input.range.to
            }
          }
        }
      },
      select: {
        responseId: true,
        sourceDomain: true
      }
    })
  ]);

  return {
    projectId: input.projectId,
    range: {
      from: input.range.from.toISOString(),
      to: input.range.to.toISOString()
    },
    comparison: buildCompetitorComparison({
      clientBrandName: project.name,
      clientDomain: project.primaryDomain,
      competitors,
      prompts,
      runs,
      responses,
      mentions,
      citations
    }),
    generatedAt: new Date().toISOString()
  };
}
