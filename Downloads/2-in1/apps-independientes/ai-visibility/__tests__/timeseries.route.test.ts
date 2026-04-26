import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCanAccessProject,
  mockGetRequestUser,
  mockBuildProjectTimeseries
} = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockBuildProjectTimeseries: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/reporting/timeseries', () => ({
  buildProjectTimeseries: mockBuildProjectTimeseries
}));

import { GET } from '@/app/api/projects/[projectId]/timeseries/route';

describe('project timeseries endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestUser.mockReturnValue({ id: 'user_1' });
    mockCanAccessProject.mockReturnValue(true);
  });

  it('returns 400 when query is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/p1/timeseries?from=bad&to=2026-04-10&granularity=week');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string; details: Record<string, string> };
    expect(payload.error).toBe('invalid_timeseries_query');
    expect(payload.details.from).toBe('from must be a valid date in YYYY-MM-DD format.');
    expect(mockBuildProjectTimeseries).not.toHaveBeenCalled();
  });

  it('builds timeseries for a valid query', async () => {
    mockBuildProjectTimeseries.mockResolvedValue({ ok: true });

    const request = new NextRequest(
      'http://localhost:3000/api/projects/p1/timeseries?from=2026-04-10&to=2026-04-14&granularity=week'
    );

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(200);
    expect(mockBuildProjectTimeseries).toHaveBeenCalledTimes(1);

    const call = mockBuildProjectTimeseries.mock.calls[0]?.[0] as {
      projectId: string;
      range: { from: Date; to: Date };
      granularity: string;
    };

    expect(call.projectId).toBe('p1');
    expect(call.granularity).toBe('week');
    expect(call.range.from.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(call.range.to.toISOString()).toBe('2026-04-14T23:59:59.999Z');
  });

  it('returns 403 when user cannot access the project', async () => {
    mockCanAccessProject.mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost:3000/api/projects/p1/timeseries?from=2026-04-10&to=2026-04-14&granularity=day'
    );

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(403);
    expect(mockBuildProjectTimeseries).not.toHaveBeenCalled();
  });
});
