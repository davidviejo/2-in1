import { describe, expect, it } from 'vitest';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { findSeededUserByCredentials, withoutPassword } from '@/lib/auth/dev-users';

describe('auth primitives', () => {
  it('loads seeded users by credentials', () => {
    const user = findSeededUserByCredentials('admin@internal.local', 'admin123');
    expect(user?.role).toBe('admin');
  });

  it('supports reusable role checks', () => {
    const editor = findSeededUserByCredentials('editor@internal.local', 'editor123');
    expect(editor).toBeTruthy();

    const safeEditor = withoutPassword(editor!);

    expect(hasRole(safeEditor, 'viewer')).toBe(true);
    expect(hasRole(safeEditor, 'editor')).toBe(true);
    expect(hasRole(safeEditor, 'admin')).toBe(false);
  });

  it('applies project-level access guard shape', () => {
    const viewer = findSeededUserByCredentials('viewer@internal.local', 'viewer123');
    expect(viewer).toBeTruthy();

    const safeViewer = withoutPassword(viewer!);

    expect(canAccessProject(safeViewer, { projectId: 'default-project' })).toBe(true);
    expect(canAccessProject(safeViewer, { projectId: 'growth-project' })).toBe(false);
  });
});
