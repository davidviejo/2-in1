import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateCompetitorInput } from '@/lib/projects/validation';

function canWriteProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId }) && hasRole(user, 'editor');
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
      competitorId: string;
    };
  }
) {
  const { projectId, competitorId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const validation = validateCompetitorInput(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  try {
    const competitor = await prisma.competitor.updateMany({
      where: {
        id: competitorId,
        projectId,
        deletedAt: null
      },
      data: {
        ...validation.values
      }
    });

    if (competitor.count === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const updated = await prisma.competitor.findUnique({ where: { id: competitorId } });

    return NextResponse.json({ competitor: updated });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'validation_failed',
          fieldErrors: { domain: 'Domain already exists for this project.' }
        },
        { status: 422 }
      );
    }

    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
      competitorId: string;
    };
  }
) {
  const { projectId, competitorId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await prisma.competitor.updateMany({
    where: {
      id: competitorId,
      projectId,
      deletedAt: null
    },
    data: {
      deletedAt: new Date()
    }
  });

  return NextResponse.json({ ok: true });
}
