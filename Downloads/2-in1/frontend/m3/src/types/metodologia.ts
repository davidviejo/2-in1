export type MetodologiaStatus = 'Completado' | 'En progreso' | 'Pendiente';

export interface KPI {
  id: string;
  label: string;
  value: number;
  subtitle: string;
  icon: 'layers' | 'workflow' | 'bookOpen' | 'link2';
}

export interface Module {
  id: string;
  title: string;
  description: string;
  status: MetodologiaStatus;
  docs: number;
  links: number;
}

export interface Phase {
  id: string;
  title: string;
  desc: string;
  deliverables: string[];
  status: MetodologiaStatus;
  objective: string;
  actions: string;
  owner: string;
}

export type ResourceType = 'doc' | 'sheet' | 'chart' | 'notion' | 'pdf';

export interface Resource {
  id: string;
  source: string;
  title: string;
  moduleId: string;
  description: string;
  updatedAt: string;
  meta: string;
  type: ResourceType;
}
