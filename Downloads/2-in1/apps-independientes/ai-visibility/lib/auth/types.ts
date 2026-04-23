export const roles = ['admin', 'editor', 'viewer'] as const;

export type Role = (typeof roles)[number];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  projectIds?: string[];
};

export type ProjectAccessInput = {
  projectId: string;
  requiredRole?: Role;
};
