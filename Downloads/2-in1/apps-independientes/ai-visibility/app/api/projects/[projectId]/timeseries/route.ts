import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { buildProjectTimeseries } from '@/lib/reporting/timeseries';
import { validateTimeseriesQuery } from '@/lib/reporting/timeseries-validation';

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
    };
  }
) {
  const { projectId } = context.params;

  if (!canReadProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const validation = validateTimeseriesQuery(
    request.nextUrl.searchParams.get('from'),
    request.nextUrl.searchParams.get('to'),
    request.nextUrl.searchParams.get('granularity')
  );

  if (!validation.values) {
    return NextResponse.json(
      {
        error: 'invalid_timeseries_query',
        details: validation.errors ?? {}
      },
      { status: 400 }
    );
  }

  const payload = await buildProjectTimeseries({
    projectId,
    range: validation.values.range,
    granularity: validation.values.granularity
  });

  return NextResponse.json(payload);
}
