import { describe, expect, it } from 'vitest';

import { normalizeAlias, validateAliasInput, validateCompetitorInput, validateProjectSettings } from '@/lib/projects/validation';

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

  it('normalizes competitor aliases and validates competitor payload', () => {
    const result = validateCompetitorInput({
      name: 'Globex',
      domain: 'Globex.com',
      aliases: [' Globex ', 'globex', 'Globex AI'],
      chartColor: '#00ff00',
      isActive: 'true'
    });

    expect(result.values).toBeDefined();
    expect(result.values?.domain).toBe('globex.com');
    expect(result.values?.aliases).toEqual(['Globex', 'globex', 'Globex AI']);
    expect(result.values?.isActive).toBe(true);
  });

  it('rejects competitor payload with invalid domain', () => {
    const result = validateCompetitorInput({
      name: 'Globex',
      domain: 'not domain',
      aliases: 'globex labs',
      chartColor: '#00ff00'
    });

    expect(result.errors?.domain).toMatch(/valid domain/i);
  });
});
