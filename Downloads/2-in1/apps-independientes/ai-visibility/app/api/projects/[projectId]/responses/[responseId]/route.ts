import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { getResponseAudit } from '@/lib/responses/persistence';

function canReadProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
      responseId: string;
    };
  }
) {
  const { projectId, responseId } = context.params;

  if (!canReadProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const response = await getResponseAudit(projectId, responseId);

  if (!response) {
    return NextResponse.json({ error: 'response_not_found' }, { status: 404 });
  }

  return NextResponse.json({ response });
}
