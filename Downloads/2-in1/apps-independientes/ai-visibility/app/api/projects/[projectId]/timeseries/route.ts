import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { normalizeCountry, normalizeLanguage, normalizeModelLabel } from '@/lib/filters/normalization';
import { normalizeAnalysisMode, normalizeCaptureMethod, normalizeProvider, normalizeSurface } from '@/lib/reporting/dimensions';
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
    granularity: validation.values.granularity,
    filters: {
      provider: normalizeProvider(request.nextUrl.searchParams.get('provider')),
      surface: normalizeSurface(request.nextUrl.searchParams.get('surface')),
      analysisMode: normalizeAnalysisMode(request.nextUrl.searchParams.get('analysisMode')),
      modelLabel: normalizeModelLabel(request.nextUrl.searchParams.get('modelLabel') ?? request.nextUrl.searchParams.get('model')),
      captureMethod: normalizeCaptureMethod(request.nextUrl.searchParams.get('captureMethod')),
      country: normalizeCountry(request.nextUrl.searchParams.get('country')),
      language: normalizeLanguage(request.nextUrl.searchParams.get('language')),
      promptId: request.nextUrl.searchParams.get('promptId') ?? undefined
    }
  });

  return NextResponse.json(payload);
}
