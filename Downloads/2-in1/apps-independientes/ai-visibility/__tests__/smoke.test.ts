import { describe, expect, it } from 'vitest';

import { navItems } from '@/lib/navigation';

describe('smoke checks', () => {
  it('has at least one navigation item', () => {
    expect(navItems.length).toBeGreaterThan(0);
  });

  it('keeps unique navigation paths', () => {
    const paths = navItems.map((item) => item.href);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
