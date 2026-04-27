import { describe, expect, it, vi } from 'vitest';

const { mockUpsert } = vi.hoisted(() => ({
  mockUpsert: vi.fn()
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      upsert: mockUpsert
    }
  }
}));

import { ensureDbUser } from '@/lib/auth/db-user';

describe('ensureDbUser', () => {
  it('upserts by normalized email and returns db id', async () => {
    mockUpsert.mockResolvedValue({ id: 'db_user_1' });

    const result = await ensureDbUser({
      id: 'dev-admin',
      email: 'Admin@Internal.Local',
      name: 'Dev Admin',
      role: 'admin'
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { email: 'admin@internal.local' },
      update: { name: 'Dev Admin', isActive: true },
      create: { email: 'admin@internal.local', name: 'Dev Admin', isActive: true },
      select: { id: true }
    });
    expect(result).toEqual({ id: 'db_user_1' });
  });
});
