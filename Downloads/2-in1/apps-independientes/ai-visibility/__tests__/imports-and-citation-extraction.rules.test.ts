import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {}
}));

import { previewHistoricalImport } from '@/lib/imports/historical';
import { extractAndNormalizeCitations } from '@/lib/responses/citations';

describe('import rule protections', () => {
  it('reports malformed import rows so regressions surface early', async () => {
    const preview = await previewHistoricalImport('project-1', {
      fileType: 'json',
      fileContent: JSON.stringify([{ projectId: 'project-1', prompt: 'P', model: 'gpt-4o', response: 'A', citations: '{bad json]' }]),
      mapping: {
        projectColumn: 'projectId',
        promptColumn: 'prompt',
        modelColumn: 'model',
        responseColumn: 'response',
        citationsColumn: 'citations'
      }
    });

    expect(preview.validRows).toBe(0);
    expect(preview.issues.some((issue) => issue.message.includes('malformed'))).toBe(true);
  });

  it('normalizes alias-like domain collisions and deduplicates duplicate citations', () => {
    const citations = extractAndNormalizeCitations({
      responseText: 'https://www.Example.com/a https://example.com/a https://sub.example.com/a',
      rawSources: [{ url: 'https://example.com/a' }, { domain: 'WWW.example.com' }]
    });

    expect(citations.filter((citation) => citation.url === 'https://example.com/a').length).toBe(1);
    expect(citations.some((citation) => citation.rootDomain === 'example.com')).toBe(true);
  });

  it('handles tricky subdomains and keeps empty-citation responses deterministic', () => {
    const withComplexDomains = extractAndNormalizeCitations({
      responseText: 'https://news.bbc.co.uk/story and https://portal.service.com.mx/landing'
    });
    const noCitations = extractAndNormalizeCitations({ responseText: 'No sources included.' });

    expect(withComplexDomains.map((citation) => citation.rootDomain)).toEqual(expect.arrayContaining(['bbc.co.uk', 'service.com.mx']));
    expect(noCitations).toEqual([]);
  });
});
