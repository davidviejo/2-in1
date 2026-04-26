import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import {
  commitHistoricalImport,
  type HistoricalImportPayload,
  previewHistoricalImport
} from '@/lib/imports/historical';

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

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const validation = validatePayload(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  try {
    if (validation.values.mode === 'preview') {
      const preview = await previewHistoricalImport(projectId, validation.values);
      return NextResponse.json({ preview });
    }

    const user = getRequestUser(request);
    const committed = await commitHistoricalImport(projectId, user?.id ?? null, validation.values);

    if (committed.issues.length > 0) {
      return NextResponse.json({ error: 'validation_failed', preview: committed }, { status: 422 });
    }

    return NextResponse.json({ committed }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'import_failed',
        message: error instanceof Error ? error.message : 'Unexpected import error.'
      },
      { status: 400 }
    );
  }
}
