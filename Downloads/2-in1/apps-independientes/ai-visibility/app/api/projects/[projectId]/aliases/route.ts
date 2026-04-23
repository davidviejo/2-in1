import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateAliasInput } from '@/lib/projects/validation';

function canWriteProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId }) && hasRole(user, 'editor');
}

export async function POST(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
    };
  }
) {
  const { projectId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const validation = validateAliasInput(payload.alias);

  if (!validation.alias || !validation.normalizedAlias) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: { alias: validation.error } }, { status: 422 });
  }

  try {
    const alias = await prisma.brandAlias.create({
      data: {
        projectId,
        alias: validation.alias,
        normalizedAlias: validation.normalizedAlias
      }
    });

    return NextResponse.json({ alias }, { status: 201 });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'validation_failed',
          fieldErrors: { alias: 'Alias already exists for this project.' }
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
    };
  }
) {
  const { projectId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const aliasId = request.nextUrl.searchParams.get('aliasId');

  if (!aliasId) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: { aliasId: 'Alias id is required.' } }, { status: 422 });
  }

  await prisma.brandAlias.deleteMany({
    where: {
      id: aliasId,
      projectId
    }
  });

  return NextResponse.json({ ok: true });
}
