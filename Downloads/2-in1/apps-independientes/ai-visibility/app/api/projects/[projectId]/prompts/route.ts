import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validatePromptInput } from '@/lib/projects/validation';

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

function parseTagIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
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
  const tagIds = parseTagIds(request.nextUrl.searchParams.get('tagIds'));

  const prompts = await prisma.prompt.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { promptText: { contains: query, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(tagIds.length > 0
        ? {
            AND: tagIds.map((tagId) => ({
              promptTags: {
                some: {
                  tagId,
                  tag: { deletedAt: null }
                }
              }
            }))
          }
        : {})
    },
    include: {
      promptTags: {
        where: {
          tag: {
            deletedAt: null
          }
        },
        include: {
          tag: true
        },
        orderBy: {
          tag: {
            name: 'asc'
          }
        }
      }
    },
    orderBy: [{ updatedAt: 'desc' }]
  });

  return NextResponse.json({ prompts });
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

  const prompt = await prisma.prompt.create({
    data: {
      projectId,
      ...rest,
      promptTags: {
        create: tagIds.map((tagId) => ({ tagId }))
      }
    },
    include: {
      promptTags: { include: { tag: true }, orderBy: { tag: { name: 'asc' } } }
    }
  });

  return NextResponse.json({ prompt }, { status: 201 });
}
