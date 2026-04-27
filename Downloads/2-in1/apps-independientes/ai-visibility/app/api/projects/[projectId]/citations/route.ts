import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { exploreCitations, listCitations } from '@/lib/responses/persistence';
import { normalizeCountry, normalizeLanguage, normalizeModelLabel, safeTrim } from '@/lib/filters/normalization';
import { normalizeAnalysisMode, normalizeCaptureMethod, normalizeProvider, normalizeSurface } from '@/lib/reporting/dimensions';
import { CitationGrouping } from '@/lib/responses/citations';
import { CitationExplorerSortBy } from '@/lib/responses/citations-explorer';

function canReadProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function splitCsv(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseDate(raw: string | null, boundary: 'start' | 'end'): Date | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  return new Date(boundary === 'start' ? `${trimmed}T00:00:00.000Z` : `${trimmed}T23:59:59.999Z`);
}

function parseGrouping(raw: string | null): CitationGrouping {
  return raw === 'host' || raw === 'page' ? raw : 'domain';
}

function parseSort(raw: string | null): CitationExplorerSortBy {
  return raw === 'share' ? 'share' : 'count';
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

  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = Math.min(parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 20), 100);
  const hasExplorerParams =
    request.nextUrl.searchParams.has('groupBy') ||
    request.nextUrl.searchParams.has('sort') ||
    request.nextUrl.searchParams.has('from') ||
    request.nextUrl.searchParams.has('to') ||
    request.nextUrl.searchParams.has('model') ||
    request.nextUrl.searchParams.has('tag') ||
    request.nextUrl.searchParams.has('country') ||
    request.nextUrl.searchParams.has('language') ||
    request.nextUrl.searchParams.has('provider') ||
    request.nextUrl.searchParams.has('surface') ||
    request.nextUrl.searchParams.has('analysisMode') ||
    request.nextUrl.searchParams.has('captureMethod');

  if (hasExplorerParams) {
    const from = parseDate(request.nextUrl.searchParams.get('from'), 'start');
    const to = parseDate(request.nextUrl.searchParams.get('to'), 'end');
    const fromRaw = request.nextUrl.searchParams.get('from');
    const toRaw = request.nextUrl.searchParams.get('to');

    if ((fromRaw && !from) || (toRaw && !to) || (from && to && from > to)) {
      return NextResponse.json(
        {
          error: 'invalid_filters',
          details: {
            ...(fromRaw && !from ? { from: 'from must be a valid date in YYYY-MM-DD format.' } : {}),
            ...(toRaw && !to ? { to: 'to must be a valid date in YYYY-MM-DD format.' } : {}),
            ...(from && to && from > to ? { range: 'from must be before or equal to to.' } : {})
          }
        },
        { status: 400 }
      );
    }

    const result = await exploreCitations(projectId, {
      from: from ?? undefined,
      to: to ?? undefined,
      models: splitCsv(request.nextUrl.searchParams.get('model')).map((value) => normalizeModelLabel(value)).filter((value): value is string => Boolean(value)),
      tags: splitCsv(request.nextUrl.searchParams.get('tag')).map((value) => safeTrim(value).toLowerCase()).filter(Boolean),
      country: normalizeCountry(request.nextUrl.searchParams.get('country')),
      language: normalizeLanguage(request.nextUrl.searchParams.get('language')),
      provider: normalizeProvider(request.nextUrl.searchParams.get('provider')),
      surface: normalizeSurface(request.nextUrl.searchParams.get('surface')),
      analysisMode: normalizeAnalysisMode(request.nextUrl.searchParams.get('analysisMode')),
      captureMethod: normalizeCaptureMethod(request.nextUrl.searchParams.get('captureMethod')),
      groupBy: parseGrouping(request.nextUrl.searchParams.get('groupBy')),
      sortBy: parseSort(request.nextUrl.searchParams.get('sort'))
    });

    return NextResponse.json(result);
  }

  const rows = await listCitations(projectId, page, pageSize);
  return NextResponse.json(rows);
}
