import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { ensureDbUser } from '@/lib/auth/db-user';
import { getRequestUser } from '@/lib/auth/session';
import {
  commitHistoricalImport,
  type HistoricalImportPayload,
  previewHistoricalImport
} from '@/lib/imports/historical';

import { recordFailure } from '@/lib/observability/failures';
import { buildCorrelationHeaders, getCorrelationIdFromHeaders, logOperation } from '@/lib/observability/logging';

function canWriteProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId }) && hasRole(user, 'editor');
}

function validatePayload(payload: unknown): { values?: HistoricalImportPayload & { mode: 'preview' | 'commit' }; errors?: Record<string, string> } {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};

  const modeRaw = typeof body.mode === 'string' ? body.mode : '';
  const mode = modeRaw === 'preview' || modeRaw === 'commit' ? modeRaw : '';
  const fileContent = typeof body.fileContent === 'string' ? body.fileContent : '';
  const fileType = typeof body.fileType === 'string' ? body.fileType.toLowerCase() : '';
  const mapping = body.mapping && typeof body.mapping === 'object' ? (body.mapping as Record<string, unknown>) : {};

  if (mode !== 'preview' && mode !== 'commit') {
    errors.mode = 'mode must be preview or commit.';
  }

  if (!fileContent.trim()) {
    errors.fileContent = 'fileContent is required.';
  }

  if (fileType !== 'csv' && fileType !== 'json') {
    errors.fileType = 'fileType must be csv or json.';
  }

  const promptColumn = typeof mapping.promptColumn === 'string' ? mapping.promptColumn.trim() : '';
  const modelColumn = typeof mapping.modelColumn === 'string' ? mapping.modelColumn.trim() : '';
  const responseColumn = typeof mapping.responseColumn === 'string' ? mapping.responseColumn.trim() : '';

  if (!promptColumn) {
    errors.promptColumn = 'prompt column mapping is required.';
  }

  if (!modelColumn) {
    errors.modelColumn = 'model column mapping is required.';
  }

  if (!responseColumn) {
    errors.responseColumn = 'response column mapping is required.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      mode: mode as 'preview' | 'commit',
      fileContent,
      fileType: fileType as 'csv' | 'json',
      mapping: {
        projectColumn: typeof mapping.projectColumn === 'string' && mapping.projectColumn.trim() ? mapping.projectColumn.trim() : null,
        promptColumn,
        modelColumn,
        responseColumn,
        citationsColumn: typeof mapping.citationsColumn === 'string' && mapping.citationsColumn.trim() ? mapping.citationsColumn.trim() : null
      }
    }
  };
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

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: buildCorrelationHeaders(correlationId) });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const validation = validatePayload(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors, correlationId }, { status: 422, headers: buildCorrelationHeaders(correlationId) });
  }

  try {
    if (validation.values.mode === 'preview') {
      const preview = await previewHistoricalImport(projectId, validation.values);
      logOperation('info', 'historical_import.preview_completed', { correlationId, projectId, validRows: preview.validRows, totalRows: preview.totalRows, issues: preview.issues.length });
      return NextResponse.json({ preview, correlationId }, { headers: buildCorrelationHeaders(correlationId) });
    }

    const user = getRequestUser(request);
    const dbUser = user ? await ensureDbUser(user) : null;
    const committed = await commitHistoricalImport(projectId, dbUser?.id ?? null, validation.values);

    if (committed.issues.length > 0) {
      recordFailure({ operation: 'historical_import', projectId, correlationId, message: 'Historical import validation failed.', details: { issues: committed.issues.length } });
      return NextResponse.json({ error: 'validation_failed', preview: committed, correlationId }, { status: 422, headers: buildCorrelationHeaders(correlationId) });
    }

    logOperation('info', 'historical_import.committed', { correlationId, projectId, rows: committed.validRows, citations: committed.citationCount });
    return NextResponse.json({ committed, correlationId }, { status: 201, headers: buildCorrelationHeaders(correlationId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected import error.';
    recordFailure({ operation: 'historical_import', projectId, correlationId, message, details: { stage: validation.values.mode } });
    logOperation('error', 'historical_import.failed', { correlationId, projectId, message });
    return NextResponse.json(
      {
        error: 'import_failed',
        message,
        correlationId
      },
      { status: 400, headers: buildCorrelationHeaders(correlationId) }
    );
  }
}
