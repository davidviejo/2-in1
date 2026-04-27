import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCanAccessProject, mockGetRequestUser, mockRegenerateDailyKpiSnapshots } = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockRegenerateDailyKpiSnapshots: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/reporting/kpi-snapshot-job', () => ({
  regenerateDailyKpiSnapshots: mockRegenerateDailyKpiSnapshots
}));

import { POST } from '@/app/api/projects/[projectId]/kpi-snapshots/regenerate/route';

describe('kpi snapshot regeneration endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestUser.mockReturnValue({ id: 'user_1' });
    mockCanAccessProject.mockReturnValue(true);
  });

  it('regenerates snapshots for a valid date range', async () => {
    mockRegenerateDailyKpiSnapshots.mockResolvedValue({ daysProcessed: 3 });

    const request = new NextRequest(
      'http://localhost:3000/api/projects/p1/kpi-snapshots/regenerate?from=2026-04-01&to=2026-04-03',
      { method: 'POST' }
    );

    const response = await POST(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(200);
    expect(mockRegenerateDailyKpiSnapshots).toHaveBeenCalledTimes(1);
    const payload = (await response.json()) as { daysProcessed: number };
    expect(payload.daysProcessed).toBe(3);
  });

  it('returns 400 for invalid range input', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/projects/p1/kpi-snapshots/regenerate?from=bad&to=2026-04-03',
      { method: 'POST' }
    );

    const response = await POST(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(400);
    expect(mockRegenerateDailyKpiSnapshots).not.toHaveBeenCalled();
  });
});
