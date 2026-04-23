import { describe, expect, it } from 'vitest';

import { navItems } from '@/lib/navigation';

describe('navigation scaffold', () => {
  it('contains all shell routes', () => {
    expect(navItems.map((item) => item.label)).toEqual([
      'Overview',
      'Prompts',
      'Responses',
      'Citations',
      'Competitors',
      'Tags',
      'Settings'
    ]);
  });
});
