import {
  Client,
  Note,
  ModuleData,
  ClientVertical,
  IAVisibilityState,
  IAVisibilityRunResult,
  createDefaultIAVisibilityState,
} from '../types';
import { StrategyFactory } from '../strategies/StrategyFactory';
import {
  getProjectTypeFromVertical,
  getVerticalFromProjectType,
  normalizeGeoScope,
  normalizeInitialConfigPreset,
  normalizeBrandTerms,
  normalizeCountry,
  normalizePrimaryLanguage,
  normalizeProjectType,
  normalizeAnalysisProjectTypes,
  normalizeSector,
  normalizeSubSector,
} from '../utils/projectMetadata';
import { buildContextualRoadmap } from '@/config/projectContextualRoadmap';

const CLIENTS_KEY = 'mediaflow_clients_cache_v2';
const LEGACY_CLIENTS_KEY = 'mediaflow_clients';
const CURRENT_CLIENT_ID_KEY = 'mediaflow_current_client_id';
const GENERAL_NOTES_KEY = 'mediaflow_general_notes';
const LEGACY_MODULES_KEY = 'mediaflow_modules';

const CLIENT_VERTICAL_ALIASES: Record<string, ClientVertical> = {
  frontend: 'media',
};

const VALID_VERTICALS: ClientVertical[] = ['media', 'ecom', 'local', 'national', 'international'];

const normalizeClientVertical = (vertical: unknown): ClientVertical => {
  if (typeof vertical !== 'string') {
    return 'media';
  }

  const normalized = vertical.trim().toLowerCase();
  if (VALID_VERTICALS.includes(normalized as ClientVertical)) {
    return normalized as ClientVertical;
  }

  return CLIENT_VERTICAL_ALIASES[normalized] || 'media';
};

const normalizeIAVisibilityHistoryItem = (item: unknown): IAVisibilityRunResult | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const raw = item as Partial<IAVisibilityRunResult> & Record<string, unknown>;
  const sentimentSummary = raw.sentimentSummary && typeof raw.sentimentSummary === 'object' ? raw.sentimentSummary : {};

  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : crypto.randomUUID(),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    answer: typeof raw.answer === 'string' ? raw.answer : '',
    source: typeof raw.source === 'string' ? raw.source : undefined,
    competitorMentions: Array.isArray(raw.competitorMentions)
      ? raw.competitorMentions
          .filter((mention): mention is IAVisibilityRunResult['competitorMentions'][number] =>
            !!mention && typeof mention === 'object' && typeof mention.competitor === 'string',
          )
          .map((mention) => ({
            competitor: mention.competitor,
            mentions: typeof mention.mentions === 'number' ? mention.mentions : 0,
            sentiment:
              mention.sentiment === 'positive' || mention.sentiment === 'neutral' || mention.sentiment === 'negative'
                ? mention.sentiment
                : 'neutral',
          }))
      : [],
    sentimentSummary: {
      positive:
        typeof (sentimentSummary as Record<string, unknown>).positive === 'number'
          ? ((sentimentSummary as Record<string, unknown>).positive as number)
          : 0,
      neutral:
        typeof (sentimentSummary as Record<string, unknown>).neutral === 'number'
          ? ((sentimentSummary as Record<string, unknown>).neutral as number)
          : 0,
      negative:
        typeof (sentimentSummary as Record<string, unknown>).negative === 'number'
          ? ((sentimentSummary as Record<string, unknown>).negative as number)
          : 0,
    },
  };
};

