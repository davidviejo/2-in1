import { describe, expect, it } from 'vitest';
import { normalizeSeoUrl, normalizeSeoPageInput } from './seoUrlNormalizer';

describe('seoUrlNormalizer', () => {
  it('adds https when the URL has no protocol', () => {
    expect(normalizeSeoUrl('example.com/path')).toBe('https://example.com/path');
  });

  it('keeps existing protocols untouched', () => {
    expect(normalizeSeoUrl('http://example.com')).toBe('http://example.com');
  });

  it('normalizes page-like inputs without mutating other properties', () => {
    expect(
      normalizeSeoPageInput({
        id: '1',
        url: ' example.com ',
        kwPrincipal: 'seo',
      }),
    ).toEqual({
      id: '1',
      url: 'https://example.com',
      kwPrincipal: 'seo',
    });
  });
});
