import { NextResponse } from 'next/server';

import { createSessionClearCookie } from '@/lib/auth/session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append('Set-Cookie', createSessionClearCookie());
  return response;
}
