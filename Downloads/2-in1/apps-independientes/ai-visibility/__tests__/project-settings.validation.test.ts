import { describe, expect, it } from 'vitest';

import { normalizeAlias, validateAliasInput, validateProjectSettings } from '@/lib/projects/validation';

describe('project settings validation', () => {
  it('accepts valid project payload', () => {
    const result = validateProjectSettings({
      name: 'Acme US',
      primaryDomain: 'acme.com',
      description: 'desc',
      mainCountry: 'us',
      mainLanguage: 'en',
      isActive: true,
      chartColor: '#123abc',
      notes: 'notes'
    });

    expect(result.values).toBeDefined();
    expect(result.values?.mainCountry).toBe('US');
  });

  it('rejects invalid domain', () => {
    const result = validateProjectSettings({
      name: 'Acme US',
      primaryDomain: 'bad domain',
      mainCountry: 'US',
      mainLanguage: 'en',
      chartColor: '#123abc'
    });

    expect(result.errors?.primaryDomain).toMatch(/valid domain/i);
  });

  it('normalizes aliases to prevent duplicates', () => {
    expect(normalizeAlias('  ACME   Brand ')).toBe('acme brand');
    const first = validateAliasInput('Acme Brand');
    const duplicate = validateAliasInput(' acme   brand ');

    expect(first.normalizedAlias).toBe(duplicate.normalizedAlias);
  });
});
