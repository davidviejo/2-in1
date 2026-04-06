import { describe, expect, it } from 'vitest';
import { getVisibleSelectedGscSite } from './Dashboard';

describe('getVisibleSelectedGscSite', () => {
  it('returns the selected site when it is still present in the filtered list', () => {
    expect(
      getVisibleSelectedGscSite('sc-domain:example.com', [
        { siteUrl: 'sc-domain:example.com' },
        { siteUrl: 'sc-domain:example.org' },
      ]),
    ).toBe('sc-domain:example.com');
  });

  it('returns an empty value when the selected site is not present in the filtered list', () => {
    expect(
      getVisibleSelectedGscSite('sc-domain:example.com', [
        { siteUrl: 'sc-domain:example.org' },
      ]),
    ).toBe('');
  });
});
