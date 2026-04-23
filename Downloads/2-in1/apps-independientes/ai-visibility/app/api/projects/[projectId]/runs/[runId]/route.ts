import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { updateRunStatus } from '@/lib/runs/tracking';
import { validateUpdateRunStatusInput } from '@/lib/runs/validation';

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
      runId: string;
    };
  }
) {
  const { projectId, runId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json()) as unknown;
  const validation = validateUpdateRunStatusInput(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  const run = await updateRunStatus(projectId, runId, validation.values);

  if (!run) {
    return NextResponse.json({ error: 'run_not_found' }, { status: 404 });
  }

  return NextResponse.json({ run });
}
