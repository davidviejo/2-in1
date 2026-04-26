import { prisma } from '@/lib/db';
import type { UpdateRunStatusInput } from '@/lib/runs/validation';

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
