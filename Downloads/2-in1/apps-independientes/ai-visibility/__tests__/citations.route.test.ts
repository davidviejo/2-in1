import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCanAccessProject,
  mockGetRequestUser,
  mockListCitations,
  mockExploreCitations
} = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockListCitations: vi.fn(),
  mockExploreCitations: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/responses/persistence', () => ({
  listCitations: mockListCitations,
  exploreCitations: mockExploreCitations
}));

import { GET } from '@/app/api/projects/[projectId]/citations/route';

describe('project citations endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestUser.mockReturnValue({ id: 'user_1' });
    mockCanAccessProject.mockReturnValue(true);
  });

  it('keeps paginated listing mode when explorer filters are absent', async () => {
    mockListCitations.mockResolvedValue({ citations: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });

    const request = new NextRequest('http://localhost:3000/api/projects/p1/citations?page=2&pageSize=5');
    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(200);
    expect(mockListCitations).toHaveBeenCalledWith('p1', 2, 5);
    expect(mockExploreCitations).not.toHaveBeenCalled();
  });

  it('uses explorer mode for grouped citations with filters', async () => {
    mockExploreCitations.mockResolvedValue({ groupBy: 'host', sortBy: 'share', totalCitations: 3, groups: [] });

    const request = new NextRequest(
      'http://localhost:3000/api/projects/p1/citations?groupBy=host&sort=share&from=2026-04-01&to=2026-04-07&model=gpt-4o,gemini-1.5&tag=SEO, Local&country=us&language=ES'
    );

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(200);
    expect(mockExploreCitations).toHaveBeenCalledWith('p1', {
      from: new Date('2026-04-01T00:00:00.000Z'),
      to: new Date('2026-04-07T23:59:59.999Z'),
      models: ['gpt-4o', 'gemini-1.5'],
      tags: ['seo', 'local'],
      country: 'US',
      language: 'es',
      groupBy: 'host',
      sortBy: 'share'
    });
    expect(mockListCitations).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid explorer date filters', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/p1/citations?groupBy=domain&from=not-a-date');

    const response = await GET(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string; details: Record<string, string> };
    expect(payload.error).toBe('invalid_filters');
    expect(payload.details.from).toBe('from must be a valid date in YYYY-MM-DD format.');
    expect(mockExploreCitations).not.toHaveBeenCalled();
  });
});
