import { prisma } from '@/lib/db';

import type { CreateRunInput, RunListFilters, UpdateRunStatusInput } from './validation';

export async function createRun(projectId: string, triggeredByUserId: string | null, payload: CreateRunInput) {
  const prompt = await prisma.prompt.findFirst({
    where: {
      id: payload.promptId,
      projectId,
      deletedAt: null
    },
    select: { id: true }
  });

  if (!prompt) {
    return null;
  }

  return prisma.run.create({
    data: {
      projectId,
      promptId: payload.promptId,
      triggeredByUserId,
      status: 'QUEUED',
      provider: payload.provider,
      model: payload.model,
      source: payload.source,
      triggerType: payload.triggerType,
      environment: payload.environment,
      parserVersion: payload.parserVersion,
      rawRequestMetadata: payload.rawRequestMetadata
    },
    include: {
      prompt: { select: { id: true, title: true, promptText: true } }
    }
  });
}

export async function updateRunStatus(projectId: string, runId: string, payload: UpdateRunStatusInput) {
  const current = await prisma.run.findFirst({
    where: { id: runId, projectId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true
    }
  });

  if (!current) {
    return null;
  }

  const nextData = {
    status: payload.status,
    errorMessage: payload.errorMessage,
    startedAt: payload.startedAt ?? current.startedAt,
    completedAt: payload.completedAt
  };

  if (payload.status === 'RUNNING' && !nextData.startedAt) {
    nextData.startedAt = new Date();
  }

  return prisma.run.update({
    where: { id: runId },
    data: nextData,
    include: {
      prompt: { select: { id: true, title: true } }
    }
  });
}

function getRunWhere(filters: RunListFilters) {
  return {
    projectId: filters.projectId,
    ...(filters.promptId ? { promptId: filters.promptId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.model ? { model: filters.model } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.environment ? { environment: filters.environment } : {}),
    ...(filters.startedFrom || filters.startedTo
      ? {
          startedAt: {
            ...(filters.startedFrom ? { gte: filters.startedFrom } : {}),
            ...(filters.startedTo ? { lte: filters.startedTo } : {})
          }
        }
      : {}),
    ...(filters.completedFrom || filters.completedTo
      ? {
          completedAt: {
            ...(filters.completedFrom ? { gte: filters.completedFrom } : {}),
            ...(filters.completedTo ? { lte: filters.completedTo } : {})
          }
        }
      : {})
  };
}

export async function listRuns(filters: RunListFilters) {
  const where = getRunWhere(filters);
  const skip = (filters.page - 1) * filters.pageSize;

  const [total, runs] = await Promise.all([
    prisma.run.count({ where }),
    prisma.run.findMany({
      where,
      include: {
        prompt: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: [{ executedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: filters.pageSize
    })
  ]);

  return {
    runs,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize))
    }
  };
}
