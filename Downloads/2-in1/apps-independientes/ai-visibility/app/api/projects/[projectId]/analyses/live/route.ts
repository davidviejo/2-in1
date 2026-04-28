import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { ensureDbUser } from '@/lib/auth/db-user';
import { getRequestUser } from '@/lib/auth/session';
import { resolveAnalysisDefaults, resolveLiveModel } from '@/lib/runs/analysis-defaults';
import { executeLiveAnalysis } from '@/lib/runs/live-analysis';
import { normalizeAnalysisMode } from '@/lib/reporting/dimensions';
import { validateCreateRunInput } from '@/lib/runs/validation';

function canWriteProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId }) && hasRole(user, 'editor');
}

function enrichPayload(input: Record<string, unknown>) {
  const analysisMode = normalizeAnalysisMode(typeof input.analysisMode === 'string' ? input.analysisMode : '') ?? '';
  const defaults = resolveAnalysisDefaults(analysisMode);
  return {
    provider: defaults.provider,
    surface: defaults.surface,
    model: resolveLiveModel(analysisMode, input.model)
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

  const payload = ((await request.json()) ?? {}) as Record<string, unknown>;
  const defaults = enrichPayload(payload);

  const validation = validateCreateRunInput({
    ...payload,
    provider: defaults.provider,
    surface: defaults.surface,
    model: defaults.model,
    source: 'API',
    triggerType: 'MANUAL',
    captureMethod: 'api',
    rawRequestMetadata: {
      ...(payload.rawRequestMetadata && typeof payload.rawRequestMetadata === 'object' ? payload.rawRequestMetadata : {}),
      collectionChannel: 'live_analysis_api',
      collectionProvider: defaults.provider,
      collectionSurface: defaults.surface
    }
  });

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  const user = getRequestUser(request);
  const dbUser = user ? await ensureDbUser(user) : null;

  const result = await executeLiveAnalysis({
    projectId,
    userId: dbUser?.id ?? null,
    payload: validation.values
  });

  if ('error' in result && result.error === 'prompt_not_found') {
    return NextResponse.json({ error: 'prompt_not_found' }, { status: 404 });
  }

  if (result.status === 'FAILED') {
    return NextResponse.json({ error: 'analysis_failed', runId: result.runId, message: result.errorMessage }, { status: 502 });
  }

  return NextResponse.json({ runId: result.runId, status: result.status }, { status: 201 });
}
