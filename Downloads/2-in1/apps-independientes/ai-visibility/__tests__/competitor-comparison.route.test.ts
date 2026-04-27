import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCanAccessProject, mockGetRequestUser, mockBuildProjectCompetitorComparison } = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockBuildProjectCompetitorComparison: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/reporting/competitor-comparison', () => ({
  buildProjectCompetitorComparison: mockBuildProjectCompetitorComparison
}));

import { GET } from '@/app/api/projects/[projectId]/competitors/comparison/route';

describe('project competitor comparison endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestUser.mockReturnValue({ id: 'user_1' });
    mockCanAccessProject.mockReturnValue(true);
  });

  it('returns 400 when date range is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/p1/competitors/comparison?from=bad&to=2026-04-07');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(400);
    expect(mockBuildProjectCompetitorComparison).not.toHaveBeenCalled();
  });

  it('returns 403 when project access is denied', async () => {
    mockCanAccessProject.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/projects/p1/competitors/comparison?from=2026-04-01&to=2026-04-07');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(403);
    expect(mockBuildProjectCompetitorComparison).not.toHaveBeenCalled();
  });

  it('builds competitor comparison report', async () => {
    mockBuildProjectCompetitorComparison.mockResolvedValue({ ok: true });

    const request = new NextRequest('http://localhost:3000/api/projects/p1/competitors/comparison?from=2026-04-01&to=2026-04-07');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(200);
    expect(mockBuildProjectCompetitorComparison).toHaveBeenCalledTimes(1);

    const args = mockBuildProjectCompetitorComparison.mock.calls[0]?.[0] as {
      projectId: string;
      range: { from: Date; to: Date };
    };

    expect(args.projectId).toBe('p1');
    expect(args.range.from.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(args.range.to.toISOString()).toBe('2026-04-07T23:59:59.999Z');
  });
});
