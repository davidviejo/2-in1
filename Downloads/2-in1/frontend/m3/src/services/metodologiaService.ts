export type MethodologyStatus = 'Completado' | 'En progreso' | 'Pendiente';

export interface MethodologyModule {
  id: string;
  title: string;
  description: string;
  status: MethodologyStatus;
  docs: number;
  links: number;
  order: number;
}

export interface MethodologyPhase {
  title: string;
  desc: string;
  status: MethodologyStatus;
  deliverables: string[];
  order: number;
}

export type ResourceType = 'doc' | 'sheet' | 'chart';

export interface MethodologyResource {
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

export type CreateResourceInput = Pick<MethodologyResource, 'type' | 'title' | 'moduleId' | 'description' | 'meta'> & {
  status: MethodologyStatus;
  links: string[];
  docs: number;
  metadata: string;
};

export type CreateModuleInput = Pick<MethodologyModule, 'id' | 'title' | 'description' | 'status' | 'docs' | 'links'>;

const RESOURCE_STORAGE_KEY = 'metodologia:resources';
const MODULE_STORAGE_KEY = 'metodologia:modules';

const parseJsonArray = <T>(value: string | null): T[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readResources = () => parseJsonArray<MethodologyResource>(localStorage.getItem(RESOURCE_STORAGE_KEY));
const writeResources = (resources: MethodologyResource[]) => localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(resources));

const readModules = () => parseJsonArray<MethodologyModule>(localStorage.getItem(MODULE_STORAGE_KEY));
const writeModules = (modules: MethodologyModule[]) => localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(modules));

export const metodologiaService = {
  async createResource(input: CreateResourceInput): Promise<MethodologyResource> {
    const resource: MethodologyResource = {
      title: input.title.trim(),
      meta: input.meta.trim() || input.metadata.trim(),
      type: input.type,
      moduleId: input.moduleId,
      description: input.description.trim(),
      status: input.status,
      links: input.links,
      docs: input.docs,
      metadata: input.metadata.trim(),
    };

    const current = readResources();
    writeResources([resource, ...current]);
    return resource;
  },

  async createModule(input: CreateModuleInput): Promise<MethodologyModule> {
    const module: MethodologyModule = { ...input, title: input.title.trim(), description: input.description.trim(), id: input.id.trim() };
    const current = readModules();
    writeModules([module, ...current]);
    return module;
  },

  async updateModule(module: MethodologyModule): Promise<MethodologyModule> {
    return Promise.resolve(module);
  },

  async updatePhase(phase: MethodologyPhase): Promise<MethodologyPhase> {
    return Promise.resolve(phase);
  },

  async updateResource(resource: MethodologyResource): Promise<MethodologyResource> {
    return Promise.resolve(resource);
  },

  async reorderModules(modules: MethodologyModule[]): Promise<MethodologyModule[]> {
    return Promise.resolve(modules);
  },

  async reorderPhases(phases: MethodologyPhase[]): Promise<MethodologyPhase[]> {
    return Promise.resolve(phases);
  },
};
