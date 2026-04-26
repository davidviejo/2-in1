import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCanAccessProject,
  mockGetRequestUser,
  mockBuildProjectSummary
} = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockBuildProjectSummary: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/reporting/summary', () => ({
  buildProjectSummary: mockBuildProjectSummary
}));

import { GET } from '@/app/api/projects/[projectId]/summary/route';

describe('project summary endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestUser.mockReturnValue({ id: 'user_1' });
    mockCanAccessProject.mockReturnValue(true);
  });

  it('returns 400 when date range is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/p1/summary?from=bad&to=2026-04-07');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string; details: Record<string, string> };
    expect(payload.error).toBe('invalid_date_range');
    expect(payload.details.from).toBe('from must be a valid date in YYYY-MM-DD format.');
    expect(mockBuildProjectSummary).not.toHaveBeenCalled();
  });

  it('builds summary for current and immediately previous comparable period', async () => {
    mockBuildProjectSummary.mockResolvedValue({ ok: true });

    const request = new NextRequest('http://localhost:3000/api/projects/p1/summary?from=2026-04-10&to=2026-04-14');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(200);
    expect(mockBuildProjectSummary).toHaveBeenCalledTimes(1);

    const call = mockBuildProjectSummary.mock.calls[0]?.[0] as {
      projectId: string;
      currentRange: { from: Date; to: Date };
      previousRange: { from: Date; to: Date };
    };

    expect(call.projectId).toBe('p1');
    expect(call.currentRange.from.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(call.currentRange.to.toISOString()).toBe('2026-04-14T23:59:59.999Z');
    expect(call.previousRange.from.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    expect(call.previousRange.to.toISOString()).toBe('2026-04-09T23:59:59.999Z');
  });

  it('returns 403 when user cannot access the project', async () => {
    mockCanAccessProject.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/projects/p1/summary?from=2026-04-01&to=2026-04-07');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(403);
    expect(mockBuildProjectSummary).not.toHaveBeenCalled();
  });
});
