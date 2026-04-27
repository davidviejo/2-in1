import { prisma } from '@/lib/db';
import { normalizeModelLabel } from '@/lib/filters/normalization';
import { persistRunResponse } from '@/lib/responses/persistence';

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
      surface: payload.surface,
      analysisMode: payload.analysisMode,
      model: normalizeModelLabel(payload.model) ?? payload.model,
      captureMethod: payload.captureMethod,
      source: payload.source,
      triggerType: payload.triggerType,
      environment: payload.environment,
      country: payload.country,
      language: payload.language,
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

  const run = await prisma.run.update({
    where: { id: runId },
    data: nextData,
    include: {
      prompt: { select: { id: true, title: true } }
    }
  });

  if (payload.response) {
    await persistRunResponse(run.id, payload.response);
  }

  return run;
}

function getRunWhere(filters: RunListFilters) {
  return {
    projectId: filters.projectId,
    ...(filters.promptId ? { promptId: filters.promptId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.surface ? { surface: filters.surface } : {}),
    ...(filters.analysisMode ? { analysisMode: filters.analysisMode } : {}),
    ...(filters.model ? { model: filters.model } : {}),
    ...(filters.captureMethod ? { captureMethod: filters.captureMethod } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.environment ? { environment: filters.environment } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.language ? { language: filters.language } : {}),
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

export async function getRun(projectId: string, runId: string) {
  return prisma.run.findFirst({
    where: {
      id: runId,
      projectId
    },
    include: {
      prompt: {
        select: {
          id: true,
          title: true,
          promptText: true
        }
      }
    }
  });
}
