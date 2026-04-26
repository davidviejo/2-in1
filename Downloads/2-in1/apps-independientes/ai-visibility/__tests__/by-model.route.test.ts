import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCanAccessProject,
  mockGetRequestUser,
  mockBuildProjectByModelReport
} = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockBuildProjectByModelReport: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/reporting/by-model', () => ({
  buildProjectByModelReport: mockBuildProjectByModelReport
}));

import { GET } from '@/app/api/projects/[projectId]/by-model/route';

describe('project by-model endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestUser.mockReturnValue({ id: 'user_1' });
    mockCanAccessProject.mockReturnValue(true);
  });

  it('returns 400 when date range is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/p1/by-model?from=bad&to=2026-04-07');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string; details: Record<string, string> };
    expect(payload.error).toBe('invalid_date_range');
    expect(payload.details.from).toBe('from must be a valid date in YYYY-MM-DD format.');
    expect(mockBuildProjectByModelReport).not.toHaveBeenCalled();
  });

  it('builds by-model report for a valid date range', async () => {
    mockBuildProjectByModelReport.mockResolvedValue({ ok: true });

    const request = new NextRequest('http://localhost:3000/api/projects/p1/by-model?from=2026-04-10&to=2026-04-14');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(200);
    expect(mockBuildProjectByModelReport).toHaveBeenCalledTimes(1);

    const call = mockBuildProjectByModelReport.mock.calls[0]?.[0] as {
      projectId: string;
      range: { from: Date; to: Date };
    };

    expect(call.projectId).toBe('p1');
    expect(call.range.from.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(call.range.to.toISOString()).toBe('2026-04-14T23:59:59.999Z');
  });

  it('returns 403 when user cannot access the project', async () => {
    mockCanAccessProject.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/projects/p1/by-model?from=2026-04-01&to=2026-04-07');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(403);
    expect(mockBuildProjectByModelReport).not.toHaveBeenCalled();
  });
});
