import { describe, expect, it } from 'vitest';

import { validateCreateRunInput } from '@/lib/runs/validation';

describe('analysis mode validation', () => {
  it('accepts supported analysis modes', () => {
    const payload = {
      promptId: 'p1',
      provider: 'google',
      surface: 'google_search',
      analysisMode: 'ai_overview',
      model: 'unknown',
      captureMethod: 'browser_capture',
      source: 'API',
      triggerType: 'MANUAL'
    };

    expect(validateCreateRunInput(payload).values?.analysisMode).toBe('ai_overview');
  });

  it('rejects invalid analysis mode', () => {
    const payload = {
      promptId: 'p1',
      provider: 'google',
      surface: 'google_search',
      analysisMode: 'gemini_overview',
      model: 'unknown',
      captureMethod: 'browser_capture',
      source: 'API',
      triggerType: 'MANUAL'
    };

    expect(validateCreateRunInput(payload).errors?.analysisMode).toContain('analysisMode is required');
  });

  it('accepts dataforseo provider and google ai surfaces for ai mode/overview', () => {
    const payload = {
      promptId: 'p1',
      provider: 'dataforseo',
      surface: 'google ai overview',
      analysisMode: 'AI Overviews',
      model: 'dataforseo-google-ai-overview',
      captureMethod: 'api',
      source: 'API',
      triggerType: 'MANUAL'
    };

    const result = validateCreateRunInput(payload);
    expect(result.values?.analysisMode).toBe('ai_overview');
    expect(result.values?.provider).toBe('dataforseo');
    expect(result.values?.surface).toBe('google_ai_overview');
  });
});
