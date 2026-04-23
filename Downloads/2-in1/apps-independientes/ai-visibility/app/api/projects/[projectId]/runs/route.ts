import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { createRun, listRuns } from '@/lib/runs/tracking';
import { parseRunListFilters, validateCreateRunInput } from '@/lib/runs/validation';

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

  const filters = parseRunListFilters(projectId, request.nextUrl.searchParams);

  if (!filters.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: filters.errors }, { status: 422 });
  }

  const result = await listRuns(filters.values);
  return NextResponse.json(result);
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

  const payload = (await request.json()) as unknown;
  const validation = validateCreateRunInput(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  const user = getRequestUser(request);
  const run = await createRun(projectId, user?.id ?? null, validation.values);

  if (!run) {
    return NextResponse.json({ error: 'prompt_not_found' }, { status: 404 });
  }

  return NextResponse.json({ run }, { status: 201 });
}
