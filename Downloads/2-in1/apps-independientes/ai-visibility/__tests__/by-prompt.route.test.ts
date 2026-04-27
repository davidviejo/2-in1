import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCanAccessProject, mockGetRequestUser, mockBuildProjectByPromptReport } = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockBuildProjectByPromptReport: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/reporting/by-prompt', () => ({
  buildProjectByPromptReport: mockBuildProjectByPromptReport
}));

import { GET } from '@/app/api/projects/[projectId]/by-prompt/route';

describe('project by-prompt endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestUser.mockReturnValue({ id: 'user_1' });
    mockCanAccessProject.mockReturnValue(true);
  });

  it('returns 400 when date range is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/p1/by-prompt?from=bad&to=2026-04-07');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(400);
    expect(mockBuildProjectByPromptReport).not.toHaveBeenCalled();
  });

  it('builds by-prompt report with filters and sorting', async () => {
    mockBuildProjectByPromptReport.mockResolvedValue({ ok: true });

    const request = new NextRequest(
      'http://localhost:3000/api/projects/p1/by-prompt?from=2026-04-10&to=2026-04-14&country=us&language=EN&tagIds=t1,t2&sortBy=mentionRate&sortDir=asc&analysisMode=ai_overview&provider=google&surface=google_search&modelLabel=unknown&captureMethod=browser_capture'
    );

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(200);
    expect(mockBuildProjectByPromptReport).toHaveBeenCalledTimes(1);

    const call = mockBuildProjectByPromptReport.mock.calls[0]?.[0] as {
      projectId: string;
      range: { from: Date; to: Date };
      filters: { tagIds: string[]; country?: string; language?: string; analysisMode?: string };
      sortBy: string;
      sortDir: string;
    };

    expect(call.projectId).toBe('p1');
    expect(call.range.from.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(call.range.to.toISOString()).toBe('2026-04-14T23:59:59.999Z');
    expect(call.filters).toEqual({ tagIds: ['t1', 't2'], country: 'US', language: 'en', analysisMode: 'ai_overview', provider: 'google', surface: 'google_search', modelLabel: 'unknown', captureMethod: 'browser_capture' });
    expect(call.sortBy).toBe('mentionRate');
    expect(call.sortDir).toBe('asc');
  });

  it('returns 403 when user cannot access project', async () => {
    mockCanAccessProject.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/projects/p1/by-prompt?from=2026-04-10&to=2026-04-14');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(403);
    expect(mockBuildProjectByPromptReport).not.toHaveBeenCalled();
  });
});
