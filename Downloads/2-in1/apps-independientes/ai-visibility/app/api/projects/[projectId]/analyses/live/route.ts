import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { ensureDbUser } from '@/lib/auth/db-user';
import { getRequestUser } from '@/lib/auth/session';
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

  if (analysisMode === 'chatgpt') {
    return {
      provider: 'openai',
      surface: 'chatgpt',
      model: typeof input.model === 'string' ? input.model : process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4.1-mini'
    };
  }

  if (analysisMode === 'gemini') {
    return {
      provider: 'google',
      surface: 'gemini',
      model: typeof input.model === 'string' ? input.model : process.env.GEMINI_DEFAULT_MODEL ?? 'gemini-2.5-pro'
    };
  }

  return {
    provider: 'google',
    surface: 'google_search',
    model: 'unknown'
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
    captureMethod: 'api'
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
