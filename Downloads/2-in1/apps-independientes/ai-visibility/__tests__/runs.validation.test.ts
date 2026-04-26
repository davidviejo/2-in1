import { describe, expect, it } from 'vitest';

import { parseRunListFilters, validateCreateRunInput, validateUpdateRunStatusInput } from '@/lib/runs/validation';

describe('run tracking validation', () => {
  it('accepts a valid create payload with traceability metadata', () => {
    const result = validateCreateRunInput({
      promptId: 'prompt_1',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      source: 'api',
      triggerType: 'manual',
      environment: 'staging',
      parserVersion: 'v1.2.3',
      rawRequestMetadata: { requestId: 'req_123', correlationId: 'corr_1' }
    });

    expect(result.values).toBeDefined();
    expect(result.values?.source).toBe('API');
    expect(result.values?.triggerType).toBe('MANUAL');
    expect(result.values?.rawRequestMetadata).toMatchObject({ requestId: 'req_123' });
  });

  it('requires explicit error message when FAILED', () => {
    const result = validateUpdateRunStatusInput({
      status: 'failed',
      completedAt: '2026-04-23T10:10:00.000Z'
    });

    expect(result.values).toBeUndefined();
    expect(result.errors?.errorMessage).toMatch(/requires errorMessage/i);
  });

  it('accepts a terminal SUCCEEDED status with completedAt', () => {
    const result = validateUpdateRunStatusInput({
      status: 'succeeded',
      startedAt: '2026-04-23T10:00:00.000Z',
      completedAt: '2026-04-23T10:10:00.000Z',
      response: {
        rawText: 'Original AI output',
        cleanedText: 'Original AI output',
        status: 'succeeded',
        language: 'en',
        mentionDetected: true,
        mentionType: 'own_brand',
        sentiment: 'positive'
      }
    });

    expect(result.values).toBeDefined();
    expect(result.values?.status).toBe('SUCCEEDED');
    expect(result.values?.completedAt?.toISOString()).toBe('2026-04-23T10:10:00.000Z');
    expect(result.values?.response?.mentionType).toBe('OWN_BRAND');
  });

  it('requires response payload for terminal statuses', () => {
    const result = validateUpdateRunStatusInput({
      status: 'canceled',
      completedAt: '2026-04-23T10:10:00.000Z'
    });

    expect(result.values).toBeUndefined();
    expect(result.errors?.response).toMatch(/require response/i);
  });

  it('parses list filters and validates paging', () => {
    const params = new URLSearchParams({
      status: 'running',
      source: 'ui',
      model: ' GPT-4.1-MINI ',
      page: '2',
      pageSize: '30',
      startedFrom: '2026-04-01T00:00:00.000Z',
      startedTo: '2026-04-22T00:00:00.000Z'
    });

    const result = parseRunListFilters('project_1', params);

    expect(result.values).toBeDefined();
    expect(result.values?.status).toBe('RUNNING');
    expect(result.values?.source).toBe('UI');
    expect(result.values?.model).toBe('gpt-4.1-mini');
    expect(result.values?.page).toBe(2);
    expect(result.values?.pageSize).toBe(30);
  });
});
