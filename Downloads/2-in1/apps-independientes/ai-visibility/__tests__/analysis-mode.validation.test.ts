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
});