const normalizeIAVisibilityState = (iaVisibility: unknown): IAVisibilityState => {
  const defaults = createDefaultIAVisibilityState();

  if (!iaVisibility || typeof iaVisibility !== 'object') {
    return defaults;
  }

  const raw = iaVisibility as Partial<IAVisibilityState> & { config?: Record<string, unknown> };
  const rawConfig: Record<string, unknown> = raw.config || {};

  return {
    config: {
      tone: typeof rawConfig.tone === 'string' ? rawConfig.tone : defaults.config.tone,
      objective: typeof rawConfig.objective === 'string' ? rawConfig.objective : defaults.config.objective,
      language: typeof rawConfig.language === 'string' ? rawConfig.language : defaults.config.language,
      location: typeof rawConfig.location === 'string' ? rawConfig.location : defaults.config.location,
      devices: Array.isArray(rawConfig.devices)
        ? rawConfig.devices.filter((device): device is string => typeof device === 'string')
        : defaults.config.devices,
      competitors: Array.isArray(rawConfig.competitors)
        ? rawConfig.competitors.filter((competitor): competitor is string => typeof competitor === 'string')
        : defaults.config.competitors,
      prompts: Array.isArray(rawConfig.prompts)
        ? rawConfig.prompts.filter((prompt): prompt is string => typeof prompt === 'string')
        : defaults.config.prompts,
    },
    history: Array.isArray(raw.history)
      ? raw.history
          .map((item) => normalizeIAVisibilityHistoryItem(item))
          .filter((item): item is IAVisibilityRunResult => item !== null)
      : defaults.history,
  };
};

const dedupeStable = (items: string[]): string[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
};

const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeModules = (modules: ModuleData[]): ModuleData[] => {
  const mergedById = new Map<number, ModuleData>();

  modules.forEach((module) => {
    const existing = mergedById.get(module.id);

    if (!existing) {
      mergedById.set(module.id, deepCopy(module));
      return;
    }

    const seenTaskIds = new Set(existing.tasks.map((task) => task.id));
    const additionalTasks = module.tasks.filter((task) => !seenTaskIds.has(task.id));

    mergedById.set(module.id, {
      ...existing,
      tasks: [...existing.tasks, ...deepCopy(additionalTasks)],
    });
  });

  return Array.from(mergedById.values()).sort((a, b) => a.id - b.id);
};

const warnDuplicateTaskIdsAcrossModules = (client: Client): void => {
  const seenTaskIds = new Set<string>();
  const duplicatedTaskIds = new Set<string>();

  client.modules.forEach((module) => {
    module.tasks.forEach((task) => {
      if (seenTaskIds.has(task.id)) {
        duplicatedTaskIds.add(task.id);
        return;
      }
      seenTaskIds.add(task.id);
    });
  });

  if (duplicatedTaskIds.size > 0) {
    console.warn(
      `[ClientRepository] Duplicate task IDs detected across modules for client "${client.name}" (${client.id}): ${Array.from(duplicatedTaskIds).join(', ')}`,
    );
  }
};

