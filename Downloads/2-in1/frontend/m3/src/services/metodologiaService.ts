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
  status: MethodologyStatus;
  docs: number;
  links: string[];
  metadata: string;
}

export interface CreateModuleInput {
  id: string;
  title: string;
  description: string;
  status: MethodologyStatus;
}

export interface CreateResourceInput {
  title: string;
  type: ResourceType;
  moduleId: string;
  description: string;
  status: MethodologyStatus;
  docs: number;
  links: string[];
  metadata: string;
}

const STORAGE_KEYS = {
  modules: 'metodologia.modules',
  resources: 'metodologia.resources',
} as const;

const readFromStorage = <T,>(key: string): T[] => {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const writeToStorage = <T,>(key: string, data: T[]): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const metodologiaService = {
  async createModule(input: CreateModuleInput): Promise<MethodologyModule> {
    const created: MethodologyModule = { ...input, docs: 0, links: 0 };
    const current = readFromStorage<MethodologyModule>(STORAGE_KEYS.modules);
    writeToStorage(STORAGE_KEYS.modules, [created, ...current.filter((m) => m.id !== created.id)]);
    return created;
  },

  async createResource(input: CreateResourceInput): Promise<MethodologyResource> {
    const created: MethodologyResource = {
      ...input,
      meta: input.metadata || `Actualizado ${new Date().toLocaleDateString('es-ES')}`,
    };
    const current = readFromStorage<MethodologyResource>(STORAGE_KEYS.resources);
    writeToStorage(STORAGE_KEYS.resources, [created, ...current.filter((r) => r.title !== created.title)]);
    return created;
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
};
