export type MethodologyStatus = 'Completado' | 'En progreso' | 'Pendiente';

export type ResourceType = 'doc' | 'sheet' | 'chart';

export interface Module {
  id: string;
  title: string;
  description: string;
  status: MethodologyStatus;
  docs: number;
  links: number;
  order: number;
}

export interface Phase {
  title: string;
  desc: string;
  status: MethodologyStatus;
  deliverables: string[];
  order: number;
}

export interface Resource {
  title: string;
  meta: string;
  type: ResourceType;
  moduleId: string;
  description: string;
  status?: MethodologyStatus;
  links?: string[];
  docs?: number;
  metadata?: string;
}

export interface KPI {
  label: string;
  value: string;
  subtitle: string;
}
