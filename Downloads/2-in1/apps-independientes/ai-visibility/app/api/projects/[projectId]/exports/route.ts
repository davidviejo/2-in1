import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import {
  createExportJob,
  estimateExportSize,
  processExportJob,
  shouldRunInBackground
} from '@/lib/exports/jobs';
import {
  exportDatasetValues,
  exportFormatValues,
  type ExportDataset,
  type ExportFileFormat,
  type ExportRequestFilters
} from '@/lib/exports/types';
import { prisma } from '@/lib/db';
import { recordFailure } from '@/lib/observability/failures';
import { buildCorrelationHeaders, getCorrelationIdFromHeaders, logOperation } from '@/lib/observability/logging';

function canReadProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);
  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
}

function parseBody(payload: unknown): {
  dataset?: ExportDataset;
  format?: ExportFileFormat;
  filters: ExportRequestFilters;
  errors: Record<string, string>;
} {
  const object = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};

  const datasetRaw = typeof object.dataset === 'string' ? object.dataset : '';
  const formatRaw = typeof object.format === 'string' ? object.format : '';

  const errors: Record<string, string> = {};

  const dataset = exportDatasetValues.includes(datasetRaw as ExportDataset) ? (datasetRaw as ExportDataset) : undefined;
  if (!dataset) {
    errors.dataset = `dataset must be one of: ${exportDatasetValues.join(', ')}`;
  }

  const format = exportFormatValues.includes(formatRaw as ExportFileFormat) ? (formatRaw as ExportFileFormat) : undefined;
  if (!format) {
    errors.format = `format must be one of: ${exportFormatValues.join(', ')}`;
  }

  const filtersRaw = typeof object.filters === 'object' && object.filters !== null ? (object.filters as Record<string, unknown>) : {};

  const filters: ExportRequestFilters = {
    from: typeof filtersRaw.from === 'string' ? filtersRaw.from : undefined,
    to: typeof filtersRaw.to === 'string' ? filtersRaw.to : undefined,
    q: typeof filtersRaw.q === 'string' ? filtersRaw.q : undefined,
    country: typeof filtersRaw.country === 'string' ? filtersRaw.country : undefined,
    language: typeof filtersRaw.language === 'string' ? filtersRaw.language : undefined,
    active: filtersRaw.active === 'all' || filtersRaw.active === 'active' || filtersRaw.active === 'inactive' ? filtersRaw.active : undefined,
    intentClassification: typeof filtersRaw.intentClassification === 'string' ? filtersRaw.intentClassification : undefined,
    tagIds: typeof filtersRaw.tagIds === 'string' ? filtersRaw.tagIds : undefined,
    granularity: filtersRaw.granularity === 'day' || filtersRaw.granularity === 'week' ? filtersRaw.granularity : undefined,
    provider: typeof filtersRaw.provider === 'string' ? filtersRaw.provider : undefined,
    surface: typeof filtersRaw.surface === 'string' ? filtersRaw.surface : undefined,
    analysisMode: typeof filtersRaw.analysisMode === 'string' ? filtersRaw.analysisMode : undefined,
    modelLabel: typeof filtersRaw.modelLabel === 'string' ? filtersRaw.modelLabel : undefined,
    captureMethod: typeof filtersRaw.captureMethod === 'string' ? filtersRaw.captureMethod : undefined,
    includeNarrativeInsights: typeof filtersRaw.includeNarrativeInsights === 'boolean' ? filtersRaw.includeNarrativeInsights : undefined
  };

  if (dataset === 'report_pack' && format === 'csv') {
    errors.format = 'format csv is not supported for dataset report_pack. Use xlsx.';
  }

  return { dataset, format, filters, errors };
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
    };
  }
) {
  const { projectId } = context.params;
  const correlationId = getCorrelationIdFromHeaders(request.headers);

  if (!canReadProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: buildCorrelationHeaders(correlationId) });
  }

  const jobs = await prisma.exportJob.findMany({
    where: { projectId },
    orderBy: [{ requestedAt: 'desc' }],
    take: 50
  });

  return NextResponse.json({
    jobs: jobs.map((job: (typeof jobs)[number]) => ({
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      format: job.format,
      filters: job.filtersJson,
      resultUrl: job.resultUrl,
      errorMessage: job.errorMessage,
      requestedAt: job.requestedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }))
  }, { headers: buildCorrelationHeaders(correlationId) });
}

export async function POST(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
    };
  }
) {
  const { projectId } = context.params;
  const correlationId = getCorrelationIdFromHeaders(request.headers);

  if (!canReadProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: buildCorrelationHeaders(correlationId) });
  }

  const user = getRequestUser(request);
  const payload = parseBody(await request.json());

  if (!payload.dataset || !payload.format || Object.keys(payload.errors).length > 0) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: payload.errors, correlationId }, { status: 422, headers: buildCorrelationHeaders(correlationId) });
  }

  const estimatedRows = await estimateExportSize(projectId, payload.dataset);
  const runAsync = shouldRunInBackground(estimatedRows);

  const job = await createExportJob({
    projectId,
    requestedByUserId: user?.id ?? null,
    dataset: payload.dataset,
    format: payload.format,
    filters: payload.filters
  });

  if (runAsync) {
    setTimeout(() => {
      void Promise.resolve(processExportJob(job.id)).catch((error) => {
        const message = error instanceof Error ? error.message : 'Unexpected export processing error.';
        recordFailure({ operation: 'export_job', projectId, correlationId, message, details: { jobId: job.id, dataset: payload.dataset } });
        logOperation('error', 'export.process_failed', { correlationId, projectId, jobId: job.id, message });
      });
    }, 0);

    logOperation('info', 'export.queued_background', { correlationId, projectId, jobId: job.id, estimatedRows, dataset: payload.dataset });
    return NextResponse.json(
      {
        correlationId,
        job: {
          id: job.id,
          status: job.status,
          format: job.format,
          estimatedRows,
          background: true,
          requestedAt: job.requestedAt
        }
      },
      { status: 202, headers: buildCorrelationHeaders(correlationId) }
    );
  }

  try {
    await processExportJob(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected export processing error.';
    recordFailure({ operation: 'export_job', projectId, correlationId, message, details: { jobId: job.id, dataset: payload.dataset } });
    logOperation('error', 'export.process_failed', { correlationId, projectId, jobId: job.id, message });
    return NextResponse.json({ error: 'export_failed', message, correlationId }, { status: 500, headers: buildCorrelationHeaders(correlationId) });
  }

  const freshJob = await prisma.exportJob.findUniqueOrThrow({ where: { id: job.id } });

  logOperation('info', 'export.completed', { correlationId, projectId, jobId: job.id, status: freshJob.status, dataset: payload.dataset });
  return NextResponse.json(
    {
      correlationId,
      job: {
        id: freshJob.id,
        status: freshJob.status,
        format: freshJob.format,
        estimatedRows,
        background: false,
        resultUrl: freshJob.resultUrl,
        requestedAt: freshJob.requestedAt,
        startedAt: freshJob.startedAt,
        finishedAt: freshJob.finishedAt
      }
    },
    { status: 201, headers: buildCorrelationHeaders(correlationId) }
  );
}
