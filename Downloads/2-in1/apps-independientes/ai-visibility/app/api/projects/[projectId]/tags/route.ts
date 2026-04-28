import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateTagInput } from '@/lib/projects/validation';

function canReadProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
}

function canWriteProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId }) && hasRole(user, 'editor');
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
    };
  }
) {
  const { projectId } = context.params;

  if (!canReadProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  const tags = await prisma.tag.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } }
            ]
          }
        : {})
    },
    include: {
      _count: {
        select: {
          promptTags: true
        }
      }
    },
    orderBy: [{ name: 'asc' }]
  });

  return NextResponse.json({ tags });
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
  const validation = validateTagInput(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  try {
    const tag = await prisma.tag.create({
      data: {
        projectId,
        ...validation.values
      }
    });

    return NextResponse.json({ tag }, { status: 201 });
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
