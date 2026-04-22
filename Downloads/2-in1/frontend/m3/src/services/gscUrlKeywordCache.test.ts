import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCachedUrlKeywordEntry,
  getLatestGscUrlKeywordCache,
  persistGscUrlKeywordCache,
} from './gscUrlKeywordCache';

describe('gscUrlKeywordCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persiste y recupera cache por propiedad', () => {
    persistGscUrlKeywordCache('sc-domain:example.com', '2026-03-01', '2026-03-31', [
      {
        keys: ['kw principal', 'https://example.com/url-a'],
        clicks: 12,
        impressions: 100,
        ctr: 0.12,
        position: 3.2,
      },
      {
        keys: ['kw secundaria', 'https://example.com/url-a'],
        clicks: 4,
        impressions: 80,
        ctr: 0.05,
        position: 5.8,
      },
    ]);

    const snapshot = getLatestGscUrlKeywordCache('sc-domain:example.com');
    expect(snapshot).toBeTruthy();
    expect(snapshot?.startDate).toBe('2026-03-01');
    expect(snapshot?.urls['https://example.com/url-a']?.queries).toHaveLength(2);
  });

  it('resuelve variante con barra final', () => {
    persistGscUrlKeywordCache('sc-domain:example.com', '2026-03-01', '2026-03-31', [
      {
        keys: ['kw prueba', 'https://example.com/url-b/'],
        clicks: 8,
        impressions: 40,
        ctr: 0.2,
        position: 2.1,
      },
    ]);

    const snapshot = getLatestGscUrlKeywordCache('sc-domain:example.com');
    const entry = getCachedUrlKeywordEntry(snapshot, 'https://example.com/url-b');
    expect(entry?.queries[0]?.query).toBe('kw prueba');
    expect(entry?.metrics.clicks).toBe(8);
  });
});
