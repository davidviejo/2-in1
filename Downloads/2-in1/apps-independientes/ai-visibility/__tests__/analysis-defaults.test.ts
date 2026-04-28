import { describe, expect, it } from 'vitest';

import { resolveAnalysisDefaults, resolveLiveModel } from '@/lib/runs/analysis-defaults';

describe('analysis defaults', () => {
  it('returns canonical defaults for API-backed analysis modes', () => {
    expect(resolveAnalysisDefaults('chatgpt')).toEqual({
      provider: 'openai',
      surface: 'chatgpt',
      model: 'gpt-4.1-mini'
    });
    expect(resolveAnalysisDefaults('gemini')).toEqual({
      provider: 'google',
      surface: 'gemini',
      model: 'gemini-2.5-pro'
    });
    expect(resolveAnalysisDefaults('ai_mode')).toEqual({
      provider: 'dataforseo',
      surface: 'google_ai_mode',
      model: 'dataforseo-google-ai-mode'
    });
    expect(resolveAnalysisDefaults('ai_overview')).toEqual({
      provider: 'dataforseo',
      surface: 'google_ai_overview',
      model: 'dataforseo-google-ai-overview'
    });
  });

  it('uses requested model when provided and mode defaults when empty', () => {
    expect(resolveLiveModel('chatgpt', 'gpt-4.1')).toBe('gpt-4.1');
    expect(resolveLiveModel('ai_mode', '')).toBe('dataforseo-google-ai-mode');
    expect(resolveLiveModel('ai_overview', null)).toBe('dataforseo-google-ai-overview');
  });
});
