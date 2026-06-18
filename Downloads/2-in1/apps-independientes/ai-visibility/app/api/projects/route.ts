import { NextRequest, NextResponse } from 'next/server';

import { hasRole } from '@/lib/auth/authorization';
import { ensureDbUser } from '@/lib/auth/db-user';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateProjectSettings } from '@/lib/projects/validation';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(user.role === 'admin' || !user.projectIds?.length ? {} : { id: { in: user.projectIds } })
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        brandAliases: { orderBy: { alias: 'asc' } }
      }
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[api/projects][GET] failed', error);
    return NextResponse.json({ error: 'projects_unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!hasRole(user, 'editor')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const validation = validateProjectSettings(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  try {
    const baseSlug = slugify(validation.values.name) || 'project';
    let slug = baseSlug;
    let index = 1;

    while (await prisma.project.findUnique({ where: { slug } })) {
      index += 1;
      slug = `${baseSlug}-${index}`;
    }

    const dbUser = await ensureDbUser(user);

    const project = await prisma.project.create({
      data: {
        ...validation.values,
        slug,
        ownerUserId: dbUser.id
      },
      include: {
        brandAliases: { orderBy: { alias: 'asc' } }
      }
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('[api/projects][POST] failed', error);
    return NextResponse.json({ error: 'project_create_failed' }, { status: 503 });
  }
}
