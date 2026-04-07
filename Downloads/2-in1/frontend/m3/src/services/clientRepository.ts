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
  const rawConfig = raw.config || {};

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

const normalizeClient = (client: Client): Client => ({
  ...client,
  vertical: normalizeClientVertical(client.vertical),
  notes: client.notes || [],
  completedTasksLog: client.completedTasksLog || [],
  customRoadmapOrder: client.customRoadmapOrder || [],
  iaVisibility: normalizeIAVisibilityState(client.iaVisibility),
});

const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const mergeWithTemplateModules = (currentModules: ModuleData[], templateModules: ModuleData[]): ModuleData[] => {
  const moduleById = new Map(currentModules.map((module) => [module.id, module]));
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

  const customModules = currentModules.filter(
    (module) => module.isCustom || !templateModules.some((templateModule) => templateModule.id === module.id),
  );

  return [...merged, ...deepCopy(customModules)];
};

export class ClientRepository {
  static getClients(): Client[] {
    const savedClients = localStorage.getItem(CLIENTS_KEY);

    if (savedClients) {
      try {
        const parsedClients = JSON.parse(savedClients);
        const migratedClients = parsedClients.map(normalizeClient);

        return this.migrateModules(migratedClients);
      } catch (e) {
        console.error('Failed to parse clients', e);
      }
    }

    const legacyClients = localStorage.getItem(LEGACY_CLIENTS_KEY);
    if (legacyClients) {
      try {
        const parsedClients = JSON.parse(legacyClients);
        const migratedClients = parsedClients.map(normalizeClient);
        const normalized = this.migrateModules(migratedClients);
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

    const mediaStrategy = StrategyFactory.getStrategy('media');
    return [
      {
        id: crypto.randomUUID(),
        name: 'Proyecto Demo',
        vertical: 'media',
        modules: mediaStrategy.getModules(),
        templateVersion: mediaStrategy.getTemplateVersion(),
        createdAt: Date.now(),
        notes: [],
        completedTasksLog: [],
        customRoadmapOrder: [],
        iaVisibility: createDefaultIAVisibilityState(),
      },
    ];
  }

  static saveClients(clients: Client[]): void {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients.map(normalizeClient)));
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
