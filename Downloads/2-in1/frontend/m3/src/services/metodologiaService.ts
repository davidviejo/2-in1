export type MethodologyStatus = 'Completado' | 'En progreso' | 'Pendiente';

export interface MethodologyModule {
  id: string;
  title: string;
  description: string;
  status: MethodologyStatus;
  docs: number;
  links: number;
}

export interface MethodologyPhase {
  title: string;
  desc: string;
  status: MethodologyStatus;
  deliverables: string[];
}

export type ResourceType = 'doc' | 'sheet' | 'chart';

export interface MethodologyResource {
  title: string;
  meta: string;
  type: ResourceType;
  moduleId: string;
  description: string;
}

export const metodologiaService = {
  async updateModule(module: MethodologyModule): Promise<MethodologyModule> {
    return Promise.resolve(module);
  },

  async updatePhase(phase: MethodologyPhase): Promise<MethodologyPhase> {
    return Promise.resolve(phase);
  },

  async updateResource(resource: MethodologyResource): Promise<MethodologyResource> {
    return Promise.resolve(resource);
  },
};
