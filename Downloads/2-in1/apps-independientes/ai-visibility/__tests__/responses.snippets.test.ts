import { describe, expect, it } from 'vitest';

import { buildDisplaySnippet, normalizeResponseText } from '@/lib/responses/snippets';

describe('response snippet utilities', () => {
  it('normalizes controls and repeated whitespace', () => {
    expect(normalizeResponseText('hola\u0007   mundo\n\n desde\tAI')).toBe('hola mundo desde AI');
  });

  it('builds capped snippets for list displays', () => {
    expect(buildDisplaySnippet('0123456789', 7)).toBe('012345…');
  });
});
