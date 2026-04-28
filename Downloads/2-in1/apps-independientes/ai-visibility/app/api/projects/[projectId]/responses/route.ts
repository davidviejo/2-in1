import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { normalizeCountry, normalizeLanguage, normalizeModelLabel, normalizeSearchTerm } from '@/lib/filters/normalization';
import { listResponsesFiltered } from '@/lib/responses/persistence';

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

function parseDay(raw: string | null, boundary: 'start' | 'end'): Date | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return new Date(boundary === 'start' ? `${raw}T00:00:00.000Z` : `${raw}T23:59:59.999Z`);
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
  const fromRaw = request.nextUrl.searchParams.get('from');
  const toRaw = request.nextUrl.searchParams.get('to');
  const from = parseDay(fromRaw, 'start');
  const to = parseDay(toRaw, 'end');

  if ((fromRaw && !from) || (toRaw && !to) || (from && to && from > to)) {
    return NextResponse.json({ error: 'invalid_filters' }, { status: 400 });
  }

  const rows = await listResponsesFiltered(projectId, page, pageSize, {
    from: from ?? undefined,
    to: to ?? undefined,
    model: normalizeModelLabel(request.nextUrl.searchParams.get('model')),
    tag: normalizeSearchTerm(request.nextUrl.searchParams.get('tag')),
    country: normalizeCountry(request.nextUrl.searchParams.get('country')),
    language: normalizeLanguage(request.nextUrl.searchParams.get('language')),
    mentionStatus: request.nextUrl.searchParams.get('mentionStatus') === 'mentioned' || request.nextUrl.searchParams.get('mentionStatus') === 'not_mentioned'
      ? (request.nextUrl.searchParams.get('mentionStatus') as 'mentioned' | 'not_mentioned')
      : null,
    q: normalizeSearchTerm(request.nextUrl.searchParams.get('q'))
  });
  return NextResponse.json(rows);
}
