import { prisma } from '@/lib/db';
import type { UpdateRunStatusInput } from '@/lib/runs/validation';
import { CitationGrouping } from '@/lib/responses/citations';
import { buildCitationExplorerGroups, CitationExplorerSortBy } from '@/lib/responses/citations-explorer';

import { buildDisplaySnippet, normalizeResponseText } from './snippets';

export async function persistRunResponse(runId: string, payload: NonNullable<UpdateRunStatusInput['response']>) {
  const cleanedText = normalizeResponseText(payload.cleanedText || payload.rawText);

  return prisma.response.upsert({
    where: {
      runId_ordinal: {
        runId,
        ordinal: 1
      }
    },
    create: {
      runId,
      ordinal: 1,
      rawText: payload.rawText,
      cleanedText,
      status: payload.status,
      language: payload.language,
      mentionDetected: payload.mentionDetected,
      mentionType: payload.mentionType,
      sentiment: payload.sentiment
    },
    update: {
      rawText: payload.rawText,
      cleanedText,
      status: payload.status,
      language: payload.language,
      mentionDetected: payload.mentionDetected,
      mentionType: payload.mentionType,
      sentiment: payload.sentiment
    }
  });
}

export async function listResponses(projectId: string, page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;

  const where = {
    run: {
      projectId
    }
  };

  const [total, rows] = await Promise.all([
    prisma.response.count({ where }),
    prisma.response.findMany({
      where,
      include: {
        run: {
          select: {
            id: true,
            status: true,
            executedAt: true,
            prompt: {
              select: {
                id: true,
                title: true,
                promptText: true
              }
            }
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: pageSize
    })
  ]);

  return {
    responses: rows.map((row: (typeof rows)[number]) => ({
      id: row.id,
      runId: row.runId,
      promptId: row.run.prompt.id,
      promptTitle: row.run.prompt.title,
      promptText: row.run.prompt.promptText,
      runStatus: row.run.status,
      responseStatus: row.status,
      language: row.language,
      mentionDetected: row.mentionDetected,
      mentionType: row.mentionType,
      sentiment: row.sentiment,
      rawText: row.rawText,
      cleanedText: row.cleanedText,
      rawSnippet: buildDisplaySnippet(row.rawText),
      cleanedSnippet: buildDisplaySnippet(row.cleanedText),
      createdAt: row.createdAt,
      runExecutedAt: row.run.executedAt
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

export async function getResponseAudit(projectId: string, responseId: string) {
  const row = await prisma.response.findFirst({
    where: {
      id: responseId,
      run: {
        projectId
      }
    },
    include: {
      run: {
        select: {
          id: true,
          projectId: true,
          prompt: {
            select: {
              id: true,
              title: true,
              promptText: true
            }
          },
          model: true,
          status: true,
          parserVersion: true,
          executedAt: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true
        }
      },
      brandMentions: {
        orderBy: [{ mentionCount: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          mentionType: true,
          mentionText: true,
          mentionCount: true,
          competitor: {
            select: {
              id: true,
              name: true,
              domain: true
            }
          },
          brandAlias: {
            select: {
              id: true,
              alias: true
            }
          }
        }
      },
      citations: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          sourceUrl: true,
          sourceDomain: true,
          title: true,
          snippet: true,
          position: true,
          publishedAt: true,
          confidence: true
        }
      }
    }
  });

  if (!row) {
    return null;
  }

  const clientMention = row.brandMentions.find((mention) => mention.mentionType === 'OWN_BRAND') ?? null;
  const competitorMentions = row.brandMentions.filter((mention) => mention.mentionType === 'COMPETITOR');

  return {
    id: row.id,
    runId: row.runId,
    projectId: row.run.projectId,
    promptId: row.run.prompt.id,
    promptTitle: row.run.prompt.title,
    promptText: row.run.prompt.promptText,
    model: row.run.model,
    runStatus: row.run.status,
    parserVersion: row.run.parserVersion,
    runTimestamps: {
      executedAt: row.run.executedAt,
      startedAt: row.run.startedAt,
      completedAt: row.run.completedAt,
      createdAt: row.run.createdAt,
      updatedAt: row.run.updatedAt
    },
    responseStatus: row.status,
    rawText: row.rawText,
    cleanedText: row.cleanedText,
    mentionDetected: row.mentionDetected,
    mentionType: row.mentionType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    clientMention,
    competitorMentions,
    citations: row.citations
  };
}


export async function listCitations(projectId: string, page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;

  const where = {
    response: {
      run: {
        projectId
      }
    }
  };

  const [total, rows] = await Promise.all([
    prisma.citation.count({ where }),
    prisma.citation.findMany({
      where,
      include: {
        response: {
          select: {
            id: true,
            run: {
              select: {
                id: true,
                model: true,
                executedAt: true,
                prompt: {
                  select: {
                    id: true,
                    title: true,
                    promptText: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: pageSize
    })
  ]);

  return {
    citations: rows.map((row: (typeof rows)[number]) => ({
      id: row.id,
      sourceUrl: row.sourceUrl,
      sourceDomain: row.sourceDomain,
      title: row.title,
      snippet: row.snippet,
      position: row.position,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
      responseId: row.responseId,
      runId: row.response.run.id,
      model: row.response.run.model,
      promptId: row.response.run.prompt.id,
      promptTitle: row.response.run.prompt.title,
      promptText: row.response.run.prompt.promptText,
      runExecutedAt: row.response.run.executedAt
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

export type ExploreCitationsInput = {
  from?: Date;
  to?: Date;
  models?: string[];
  tags?: string[];
  country?: string;
  language?: string;
  groupBy: CitationGrouping;
  sortBy: CitationExplorerSortBy;
};

export async function exploreCitations(projectId: string, input: ExploreCitationsInput) {
  const where = {
    response: {
      run: {
        projectId,
        ...(input.from || input.to
          ? {
              executedAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {})
              }
            }
          : {}),
        ...(input.models && input.models.length > 0 ? { model: { in: input.models } } : {}),
        prompt: {
          ...(input.country ? { country: input.country } : {}),
          ...(input.language ? { language: input.language } : {}),
          ...(input.tags && input.tags.length > 0
            ? {
                promptTags: {
                  some: {
                    tag: {
                      normalizedName: { in: input.tags }
                    }
                  }
                }
              }
            : {})
        }
      }
    }
  };

  const [project, competitors, rows] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { primaryDomain: true }
    }),
    prisma.competitor.findMany({
      where: { projectId, isActive: true, deletedAt: null },
      select: { domain: true }
    }),
    prisma.citation.findMany({
      where,
      select: {
        sourceUrl: true,
        sourceDomain: true
      }
    })
  ]);

  const grouped = buildCitationExplorerGroups({
    rows,
    groupBy: input.groupBy,
    sortBy: input.sortBy,
    clientDomains: project?.primaryDomain ? [project.primaryDomain] : [],
    competitorDomains: competitors.map((item: { domain: string }) => item.domain)
  });

  return {
    groupBy: input.groupBy,
    sortBy: input.sortBy,
    totalCitations: grouped.total,
    groups: grouped.groups
  };
}