const normalizeClient = (client: Client, options?: { validateDuplicateTaskIds?: boolean }): Client => {
  const legacyVertical = normalizeClientVertical(client.vertical);
  const projectType = normalizeProjectType((client as Partial<Client>).projectType, legacyVertical);
  const vertical = getVerticalFromProjectType(projectType);

  if (options?.validateDuplicateTaskIds) {
    warnDuplicateTaskIdsAcrossModules({ ...client, vertical });
  }

  return {
    ...client,
    vertical,
    projectType,
    analysisProjectTypes: normalizeAnalysisProjectTypes((client as Partial<Client>).analysisProjectTypes, projectType),
    sector: normalizeSector((client as Partial<Client>).sector),
    geoScope: normalizeGeoScope((client as Partial<Client>).geoScope, projectType),
    country: normalizeCountry(
      (client as Partial<Client>).country,
      normalizeGeoScope((client as Partial<Client>).geoScope, projectType),
    ),
    primaryLanguage: normalizePrimaryLanguage((client as Partial<Client>).primaryLanguage),
    brandTerms: normalizeBrandTerms((client as Partial<Client>).brandTerms),
    initialConfigPreset: normalizeInitialConfigPreset(
      (client as Partial<Client>).initialConfigPreset,
      projectType,
    ),
    subSector: normalizeSubSector((client as Partial<Client>).subSector),
    modules: normalizeModules(client.modules || []),
    notes: client.notes || [],
    completedTasksLog: (client.completedTasksLog || []).map((entry) => ({
      ...entry,
      beforeAfter: entry.beforeAfter
        ? {
            link: entry.beforeAfter.link || {},
            postWindowDays: entry.beforeAfter.postWindowDays || 28,
            minimumValidationDays: entry.beforeAfter.minimumValidationDays || 14,
            status: entry.beforeAfter.status || 'pending_baseline',
            insight: entry.beforeAfter.insight || 'Pendiente de evaluación.',
            trace: entry.beforeAfter.trace || {
              source: 'gsc',
              property: entry.beforeAfter.link?.property || '',
              query: entry.beforeAfter.link?.query,
              url: entry.beforeAfter.link?.url,
              module: entry.beforeAfter.link?.module,
              projectType,
              sector: normalizeSector((client as Partial<Client>).sector),
              geoScope: normalizeGeoScope((client as Partial<Client>).geoScope, projectType),
              timestamp: Date.now(),
            },
            baseline: entry.beforeAfter.baseline,
            postAction: entry.beforeAfter.postAction,
            lastEvaluatedAt: entry.beforeAfter.lastEvaluatedAt,
          }
        : undefined,
    })),
    customRoadmapOrder: dedupeStable(client.customRoadmapOrder || []),
    iaVisibility: normalizeIAVisibilityState(client.iaVisibility),
    roadmapTemplateMode:
      client.roadmapTemplateMode ||
      ((client.initialConfigPreset?.useGenericConfig ? 'generic' : 'contextual') as
        | 'generic'
        | 'contextual'),
    moduleWeights:
      client.moduleWeights ||
      buildContextualRoadmap({
        projectType,
        sector: (client as Partial<Client>).sector,
        useGenericConfig: client.initialConfigPreset?.useGenericConfig,
      }).moduleWeights,
  };
};

const mergeWithTemplateModules = (currentModules: ModuleData[], templateModules: ModuleData[]): ModuleData[] => {
  const moduleById = new Map(currentModules.map((module) => [module.id, module]));
  const templateModuleIds = new Set(templateModules.map((module) => module.id));
  const merged = templateModules.map((templateModule) => {
    const existingModule = moduleById.get(templateModule.id);
    if (!existingModule) {
      return deepCopy(templateModule);
    }

    const tasksById = new Map(existingModule.tasks.map((task) => [task.id, task]));
    const mergedTasks = templateModule.tasks.map((templateTask) => {
      const existingTask = tasksById.get(templateTask.id);
      return existingTask ? { ...templateTask, ...existingTask } : deepCopy(templateTask);
    });

    const customTasks = existingModule.tasks.filter(
      (task) => task.isCustom || !templateModule.tasks.some((templateTask) => templateTask.id === task.id),
    );

    return {
      ...templateModule,
      ...existingModule,
      tasks: [...mergedTasks, ...deepCopy(customTasks)],
      isCustom: existingModule.isCustom,
    };
  });

  const customModules = currentModules.filter((module) => !templateModuleIds.has(module.id));

  return [...merged, ...deepCopy(customModules)];
};

const createFallbackClient = (): Client => {
  const mediaStrategy = StrategyFactory.getStrategy('media');
  return {
    id: crypto.randomUUID(),
    name: 'Proyecto Demo',
    vertical: 'media',
    projectType: getProjectTypeFromVertical('media'),
    analysisProjectTypes: [getProjectTypeFromVertical('media')],
    sector: 'Otro',
    geoScope: 'global',
    country: 'Global',
    primaryLanguage: 'es',
    brandTerms: [],
    initialConfigPreset: normalizeInitialConfigPreset(undefined, getProjectTypeFromVertical('media')),
    modules: mediaStrategy.getModules(),
    templateVersion: mediaStrategy.getTemplateVersion(),
    createdAt: Date.now(),
    notes: [],
    completedTasksLog: [],
    customRoadmapOrder: [],
    roadmapTemplateMode: 'contextual',
    moduleWeights: buildContextualRoadmap({
      projectType: getProjectTypeFromVertical('media'),
      sector: 'Otro',
    }).moduleWeights,
    iaVisibility: createDefaultIAVisibilityState(),
  };
};

