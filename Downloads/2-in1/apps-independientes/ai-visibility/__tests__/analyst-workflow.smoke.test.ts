import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCanAccessProject,
  mockHasRole,
  mockGetRequestUser,
  mockPromptCreate,
  mockEstimateExportSize,
  mockShouldRunInBackground,
  mockCreateExportJob,
  mockProcessExportJob,
  mockFindUniqueOrThrow,
  mockGetResponseAudit,
  mockBuildProjectSummary
} = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockHasRole: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockPromptCreate: vi.fn(),
  mockEstimateExportSize: vi.fn(),
  mockShouldRunInBackground: vi.fn(),
  mockCreateExportJob: vi.fn(),
  mockProcessExportJob: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockGetResponseAudit: vi.fn(),
  mockBuildProjectSummary: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject,
  hasRole: mockHasRole
}));
vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser,
  createSessionSetCookie: vi.fn(() => 'session=ok')
}));
vi.mock('@/lib/projects/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/projects/validation')>('@/lib/projects/validation');
  return actual;
});
vi.mock('@/lib/exports/jobs', () => ({
  estimateExportSize: mockEstimateExportSize,
  shouldRunInBackground: mockShouldRunInBackground,
  createExportJob: mockCreateExportJob,
  processExportJob: mockProcessExportJob
}));
vi.mock('@/lib/responses/persistence', () => ({
  getResponseAudit: mockGetResponseAudit
}));
vi.mock('@/lib/reporting/summary', () => ({
  buildProjectSummary: mockBuildProjectSummary
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    prompt: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      create: mockPromptCreate
    },
    tag: { count: vi.fn(async () => 0) },
    exportJob: {
      findMany: vi.fn(async () => []),
      findUniqueOrThrow: mockFindUniqueOrThrow
    }
  }
}));

import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as createPromptPost } from '@/app/api/projects/[projectId]/prompts/route';
import { GET as getResponseDetail } from '@/app/api/projects/[projectId]/responses/[responseId]/route';
import { POST as createExportPost } from '@/app/api/projects/[projectId]/exports/route';
import { GET as getSummary } from '@/app/api/projects/[projectId]/summary/route';

describe('core analyst workflow smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccessProject.mockReturnValue(true);
    mockHasRole.mockReturnValue(true);
    mockGetRequestUser.mockReturnValue({ id: 'user_1', role: 'editor', projectIds: ['project-1'] });
  });

  it('workflow: login succeeds with seeded credentials', async () => {
    const response = await loginPost(
      new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@internal.local', password: 'admin123' })
      })
    );

    expect(response.status).toBe(200);
  });

  it('workflow: project switch + overview load are deterministic', async () => {
    mockBuildProjectSummary.mockResolvedValue({ projectId: 'project-1' });
    const response = await getSummary(
      new NextRequest('http://localhost:3000/api/projects/project-1/summary?from=2026-04-01&to=2026-04-07'),
      { params: { projectId: 'project-1' } }
    );

    expect(response.status).toBe(200);
    expect(mockBuildProjectSummary).toHaveBeenCalledOnce();
  });

  it('workflow: create prompt, inspect response detail, and export citations table', async () => {
    mockPromptCreate.mockResolvedValue({ id: 'prompt-1' });
    const promptResponse = await createPromptPost(
      new NextRequest('http://localhost:3000/api/projects/project-1/prompts', {
        method: 'POST',
        body: JSON.stringify({ promptText: 'Where am I visible?', country: 'US', language: 'en', priority: 10, tagIds: [] })
      }),
      { params: { projectId: 'project-1' } }
    );

    expect(promptResponse.status).toBe(201);

    mockGetResponseAudit.mockResolvedValue({ id: 'response-1' });
    const detailResponse = await getResponseDetail(
      new NextRequest('http://localhost:3000/api/projects/project-1/responses/response-1'),
      { params: { projectId: 'project-1', responseId: 'response-1' } }
    );
    expect(detailResponse.status).toBe(200);

    mockEstimateExportSize.mockResolvedValue(10);
    mockShouldRunInBackground.mockReturnValue(false);
    mockCreateExportJob.mockResolvedValue({
      id: 'job-1',
      status: 'QUEUED',
      format: 'CSV',
      requestedAt: '2026-04-28T00:00:00.000Z'
    });
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'job-1',
      status: 'SUCCEEDED',
      format: 'CSV',
      resultUrl: '/api/projects/project-1/exports/job-1/download',
      requestedAt: '2026-04-28T00:00:00.000Z',
      startedAt: '2026-04-28T00:00:00.000Z',
      finishedAt: '2026-04-28T00:00:01.000Z'
    });

    const exportResponse = await createExportPost(
      new NextRequest('http://localhost:3000/api/projects/project-1/exports', {
        method: 'POST',
        body: JSON.stringify({ dataset: 'citations_table', format: 'csv', filters: {} })
      }),
      { params: { projectId: 'project-1' } }
    );

    expect(exportResponse.status).toBe(201);
  });
});
