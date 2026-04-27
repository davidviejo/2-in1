import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { regenerateDailyKpiSnapshots } from '@/lib/reporting/kpi-snapshot-job';
import { validateSummaryDateRange } from '@/lib/reporting/summary-validation';

function canManageProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
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

  if (!canManageProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const validation = validateSummaryDateRange(
    request.nextUrl.searchParams.get('from'),
    request.nextUrl.searchParams.get('to')
  );

  if (!validation.values) {
    return NextResponse.json(
      {
        error: 'invalid_date_range',
        details: validation.errors ?? {}
      },
      { status: 400 }
    );
  }

  const result = await regenerateDailyKpiSnapshots({
    projectId,
    range: validation.values
  });

  return NextResponse.json({
    projectId,
    range: {
      from: validation.values.from.toISOString(),
      to: validation.values.to.toISOString()
    },
    daysProcessed: result.daysProcessed
  });
}
