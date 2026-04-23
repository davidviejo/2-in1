import { NextResponse } from 'next/server';

import { findSeededUserByCredentials, withoutPassword } from '@/lib/auth/dev-users';
import { createSessionSetCookie } from '@/lib/auth/session';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }

  const match = findSeededUserByCredentials(body.email, body.password);

  if (!match) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const user = withoutPassword(match);
  const response = NextResponse.json({ user });
  response.headers.append('Set-Cookie', createSessionSetCookie(user));

  return response;
}
