import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearFailuresForTests, recordFailure } from '@/lib/observability/failures';

const { mockGetRequestUser, mockHasRole } = vi.hoisted(() => ({
  mockGetRequestUser: vi.fn(),
  mockHasRole: vi.fn()
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/auth/authorization', () => ({
  hasRole: mockHasRole
}));

import { GET } from '@/app/api/ops/failures/route';

describe('observability failure feed', () => {
  beforeEach(() => {
    clearFailuresForTests();
    vi.clearAllMocks();
    mockGetRequestUser.mockReturnValue({ id: 'u1', role: 'editor' });
    mockHasRole.mockReturnValue(true);
  });

  it('exposes recent failures for debugging imports/exports', async () => {
    recordFailure({
      operation: 'historical_import',
      projectId: 'project-1',
      correlationId: 'corr-1',
      message: 'bad file'
    });

    const response = await GET(new NextRequest('http://localhost:3000/api/ops/failures?limit=5'));
    const payload = (await response.json()) as { failures: Array<{ correlationId: string }> };

    expect(response.status).toBe(200);
    expect(payload.failures[0]?.correlationId).toBe('corr-1');
  });
});
