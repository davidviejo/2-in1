import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validatePromptInput } from '@/lib/projects/validation';

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
      promptId: string;
    };
  }
) {
  const { projectId, promptId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const validation = validatePromptInput(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  const { tagIds, ...rest } = validation.values;

  const validTagCount =
    tagIds.length === 0
      ? 0
      : await prisma.tag.count({
          where: {
            projectId,
            id: { in: tagIds },
            deletedAt: null
          }
        });

  if (validTagCount !== tagIds.length) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: { tagIds: 'One or more tags are invalid.' } }, { status: 422 });
  }

  const exists = await prisma.prompt.count({ where: { id: promptId, projectId, deletedAt: null } });

  if (!exists) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const prompt = await prisma.prompt.update({
    where: { id: promptId },
    data: {
      title: rest.promptText.slice(0, 80),
      objective: rest.notes,
      status: rest.isActive ? 'ACTIVE' : 'PAUSED',
      ...rest,
      promptTags: {
        deleteMany: {},
        create: tagIds.map((tagId) => ({ tagId }))
      }
    },
    include: {
      promptTags: { include: { tag: true }, orderBy: { tag: { name: 'asc' } } }
    }
  });

  return NextResponse.json({ prompt });
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
      promptId: string;
    };
  }
) {
  const { projectId, promptId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await prisma.prompt.updateMany({
    where: {
      id: promptId,
      projectId,
      deletedAt: null
    },
    data: {
      deletedAt: new Date()
    }
  });

  return NextResponse.json({ ok: true });
}
