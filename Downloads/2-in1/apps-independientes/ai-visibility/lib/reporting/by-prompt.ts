import { prisma } from '@/lib/db';
import { getPreviousComparableRange, type SummaryDateRange } from '@/lib/reporting/summary-validation';

import {
  buildByPromptReportRows,
  type PromptSortDirection,
  type PromptSortField,
  type PromptReportRow
} from '@/lib/reporting/by-prompt-core';

type BuildByPromptInput = {
  projectId: string;
  range: SummaryDateRange;
  filters: {
    tagIds: string[];
    country?: string;
    language?: string;
  };
  sortBy: PromptSortField;
  sortDir: PromptSortDirection;
};

export type ProjectByPromptResponse = {
  projectId: string;
  range: {
    from: string;
    to: string;
  };
  previousComparableRange: {
    from: string;
    to: string;
  };
  filters: {
    tagIds: string[];
    country?: string;
    language?: string;
  };
  sort: {
    by: PromptSortField;
    dir: PromptSortDirection;
  };
  prompts: PromptReportRow[];
  generatedAt: string;
};

async function loadPeriodData(projectId: string, range: SummaryDateRange, filters: BuildByPromptInput['filters']) {
  const promptWhere = {
    projectId,
    deletedAt: null,
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.tagIds.length > 0
      ? {
          AND: filters.tagIds.map((tagId) => ({
            promptTags: {
              some: {
                tagId,
                tag: { deletedAt: null }
              }
            }
          }))
        }
      : {})
  };

  const prompts = await prisma.prompt.findMany({
    where: promptWhere,
    select: {
      id: true,
      title: true,
      promptText: true,
      country: true,
      language: true,
      promptTags: {
        where: { tag: { deletedAt: null } },
        select: {
          tag: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { tag: { name: 'asc' } }
      }
    }
  });

  if (prompts.length === 0) {
    return {
      prompts: [],
      runs: [],
      responses: [],
      citations: [],
      mentions: []
    };
  }

  const promptIds = prompts.map((prompt) => prompt.id);

  const [runs, responses, citations, mentions] = await Promise.all([
    prisma.run.findMany({
      where: {
        projectId,
        promptId: { in: promptIds },
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
          promptId: { in: promptIds },
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
            promptId: { in: promptIds },
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
            promptId: { in: promptIds },
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

  return {
    prompts: prompts.map((prompt) => ({
      ...prompt,
      tags: prompt.promptTags.map((item) => item.tag)
    })),
    runs,
    responses,
    citations,
    mentions
  };
}

export async function buildProjectByPromptReport(input: BuildByPromptInput): Promise<ProjectByPromptResponse> {
  const previousRange = getPreviousComparableRange(input.range);

  const [currentData, previousData] = await Promise.all([
    loadPeriodData(input.projectId, input.range, input.filters),
    loadPeriodData(input.projectId, previousRange, input.filters)
  ]);

  return {
    projectId: input.projectId,
    range: {
      from: input.range.from.toISOString(),
      to: input.range.to.toISOString()
    },
    previousComparableRange: {
      from: previousRange.from.toISOString(),
      to: previousRange.to.toISOString()
    },
    filters: input.filters,
    sort: {
      by: input.sortBy,
      dir: input.sortDir
    },
    prompts: buildByPromptReportRows(currentData, previousData, input.sortBy, input.sortDir),
    generatedAt: new Date().toISOString()
  };
}
