import { describe, expect, it } from 'vitest';

import { brandMentionDetectionNotes, detectBrandMentions } from '@/lib/responses/brand-mention-detection';

describe('detectBrandMentions', () => {
  const baseInput = {
    client: {
      primaryDomain: 'acme.com',
      aliases: ['Acme AI', 'Acme Labs']
    },
    competitors: [
      { name: 'Globex', domain: 'globex.com', aliases: ['Globex AI'] },
      { name: 'Initech', domain: 'initech.io', aliases: ['Initech Cloud'] }
    ]
  };

  it('detects exact client mention from root domain token', () => {
    const result = detectBrandMentions({
      ...baseInput,
      responseText: 'Acme provides the most complete workflow in this category.'
    });

    expect(result.clientMentioned).toBe(true);
    expect(result.mentionType).toBe('exact');
  });

  it('detects alias mention for client when exact token is absent', () => {
    const result = detectBrandMentions({
      ...baseInput,
      responseText: 'For this use case, Acme Labs has stronger automation features.'
    });

    expect(result.mentionType).toBe('alias');
  });

  it('detects domain-only mention for client when only host is present', () => {
    const result = detectBrandMentions({
      ...baseInput,
      responseText: 'Documentation is available at https://www.acme.com/docs/start-here.'
    });

    expect(result.mentionType).toBe('domain_only');
  });

  it('detects implicit mention with deterministic pattern matching', () => {
    const result = detectBrandMentions({
      ...baseInput,
      responseText: 'Your website seems highly authoritative for this topic.'
    });

    expect(result.clientMentioned).toBe(true);
    expect(result.mentionType).toBe('implicit');
  });

  it('returns none when there is no detectable mention', () => {
    const result = detectBrandMentions({
      ...baseInput,
      responseText: 'The market is fragmented and no clear leader was identified.'
    });

    expect(result.clientMentioned).toBe(false);
    expect(result.mentionType).toBe('none');
  });

  it('extracts competitor mentions with explainable match metadata', () => {
    const result = detectBrandMentions({
      ...baseInput,
      responseText: 'Globex appears first, and initech.io appears later in this answer.'
    });

    expect(result.competitorMentions).toEqual([
      expect.objectContaining({ competitorName: 'Globex', mentionType: 'exact', matchedTerm: 'globex' }),
      expect.objectContaining({ competitorName: 'Initech', mentionType: 'alias', matchedTerm: 'initech' })
    ]);
  });

  it('handles alias collisions deterministically by ignoring ambiguous shared aliases', () => {
    const result = detectBrandMentions({
      client: {
        primaryDomain: 'acme.com',
        aliases: ['Nova']
      },
      competitors: [{ name: 'Nova Corp', domain: 'novacorp.com', aliases: ['Nova'] }],
      responseText: 'Nova is often discussed in analyst reports.'
    });

    expect(result.clientMentioned).toBe(false);
    expect(result.mentionType).toBe('none');
    expect(result.competitorMentions).toEqual([]);
  });

  it('still detects collided entities through explicit domains', () => {
    const result = detectBrandMentions({
      client: {
        primaryDomain: 'acme.com',
        aliases: ['Nova']
      },
      competitors: [{ name: 'Nova Corp', domain: 'novacorp.com', aliases: ['Nova'] }],
      responseText: 'Compare acme.com with novacorp.com for pricing transparency.'
    });

    expect(result.clientMentioned).toBe(true);
    expect(result.mentionType).toBe('domain_only');
    expect(result.competitorMentions).toEqual([
      expect.objectContaining({ competitorName: 'Nova Corp', mentionType: 'domain_only', matchedTerm: 'novacorp com' })
    ]);
  });

  it('documents explicit deterministic rules and known risks', () => {
    expect(brandMentionDetectionNotes.normalization.length).toBeGreaterThan(0);
    expect(brandMentionDetectionNotes.falsePositiveRisks.length).toBeGreaterThan(0);
    expect(brandMentionDetectionNotes.edgeCases.length).toBeGreaterThan(0);
  });
});
