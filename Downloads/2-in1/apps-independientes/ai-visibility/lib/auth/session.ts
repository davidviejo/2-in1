import { createHmac, timingSafeEqual } from 'crypto';

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

import { isRole } from '@/lib/auth/dev-users';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/lib/auth/constants';
import { SessionUser } from '@/lib/auth/types';

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: string;
  projectIds?: string[];
  exp: number;
};

function getAuthSecret(): string {
  return process.env.AUTH_SESSION_SECRET ?? 'dev-only-secret-change-me';
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return createHmac('sha256', getAuthSecret()).update(value).digest('base64url');
}

function buildCookieValue(user: SessionUser): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    projectIds: user.projectIds,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = toBase64Url(payloadString);
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function createSessionSetCookie(user: SessionUser): string {
  const token = buildCookieValue(user);
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function createSessionClearCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function parseToken(token: string): SessionUser | null {
  const [encodedPayload, incomingSignature] = token.split('.');

  if (!encodedPayload || !incomingSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const incoming = Buffer.from(incomingSignature);
  const expected = Buffer.from(expectedSignature);

  if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
    return null;
  }

  const payloadRaw = fromBase64Url(encodedPayload);

  let payload: SessionPayload;
  try {
    payload = JSON.parse(payloadRaw) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.sub || !payload.email || !payload.name || !isRole(payload.role)) {
    return null;
  }

  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    projectIds: payload.projectIds
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return parseToken(token);
}

export function getRequestUser(req: NextRequest): SessionUser | null {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return parseToken(token);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
