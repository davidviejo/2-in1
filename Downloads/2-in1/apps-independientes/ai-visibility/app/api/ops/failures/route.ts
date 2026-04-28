import { NextRequest, NextResponse } from 'next/server';

import { hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { listRecentFailures } from '@/lib/observability/failures';

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);

  if (!user || !hasRole(user, 'editor')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const limitRaw = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : 20;

  return NextResponse.json({ failures: listRecentFailures(limit) });
}
