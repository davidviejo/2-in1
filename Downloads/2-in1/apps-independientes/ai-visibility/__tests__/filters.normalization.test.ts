import { describe, expect, it } from 'vitest';

import { normalizeCountry, normalizeLanguage, normalizeModelLabel, normalizeSearchTerm, parseDateRange, safeTrim, splitSearchTokens } from '@/lib/filters/normalization';

describe('shared normalization helpers', () => {
  it('normalizes country and language formats', () => {
    expect(normalizeCountry(' us ')).toBe('US');
    expect(normalizeCountry('usa')).toBeUndefined();

    expect(normalizeLanguage(' ES-mx ')).toBe('es-mx');
    expect(normalizeLanguage('spanish')).toBeUndefined();
  });

  it('normalizes model labels consistently', () => {
    expect(normalizeModelLabel(' GPT-4.1-MINI ')).toBe('gpt-4.1-mini');
    expect(normalizeModelLabel('')).toBeUndefined();
  });

  it('parses and validates date ranges', () => {
    const ok = parseDateRange('2026-04-01T00:00:00.000Z', '2026-04-20T00:00:00.000Z');
    expect(ok.from?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(ok.to?.toISOString()).toBe('2026-04-20T00:00:00.000Z');
    expect(ok.errors).toBeUndefined();

    const invalid = parseDateRange('bad-date', '2026-04-20T00:00:00.000Z');
    expect(invalid.errors?.from).toMatch(/valid date/i);

    const reversed = parseDateRange('2026-04-21T00:00:00.000Z', '2026-04-20T00:00:00.000Z');
    expect(reversed.errors?.range).toMatch(/before/i);
  });

  it('trims safely and creates deterministic search tokens', () => {
    expect(safeTrim('   Hello   world   ')).toBe('Hello   world');
    expect(normalizeSearchTerm('  too    many   spaces  ')).toBe('too many spaces');
    expect(splitSearchTokens(' AI   visibility ai  filters ')).toEqual(['ai', 'visibility', 'filters']);
  });
});
