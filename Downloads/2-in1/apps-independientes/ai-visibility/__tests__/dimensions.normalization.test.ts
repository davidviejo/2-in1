import { describe, expect, it } from 'vitest';

import { normalizeAnalysisMode, normalizeProvider, normalizeSurface } from '@/lib/reporting/dimensions';

describe('dimensions normalization aliases', () => {
  it('normalizes AI mode and AI overview aliases for DataForSEO workflows', () => {
    expect(normalizeAnalysisMode('Google AI Mode')).toBe('ai_mode');
    expect(normalizeAnalysisMode('google modo ia')).toBe('ai_mode');
    expect(normalizeAnalysisMode('AI Overviews')).toBe('ai_overview');
    expect(normalizeProvider('ai_overview')).toBe('dataforseo');
    expect(normalizeProvider('google ai mode')).toBe('dataforseo');
    expect(normalizeSurface('ai_mode')).toBe('google_ai_mode');
    expect(normalizeSurface('AI overviews')).toBe('google_ai_overview');
  });

  it('normalizes ChatGPT API and Gemini LLM aliases', () => {
    expect(normalizeProvider('chatgpt api')).toBe('openai');
    expect(normalizeSurface('chatgpt_api')).toBe('chatgpt');
    expect(normalizeProvider('gemini llm')).toBe('google');
    expect(normalizeSurface('gemini_llm')).toBe('gemini');
  });
});