export class ClientRepository {
  static getClients(): Client[] {
    const savedClients = localStorage.getItem(CLIENTS_KEY);

    if (savedClients) {
      try {
        const parsedClients = JSON.parse(savedClients);
        const migratedClients = parsedClients.map((client: Client) =>
          normalizeClient(client, { validateDuplicateTaskIds: true }),
        );
        const normalized = this.migrateModules(migratedClients);
        if (normalized.length === 0) {
          const fallbackClient = createFallbackClient();
          localStorage.setItem(CLIENTS_KEY, JSON.stringify([fallbackClient]));
          return [fallbackClient];
        }
        return normalized;
      } catch (e) {
        console.error('Failed to parse clients', e);
      }
    }

    const legacyClients = localStorage.getItem(LEGACY_CLIENTS_KEY);
    if (legacyClients) {
      try {
        const parsedClients = JSON.parse(legacyClients);
        const migratedClients = parsedClients.map((client: Client) =>
          normalizeClient(client, { validateDuplicateTaskIds: true }),
        );
        const normalized = this.migrateModules(migratedClients);
        if (normalized.length === 0) {
          const fallbackClient = createFallbackClient();
          localStorage.setItem(CLIENTS_KEY, JSON.stringify([fallbackClient]));
          return [fallbackClient];
        }
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(normalized));
        return normalized;
      } catch (e) {
        console.error('Failed to parse legacy clients', e);
      }
    }

    const savedLegacyModules = localStorage.getItem(LEGACY_MODULES_KEY);
    if (savedLegacyModules) {
      try {
        const legacyModules = JSON.parse(savedLegacyModules);
        const strategy = StrategyFactory.getStrategy('media');
        const legacyClient: Client = {
          id: 'legacy-project',
          name: 'Mi Primer Proyecto',
          vertical: 'media',
          projectType: getProjectTypeFromVertical('media'),
          sector: 'Otro',
          geoScope: 'global',
          country: 'Global',
          primaryLanguage: 'es',
          brandTerms: [],
          initialConfigPreset: normalizeInitialConfigPreset(undefined, getProjectTypeFromVertical('media')),
          modules: mergeWithTemplateModules(legacyModules, strategy.getModules()),
          templateVersion: strategy.getTemplateVersion(),
          createdAt: Date.now(),
          notes: [],
          completedTasksLog: [],
          customRoadmapOrder: [],
          iaVisibility: createDefaultIAVisibilityState(),
        };
        return this.migrateModules([legacyClient]);
      } catch (e) {
        console.error('Failed to migrate legacy modules', e);
      }
    }

    return [createFallbackClient()];
  }

  static saveClients(clients: Client[]): void {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients.map((client) => normalizeClient(client))));
  }

  static getCurrentClientId(): string {
    return localStorage.getItem(CURRENT_CLIENT_ID_KEY) || '';
  }

  static saveCurrentClientId(id: string): void {
    localStorage.setItem(CURRENT_CLIENT_ID_KEY, id);
  }

  static getGeneralNotes(): Note[] {
    const saved = localStorage.getItem(GENERAL_NOTES_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse general notes', e);
      }
    }
    return [];
  }

  static saveGeneralNotes(notes: Note[]): void {
    localStorage.setItem(GENERAL_NOTES_KEY, JSON.stringify(notes));
  }

  private static migrateModules(clients: Client[]): Client[] {
    return clients.map((client) => {
      const strategy = StrategyFactory.getStrategy(client.vertical);
      const nextTemplateVersion = strategy.getTemplateVersion();

      if (client.templateVersion === nextTemplateVersion) {
        return client;
      }

      return {
        ...client,
        modules: mergeWithTemplateModules(client.modules, strategy.getModules()),
        templateVersion: nextTemplateVersion,
      };
    });
  }
}

export { normalizeClient, normalizeClientVertical };
