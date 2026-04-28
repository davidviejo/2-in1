import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {}
}));

import { previewHistoricalImport } from '@/lib/imports/historical';

describe('historical import preview', () => {
  it('parses csv and reports zero issues for valid rows', async () => {
    const preview = await previewHistoricalImport('project-1', {
      fileType: 'csv',
      fileContent: 'project,prompt,model,response,citations\nproject-1,"Who is best?",gpt-4o,"Answer text","https://example.com/article"',
      mapping: {
        projectColumn: 'project',
        promptColumn: 'prompt',
        modelColumn: 'model',
        responseColumn: 'response',
        citationsColumn: 'citations'
      }
    });

    expect(preview.issues).toEqual([]);
    expect(preview.validRows).toBe(1);
    expect(preview.citationCount).toBe(1);
  });

  it('rejects invalid project and missing required values', async () => {
    const preview = await previewHistoricalImport('project-1', {
      fileType: 'json',
      fileContent: JSON.stringify([{ projectId: 'another', prompt: '', model: 'gpt', response: '' }]),
      mapping: {
        projectColumn: 'projectId',
        promptColumn: 'prompt',
        modelColumn: 'model',
        responseColumn: 'response',
        citationsColumn: null
      }
    });

    expect(preview.validRows).toBe(0);
    expect(preview.issues.some((issue) => issue.field === 'project')).toBe(true);
    expect(preview.issues.some((issue) => issue.field === 'prompt')).toBe(true);
    expect(preview.issues.some((issue) => issue.field === 'response')).toBe(true);
  });
});
