import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { normalizeCountry, normalizeLanguage, normalizeModelLabel, safeTrim } from '@/lib/filters/normalization';
import { normalizeAnalysisMode, normalizeCaptureMethod, normalizeProvider, normalizeSurface } from '@/lib/reporting/dimensions';
import { buildProjectByPromptReport } from '@/lib/reporting/by-prompt';
import { type PromptSortDirection, type PromptSortField } from '@/lib/reporting/by-prompt-core';
import { validateSummaryDateRange } from '@/lib/reporting/summary-validation';

function canReadProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
}

function parseTagIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => safeTrim(value))
        .filter(Boolean)
    )
  );
}

function parseSortBy(raw: string | null): PromptSortField {
  const normalized = safeTrim(raw).toLowerCase();

  if (normalized === 'validresponses') {
    return 'validResponses';
  }

  if (normalized === 'mentionrate') {
    return 'mentionRate';
  }

  if (normalized === 'citationrate') {
    return 'citationRate';
  }

  if (normalized === 'competitorpresence') {
    return 'competitorPresence';
  }

  return 'executions';
}

function parseSortDir(raw: string | null): PromptSortDirection {
  return safeTrim(raw).toLowerCase() === 'asc' ? 'asc' : 'desc';
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

  const payload = await buildProjectByPromptReport({
    projectId,
    range: validation.values,
    filters: {
      tagIds: parseTagIds(request.nextUrl.searchParams.get('tagIds')),
      country: normalizeCountry(request.nextUrl.searchParams.get('country')),
      language: normalizeLanguage(request.nextUrl.searchParams.get('language')),
      provider: normalizeProvider(request.nextUrl.searchParams.get('provider')),
      surface: normalizeSurface(request.nextUrl.searchParams.get('surface')),
      analysisMode: normalizeAnalysisMode(request.nextUrl.searchParams.get('analysisMode')),
      modelLabel: normalizeModelLabel(request.nextUrl.searchParams.get('modelLabel') ?? request.nextUrl.searchParams.get('model')),
      captureMethod: normalizeCaptureMethod(request.nextUrl.searchParams.get('captureMethod'))
    },
    sortBy: parseSortBy(request.nextUrl.searchParams.get('sortBy')),
    sortDir: parseSortDir(request.nextUrl.searchParams.get('sortDir'))
  });

  return NextResponse.json(payload);
}
