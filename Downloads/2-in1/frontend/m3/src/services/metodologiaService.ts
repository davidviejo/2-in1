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

export interface CreateMethodologyResourceInput {
  type: ResourceType;
  title: string;
  moduleId: string;
  description: string;
  status: MethodologyStatus;
  linksDocs: string;
  metadata: string;
}

export interface CreateMethodologyModuleInput {
  id: string;
  title: string;
  description: string;
  status: MethodologyStatus;
}

const STORAGE_KEYS = {
  modules: 'metodologia.modules',
  resources: 'metodologia.resources',
};

const isBrowser = typeof window !== 'undefined';

const readStore = <T>(key: string): T[] => {
  if (!isBrowser) return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const writeStore = <T>(key: string, items: T[]): void => {
  if (!isBrowser) return;
  window.localStorage.setItem(key, JSON.stringify(items));
};

export const metodologiaService = {
  async createModule(input: CreateMethodologyModuleInput): Promise<MethodologyModule> {
    const created: MethodologyModule = {
      ...input,
      docs: 0,
      links: 0,
    };
    const modules = readStore<MethodologyModule>(STORAGE_KEYS.modules);
    writeStore(STORAGE_KEYS.modules, [created, ...modules.filter((item) => item.id !== created.id)]);
    return created;
  },

  async createResource(input: CreateMethodologyResourceInput): Promise<MethodologyResource> {
    const created: MethodologyResource = {
      title: input.title,
      meta: `${input.status} · ${input.linksDocs} · ${input.metadata}`,
      type: input.type,
      moduleId: input.moduleId,
      description: input.description,
    };
    const resources = readStore<MethodologyResource>(STORAGE_KEYS.resources);
    writeStore(STORAGE_KEYS.resources, [created, ...resources.filter((item) => item.title !== created.title)]);
    return created;
  },

  async updateModule(module: MethodologyModule): Promise<MethodologyModule> {
    const modules = readStore<MethodologyModule>(STORAGE_KEYS.modules);
    writeStore(STORAGE_KEYS.modules, [module, ...modules.filter((item) => item.id !== module.id)]);
    return module;
  },

  async updatePhase(phase: MethodologyPhase): Promise<MethodologyPhase> {
    return Promise.resolve(phase);
  },

  async updateResource(resource: MethodologyResource): Promise<MethodologyResource> {
    const resources = readStore<MethodologyResource>(STORAGE_KEYS.resources);
    writeStore(STORAGE_KEYS.resources, [resource, ...resources.filter((item) => item.title !== resource.title)]);
    return resource;
  },
};
