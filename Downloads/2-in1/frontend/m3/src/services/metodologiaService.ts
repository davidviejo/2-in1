export const RESOURCE_TYPES = ['doc', 'sheet', 'chart', 'link', 'pdf'] as const;
export const RESOURCE_STATUSES = ['Completado', 'En progreso', 'Pendiente'] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export interface ResourceLink {
  label: string;
  url: string;
}

export interface ResourceMetadata {
  author: string;
  version: string;
  updatedAt: string;
}

export interface MetodologiaResource {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  type: ResourceType;
  status: ResourceStatus;
  links: ResourceLink[];
  metadata: ResourceMetadata;
  source: 'system' | 'user';
}

export interface CreateResourceInput {
  title: string;
  description: string;
  moduleId: string;
  type: ResourceType;
  status: ResourceStatus;
  links: ResourceLink[];
  metadata: ResourceMetadata;
}

export interface MetodologiaModule {
  id: string;
  title: string;
  description: string;
  status: ResourceStatus;
  docs: number;
  links: number;
}

export interface CreateModuleInput {
  title: string;
  description: string;
  status: ResourceStatus;
}

const STORAGE_KEYS = {
  resources: 'metodologia:user-resources:v1',
  modules: 'metodologia:user-modules:v1',
} as const;

const withStorageFallback = <T,>(fallback: T, read: () => T): T => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

const readJSON = <T,>(key: string, fallback: T): T => withStorageFallback(fallback, () => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
});

const writeJSON = <T,>(key: string, value: T): void => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

const nowISO = () => new Date().toISOString();

export const metodologiaService = {
  listResources(): MetodologiaResource[] {
    return readJSON<MetodologiaResource[]>(STORAGE_KEYS.resources, []);
  },

  listModules(): MetodologiaModule[] {
    return readJSON<MetodologiaModule[]>(STORAGE_KEYS.modules, []);
  },

  async createResource(input: CreateResourceInput): Promise<MetodologiaResource> {
    const resource: MetodologiaResource = {
      ...input,
      id: `usr-res-${Math.random().toString(36).slice(2, 10)}`,
      source: 'user',
      metadata: {
        ...input.metadata,
        updatedAt: input.metadata.updatedAt || nowISO(),
      },
    };
    const current = this.listResources();
    writeJSON(STORAGE_KEYS.resources, [resource, ...current]);
    return resource;
  },

  async createModule(input: CreateModuleInput): Promise<MetodologiaModule> {
    const current = this.listModules();
    const module: MetodologiaModule = {
      ...input,
      id: `M${current.length + 9}`,
      docs: 0,
      links: 0,
    };
    writeJSON(STORAGE_KEYS.modules, [module, ...current]);
    return module;
  },
};
