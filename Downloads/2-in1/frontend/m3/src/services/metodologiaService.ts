export type StatusType = 'Completado' | 'En progreso' | 'Pendiente';

export interface ModuleItem {
  id: string;
  title: string;
  description: string;
  status: StatusType;
  docs: number;
  links: number;
}

export interface PhaseItem {
  title: string;
  desc: string;
  deliverables: string[];
  status: StatusType;
}

export interface ResourceItem {
  type: string;
  title: string;
  module: string;
  description: string;
  meta: string;
}

const delay = async () => new Promise((resolve) => setTimeout(resolve, 120));

export const metodologiaService = {
  async updateModule(module: ModuleItem): Promise<ModuleItem> {
    await delay();
    return module;
  },
  async updatePhase(phase: PhaseItem): Promise<PhaseItem> {
    await delay();
    return phase;
  },
  async updateResource(resource: ResourceItem): Promise<ResourceItem> {
    await delay();
    return resource;
  },
};
