import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

function canReadProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);
  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
      jobId: string;
    };
  }
) {
  const { projectId, jobId } = context.params;

  if (!canReadProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const job = await prisma.exportJob.findFirst({
    where: {
      id: jobId,
      projectId
    }
  });

  if (!job) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    job: {
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      format: job.format,
      filters: job.filtersJson,
      resultUrl: job.resultUrl,
      errorMessage: job.errorMessage,
      requestedAt: job.requestedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }
  });
}
