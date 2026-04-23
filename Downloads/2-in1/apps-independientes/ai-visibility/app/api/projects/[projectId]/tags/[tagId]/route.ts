import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateTagInput } from '@/lib/projects/validation';

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
      tagId: string;
    };
  }
) {
  const { projectId, tagId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const validation = validateTagInput(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  try {
    const tag = await prisma.tag.updateMany({
      where: {
        id: tagId,
        projectId,
        deletedAt: null
      },
      data: validation.values
    });

    if (tag.count === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const updated = await prisma.tag.findUnique({ where: { id: tagId } });

    return NextResponse.json({ tag: updated });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'validation_failed',
          fieldErrors: { name: 'A tag with this name already exists for the project.' }
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
      tagId: string;
    };
  }
) {
  const { projectId, tagId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await prisma.tag.updateMany({
    where: {
      id: tagId,
      projectId,
      deletedAt: null
    },
    data: {
      deletedAt: new Date()
    }
  });

  return NextResponse.json({ ok: true });
}
