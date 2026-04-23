import { describe, expect, it } from 'vitest';

import {
  normalizeAlias,
  normalizeTagName,
  validateAliasInput,
  validateCompetitorInput,
  validateProjectSettings,
  validatePromptInput,
  validateTagInput
} from '@/lib/projects/validation';

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

  it('normalizes tag names and accepts optional descriptions', () => {
    const result = validateTagInput({
      name: '  Editorial   Ideas ',
      description: 'Useful prompts'
    });

    expect(result.values?.name).toBe('Editorial   Ideas');
    expect(result.values?.normalizedName).toBe('editorial ideas');
    expect(normalizeTagName('  BRAND   Mix ')).toBe('brand mix');
  });

  it('rejects invalid tag payload', () => {
    const result = validateTagInput({ name: '', description: 'x'.repeat(241) });
    expect(result.errors?.name).toMatch(/required/i);
    expect(result.errors?.description).toMatch(/240/i);
  });

  it('validates prompt payload with multiple tags', () => {
    const result = validatePromptInput({
      title: 'Track LLM ranking for homepage',
      promptText: 'How visible is Acme in AI overviews?',
      objective: 'Weekly visibility check',
      language: 'es-mx',
      status: 'active',
      tagIds: ['tag1', 'tag2', 'tag1']
    });

    expect(result.values).toBeDefined();
    expect(result.values?.status).toBe('ACTIVE');
    expect(result.values?.tagIds).toEqual(['tag1', 'tag2']);
  });

  it('rejects invalid prompt status', () => {
    const result = validatePromptInput({
      title: 'Bad status',
      promptText: 'Prompt text',
      status: 'invalid'
    });

    expect(result.errors?.status).toMatch(/must be one of/i);
  });
});
