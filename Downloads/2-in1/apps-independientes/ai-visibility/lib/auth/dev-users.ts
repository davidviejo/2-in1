import { Role, SessionUser } from '@/lib/auth/types';

type DevUserSeed = SessionUser & {
  password: string;
};

const seededUsers: DevUserSeed[] = [
  {
    id: 'dev-admin',
    email: 'admin@internal.local',
    name: 'Dev Admin',
    password: 'admin123',
    role: 'admin',
    projectIds: ['default-project', 'growth-project']
  },
  {
    id: 'dev-editor',
    email: 'editor@internal.local',
    name: 'Dev Editor',
    password: 'editor123',
    role: 'editor',
    projectIds: ['default-project']
  },
  {
    id: 'dev-viewer',
    email: 'viewer@internal.local',
    name: 'Dev Viewer',
    password: 'viewer123',
    role: 'viewer',
    projectIds: ['default-project']
  }
];

export function getSeededDevUsers(): DevUserSeed[] {
  return seededUsers;
}

export function findSeededUserByCredentials(email: string, password: string): DevUserSeed | null {
  const normalizedEmail = email.trim().toLowerCase();

  return (
    seededUsers.find((user) => user.email.toLowerCase() === normalizedEmail && user.password === password) ??
    null
  );
}

export function withoutPassword(user: DevUserSeed): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    projectIds: user.projectIds
  };
}

export function isRole(value: string): value is Role {
  return value === 'admin' || value === 'editor' || value === 'viewer';
}
