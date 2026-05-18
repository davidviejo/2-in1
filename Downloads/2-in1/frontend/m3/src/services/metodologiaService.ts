export type ResourceType = 'doc' | 'sheet' | 'chart' | 'link' | 'pdf';
export type ResourceStatus = 'Borrador' | 'En revisión' | 'Publicado';

export interface MethodologyResource {
  id: string;
  type: ResourceType;
  title: string;
  moduleId: string;
  description: string;
  status: ResourceStatus;
  linksDocs: string;
  metadata: string;
  meta: string;
  createdAt: string;
}

export interface MethodologyModule {
  id: string;
  title: string;
  description: string;
}

export interface CreateResourceInput {
  type: ResourceType;
  title: string;
  moduleId: string;
  description: string;
  status: ResourceStatus;
  linksDocs: string;
  metadata: string;
}

export interface CreateModuleInput {
  id: string;
  title: string;
  description: string;
}

const RESOURCES_STORAGE_KEY = 'metodologia_resources_v1';
const MODULES_STORAGE_KEY = 'metodologia_modules_v1';

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const persistJson = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const metodologiaService = {
  async listResources(): Promise<MethodologyResource[]> {
    return readJson<MethodologyResource[]>(RESOURCES_STORAGE_KEY, []);
  },
  async listModules(): Promise<MethodologyModule[]> {
    return readJson<MethodologyModule[]>(MODULES_STORAGE_KEY, []);
  },
  async createResource(payload: CreateResourceInput): Promise<MethodologyResource> {
    const item: MethodologyResource = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...payload,
      meta: `${payload.status} · ${payload.moduleId}`,
      createdAt: new Date().toISOString(),
    };
    const current = await this.listResources();
    persistJson(RESOURCES_STORAGE_KEY, [item, ...current]);
    return item;
  },
  async createModule(payload: CreateModuleInput): Promise<MethodologyModule> {
    const current = await this.listModules();
    const exists = current.some((module) => module.id === payload.id);
    if (exists) {
      throw new Error('Ya existe un módulo con ese ID.');
    }
    const module = {
      id: payload.id,
      title: payload.title,
      description: payload.description,
    };
    persistJson(MODULES_STORAGE_KEY, [...current, module]);
    return module;
  },
};
