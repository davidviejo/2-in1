import { prisma } from '@/lib/db';
import {
  buildCitationsTableExport,
  buildCompetitorsComparisonExport,
  buildPromptsTableExport,
  buildResponsesTableExport,
  buildSummaryKpiPackExport
} from '@/lib/exports/datasets';
import type { ExportDataset, ExportFileFormat, ExportRequestFilters, ExportTable } from '@/lib/exports/types';

const LARGE_EXPORT_THRESHOLD = 1_000;

function toPrismaFormat(format: ExportFileFormat): 'CSV' | 'XLSX' {
  return format === 'xlsx' ? 'XLSX' : 'CSV';
}

export async function estimateExportSize(projectId: string, dataset: ExportDataset): Promise<number> {
  if (dataset === 'responses_table') {
    return prisma.response.count({ where: { run: { projectId } } });
  }

  if (dataset === 'citations_table') {
    return prisma.citation.count({ where: { response: { run: { projectId } } } });
  }

  return 1;
}

export function shouldRunInBackground(estimatedRows: number): boolean {
  return estimatedRows >= LARGE_EXPORT_THRESHOLD;
}

export async function createExportJob(input: {
  projectId: string;
  requestedByUserId: string | null;
  dataset: ExportDataset;
  format: ExportFileFormat;
  filters: ExportRequestFilters;
}) {
  return prisma.exportJob.create({
    data: {
      projectId: input.projectId,
      requestedByUserId: input.requestedByUserId,
      status: 'QUEUED',
      format: toPrismaFormat(input.format),
      filtersJson: {
        dataset: input.dataset,
        ...input.filters
      }
    }
  });
}

export async function setExportJobRunning(jobId: string) {
  return prisma.exportJob.update({
    where: { id: jobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date()
    }
  });
}

export async function setExportJobSucceeded(jobId: string, resultUrl: string) {
  return prisma.exportJob.update({
    where: { id: jobId },
    data: {
      status: 'SUCCEEDED',
      resultUrl,
      finishedAt: new Date()
    }
  });
}

export async function setExportJobFailed(jobId: string, message: string) {
  return prisma.exportJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorMessage: message.slice(0, 500),
      finishedAt: new Date()
    }
  });
}

export async function buildDatasetExport(
  dataset: ExportDataset,
  projectId: string,
  filters: ExportRequestFilters
): Promise<ExportTable> {
  if (dataset === 'summary_kpi_pack') {
    return buildSummaryKpiPackExport(projectId, filters);
  }

  if (dataset === 'prompts_table') {
    return buildPromptsTableExport(projectId, filters);
  }

  if (dataset === 'responses_table') {
    return buildResponsesTableExport(projectId);
  }

  if (dataset === 'citations_table') {
    return buildCitationsTableExport(projectId);
  }

  return buildCompetitorsComparisonExport(projectId, filters);
}

export async function processExportJob(jobId: string): Promise<void> {
  const job = await prisma.exportJob.findUnique({ where: { id: jobId } });

  if (!job) {
    return;
  }

  const filters = (job.filtersJson ?? {}) as Record<string, unknown>;
  const dataset = String(filters.dataset ?? '') as ExportDataset;

  await setExportJobRunning(jobId);

  try {
    await buildDatasetExport(dataset, job.projectId, filters as ExportRequestFilters);
    await setExportJobSucceeded(jobId, `/api/projects/${job.projectId}/exports/${job.id}/download`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    await setExportJobFailed(jobId, message);
  }
}
