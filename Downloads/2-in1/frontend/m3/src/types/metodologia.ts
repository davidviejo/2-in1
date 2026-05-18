import type { LucideIcon } from 'lucide-react';

export type MetodologiaStatus = 'Completado' | 'En progreso' | 'Pendiente';

export type Module = {
  id: string;
  title: string;
  description: string;
  status: MetodologiaStatus;
  docs: number;
  links: number;
};

export type Phase = {
  id: string;
  title: string;
  description: string;
  objective: string;
  keyActions: string[];
  deliverables: string[];
  owner: string;
  status: MetodologiaStatus;
  icon: LucideIcon;
};

export type ResourceType = 'doc' | 'sheet' | 'chart' | 'notion' | 'pdf';

export type Resource = {
  id: string;
  title: string;
  meta: string;
  source: string;
  moduleId: string;
  description: string;
  lastUpdate: string;
  type: ResourceType;
  tags: string[];
};

export type KPI = {
  key: 'modules' | 'phases' | 'resources' | 'internal-links';
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
};
