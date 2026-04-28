import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCanAccessProject,
  mockGetRequestUser,
  mockEstimateExportSize,
  mockShouldRunInBackground,
  mockCreateExportJob,
  mockProcessExportJob,
  mockFindUniqueOrThrow
} = vi.hoisted(() => ({
  mockCanAccessProject: vi.fn(),
  mockGetRequestUser: vi.fn(),
  mockEstimateExportSize: vi.fn(),
  mockShouldRunInBackground: vi.fn(),
  mockCreateExportJob: vi.fn(),
  mockProcessExportJob: vi.fn(),
  mockFindUniqueOrThrow: vi.fn()
}));

vi.mock('@/lib/auth/authorization', () => ({
  canAccessProject: mockCanAccessProject
}));

vi.mock('@/lib/auth/session', () => ({
  getRequestUser: mockGetRequestUser
}));

vi.mock('@/lib/exports/jobs', () => ({
  estimateExportSize: mockEstimateExportSize,
  shouldRunInBackground: mockShouldRunInBackground,
  createExportJob: mockCreateExportJob,
  processExportJob: mockProcessExportJob
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    exportJob: {
      findMany: vi.fn(),
      findUniqueOrThrow: mockFindUniqueOrThrow
    }
  }
}));

import { POST } from '@/app/api/projects/[projectId]/exports/route';

describe('project exports endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccessProject.mockReturnValue(true);
    mockGetRequestUser.mockReturnValue({ id: 'user_1' });
  });

  it('returns 422 when dataset is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/p1/exports', {
      method: 'POST',
      body: JSON.stringify({
        dataset: 'invalid_dataset',
        format: 'csv',
        filters: {}
      })
    });

    const response = await POST(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(422);
    expect(mockCreateExportJob).not.toHaveBeenCalled();
  });


  it('returns 422 when report_pack is requested as csv', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/p1/exports', {
      method: 'POST',
      body: JSON.stringify({
        dataset: 'report_pack',
        format: 'csv',
        filters: {
          from: '2026-04-01',
          to: '2026-04-07'
        }
      })
    });

    const response = await POST(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(422);
    expect(mockCreateExportJob).not.toHaveBeenCalled();
  });

  it('returns 202 and does not await processing when job is large', async () => {
    mockEstimateExportSize.mockResolvedValue(5000);
    mockShouldRunInBackground.mockReturnValue(true);

    mockCreateExportJob.mockResolvedValue({
      id: 'job_1',
      status: 'QUEUED',
      format: 'CSV',
      requestedAt: '2026-04-27T00:00:00.000Z'
    });

    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback: TimerHandler) => {
      (callback as () => void)();
      return 0 as unknown as NodeJS.Timeout;
    });

    const request = new NextRequest('http://localhost:3000/api/projects/p1/exports', {
      method: 'POST',
      body: JSON.stringify({
        dataset: 'responses_table',
        format: 'csv',
        filters: {}
      })
    });

    const response = await POST(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(202);
    expect(mockProcessExportJob).toHaveBeenCalledWith('job_1');

    timeoutSpy.mockRestore();
  });

  it('returns 201 and includes result metadata for small jobs', async () => {
    mockEstimateExportSize.mockResolvedValue(12);
    mockShouldRunInBackground.mockReturnValue(false);
    mockCreateExportJob.mockResolvedValue({
      id: 'job_2',
      status: 'QUEUED',
      format: 'CSV',
      requestedAt: '2026-04-27T00:00:00.000Z'
    });

    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'job_2',
      status: 'SUCCEEDED',
      format: 'CSV',
      resultUrl: '/api/projects/p1/exports/job_2/download',
      requestedAt: '2026-04-27T00:00:00.000Z',
      startedAt: '2026-04-27T00:00:01.000Z',
      finishedAt: '2026-04-27T00:00:02.000Z'
    });

    const request = new NextRequest('http://localhost:3000/api/projects/p1/exports', {
      method: 'POST',
      body: JSON.stringify({
        dataset: 'summary_kpi_pack',
        format: 'csv',
        filters: {
          from: '2026-04-01',
          to: '2026-04-07'
        }
      })
    });

    const response = await POST(request, { params: { projectId: 'p1' } });

    expect(response.status).toBe(201);
    expect(mockProcessExportJob).toHaveBeenCalledWith('job_2');
  });
});
