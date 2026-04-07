import { ModuleData, ClientVertical, Task } from '../types';
import {
  MEDIA_MODULES,
  ECOMMERCE_MODULES,
  LOCAL_MODULES,
  NATIONAL_MODULES,
  INTERNATIONAL_MODULES,
} from '../constants';
import { createHttpClient } from './httpClient';
import { endpoints } from './endpoints';

interface TemplateTaskDTO extends Omit<Task, 'status'> {
  status?: string;
}

interface TemplateModuleDTO extends Omit<ModuleData, 'tasks'> {
  tasks: TemplateTaskDTO[];
}

interface VerticalTemplateDTO {
  vertical: ClientVertical;
  version: string;
  metadata?: Record<string, unknown>;
  modules: TemplateModuleDTO[];
}

interface TemplateCatalogResponse {
  version: string;
  templates: Partial<Record<ClientVertical, VerticalTemplateDTO>>;
}

export interface ResolvedTemplate {
  vertical: ClientVertical;
  version: string;
  modules: ModuleData[];
  source: 'remote' | 'local';
}

const localModulesByVertical: Record<ClientVertical, ModuleData[]> = {
  media: MEDIA_MODULES,
  ecom: ECOMMERCE_MODULES,
  local: LOCAL_MODULES,
  national: NATIONAL_MODULES,
  international: INTERNATIONAL_MODULES,
};

const LOCAL_TEMPLATE_VERSION = 'local-initial';
const httpClient = createHttpClient({ service: 'api', includeAuth: false, timeoutMs: 4000 });
let remoteCatalog: TemplateCatalogResponse | null = null;
let loadingPromise: Promise<void> | null = null;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeModule = (module: TemplateModuleDTO): ModuleData => ({
  ...module,
  tasks: module.tasks.map((task) => ({ ...task, status: task.status || 'pending' })),
});

const getLocalTemplate = (vertical: ClientVertical): ResolvedTemplate => ({
  vertical,
  version: LOCAL_TEMPLATE_VERSION,
  source: 'local',
  modules: clone(localModulesByVertical[vertical] || localModulesByVertical.media),
});

const hydrateRemoteCatalog = async (): Promise<void> => {
  if (remoteCatalog) {
    return;
  }

  if (!loadingPromise) {
    loadingPromise = httpClient
      .get<TemplateCatalogResponse>(endpoints.templates.catalog(), { includeAuth: false })
      .then((catalog) => {
        remoteCatalog = catalog;
      })
      .catch(() => {
        remoteCatalog = null;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }

  await loadingPromise;
};

export class TemplateService {
  static async prime(): Promise<void> {
    await hydrateRemoteCatalog();
  }

  static getTemplate(vertical: ClientVertical): ResolvedTemplate {
    const remoteTemplate = remoteCatalog?.templates?.[vertical];
    if (!remoteTemplate || !Array.isArray(remoteTemplate.modules) || remoteTemplate.modules.length === 0) {
      return getLocalTemplate(vertical);
    }

    return {
      vertical,
      version: remoteTemplate.version || remoteCatalog?.version || LOCAL_TEMPLATE_VERSION,
      source: 'remote',
      modules: clone(remoteTemplate.modules.map(normalizeModule)),
    };
  }
}
