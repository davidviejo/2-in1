import { ProjectAccessInput, Role, SessionUser } from '@/lib/auth/types';

const roleWeight: Record<Role, number> = {
  viewer: 1,
  editor: 2,
  admin: 3
};

export function hasRole(user: SessionUser, requiredRole: Role): boolean {
  return roleWeight[user.role] >= roleWeight[requiredRole];
}

export function requireRole(user: SessionUser, requiredRole: Role): void {
  if (!hasRole(user, requiredRole)) {
    throw new Error(`Role ${requiredRole} required`);
  }
}

export function canAccessProject(user: SessionUser, input: ProjectAccessInput): boolean {
  if (input.requiredRole && !hasRole(user, input.requiredRole)) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (!user.projectIds || user.projectIds.length === 0) {
    return true;
  }

  return user.projectIds.includes(input.projectId);
}

export function requireProjectAccess(user: SessionUser, input: ProjectAccessInput): void {
  if (!canAccessProject(user, input)) {
    throw new Error('Project access denied');
  }
}
