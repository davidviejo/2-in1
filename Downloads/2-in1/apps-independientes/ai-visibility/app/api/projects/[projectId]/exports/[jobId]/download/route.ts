import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { buildDatasetExport } from '@/lib/exports/jobs';
import { buildCsvBuffer, buildXlsxBuffer } from '@/lib/exports/serializers';
import type { ExportDataset, ExportRequestFilters } from '@/lib/exports/types';

function canReadProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);
  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
      jobId: string;
    };
  }
) {
  const { projectId, jobId } = context.params;

  if (!canReadProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const job = await prisma.exportJob.findFirst({
    where: {
      id: jobId,
      projectId
    }
  });

  if (!job) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (job.status !== 'SUCCEEDED') {
    return NextResponse.json({ error: 'job_not_ready', status: job.status }, { status: 409 });
  }

  const filters = (job.filtersJson ?? {}) as Record<string, unknown>;
  const dataset = String(filters.dataset ?? '') as ExportDataset;
  const table = await buildDatasetExport(dataset, projectId, filters as ExportRequestFilters);

  const isXlsx = job.format === 'XLSX';
  const buffer = isXlsx ? buildXlsxBuffer(table) : buildCsvBuffer(table);
  const extension = isXlsx ? 'xlsx' : 'csv';

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': isXlsx
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${table.suggestedFilename}.${extension}"`,
      'Cache-Control': 'no-store'
    }
  });
}
