import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateProjectSettings } from '@/lib/projects/validation';

export async function GET(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
    };
  }
) {
  const user = getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { projectId } = context.params;

  if (!canAccessProject(user, { projectId })) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { brandAliases: { orderBy: { alias: 'asc' } } }
  });

  if (!project) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
    };
  }
) {
  const user = getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { projectId } = context.params;

  if (!canAccessProject(user, { projectId }) || !hasRole(user, 'editor')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const validation = validateProjectSettings(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...validation.values
      },
      include: {
        brandAliases: { orderBy: { alias: 'asc' } }
      }
    });

    return NextResponse.json({ project });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
