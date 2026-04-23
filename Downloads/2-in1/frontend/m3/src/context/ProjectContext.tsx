import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  Client,
  NewClientInput,
  Note,
  ModuleData,
  CompletedTask,
  Task,
  TaskStatus,
  IAVisibilityPromptConfig,
  IAVisibilityRunResult,
  SeoPerformanceSnapshot,
  createDefaultIAVisibilityState,
  InsightFlowTrace,
  InsightSourceMeta,
  ProjectScoreContext,
  AIRoadmapGenerationRecord,
} from '../types';
import { ClientRepository } from '../services/clientRepository';
import { ProjectRemoteRepository } from '../services/projectRemoteRepository';
import { StrategyFactory } from '../strategies/StrategyFactory';
import { DEFAULT_KANBAN_COLUMNS } from '../config/kanban';
import {
  getProjectTypeFromVertical,
  getVerticalFromProjectType,
  normalizeGeoScope,
  normalizeInitialConfigPreset,
  normalizeBrandTerms,
  normalizeAnalysisProjectTypes,
  normalizeCountry,
  normalizePrimaryLanguage,
  normalizeProjectType,
  normalizeSector,
  normalizeSubSector,
} from '../utils/projectMetadata';
import { buildContextualRoadmap } from '@/config/projectContextualRoadmap';
import { computeProjectScoreContext } from '@/config/projectScoreWeights';

interface ProjectContextType {
  clients: Client[];
  currentClientId: string;
  currentClient: Client | null;
  modules: ModuleData[];
  globalScore: number;
  projectScoreContext: ProjectScoreContext | null;
  generalNotes: Note[];

  // Actions
  addClient: (input: NewClientInput) => void;
  renameClient: (id: string, name: string) => void;
  deleteClient: (id: string) => void;
  switchClient: (id: string) => void;
  updateCurrentClientProfile: (
    updates: Pick<Client, 'projectType' | 'sector' | 'geoScope' | 'brandTerms' | 'analysisProjectTypes'>,
  ) => void;
  saveClientSnapshot: (snapshot: Omit<SeoPerformanceSnapshot, 'id' | 'timestamp'>) => void;

  // Task Actions
  addTask: (
    moduleId: number,
    title: string,
    description: string,
    impact: 'High' | 'Medium' | 'Low',
    category: string,
    options?: {
      isInCustomRoadmap?: boolean;
      flow?: InsightFlowTrace;
      status?: TaskStatus;
      assignee?: string;
      insightSourceMeta?: InsightSourceMeta;
    },
  ) => void;
  addTasksBulk: (
    tasks: {
      moduleId: number;
      title: string;
      description: string;
      impact: 'High' | 'Medium' | 'Low';
      category: string;
      status?: TaskStatus;
      isInRoadmap?: boolean;
    }[],
  ) => void;
  deleteTask: (moduleId: number, taskId: string) => void;
  toggleTask: (moduleId: number, taskId: string) => void;
  updateTaskStatus: (moduleId: number, taskId: string, newStatus: TaskStatus) => void;
  updateTaskNotes: (moduleId: number, taskId: string, notes: string) => void;
  updateTaskImpact: (moduleId: number, taskId: string, impact: 'High' | 'Medium' | 'Low') => void;
  updateTaskDetails: (moduleId: number, taskId: string, updates: Partial<Task>) => void;
  toggleTaskCommunicated: (moduleId: number, taskId: string) => void;

  // Kanban Actions
  addKanbanColumn: (title: string) => void;
  deleteKanbanColumn: (columnId: string) => void;

  // Roadmap Actions
  toggleCustomRoadmapTask: (moduleId: number, taskId: string) => void;
  handleReorderRoadmap: (newOrder: string[]) => void;
  addManualCompletedTask: (title: string, description: string) => void;
  deleteCompletedTaskLog: (logEntryId: string) => void;
  updateCompletedTaskImpact: (logEntryId: string, updates: Partial<CompletedTask['beforeAfter']>) => void;

  // Notes Actions
  addNote: (
    content: string,
    type: 'project' | 'general',
    options?: Partial<Pick<Note, 'scopeType' | 'scopeId' | 'author' | 'tags' | 'isInternal' | 'isPinned' | 'trace'>>,
  ) => void;
  updateNote: (noteId: string, content: string, type: 'project' | 'general') => void;
  deleteNote: (noteId: string, type: 'project' | 'general') => void;
  togglePinNote: (noteId: string, type: 'project' | 'general') => void;
  toggleInternalNote: (noteId: string, type: 'project' | 'general') => void;
  convertNoteToTask: (noteId: string, type: 'project' | 'general', moduleId?: number) => void;

  // AI Roadmap Actions
  updateAIRoadmap: (tasks: Task[]) => void;
  saveAIRoadmapGeneration: (
    record: Omit<AIRoadmapGenerationRecord, 'id' | 'timestamp'> & Partial<Pick<AIRoadmapGenerationRecord, 'id' | 'timestamp'>>,
  ) => void;
  importMultipleAIRoadmapTasks: (tasks: Task[]) => void;

  // IA Visibility Actions
  updateIAVisibilityConfig: (config: Partial<IAVisibilityPromptConfig>) => void;
  saveIAVisibilityRunResult: (result: IAVisibilityRunResult) => void;
  clearIAVisibilityHistory: () => void;
  filterIAVisibilityHistory: (runIdsToKeep: string[]) => void;

  // Data Management
  importData: (newClients: Client[], newNotes: Note[]) => void;
  restoreProjectData: (
    backupClients: Client[],
    backupNotes: Note[],
    backupCurrentClientId?: string,
  ) => void;

  // Reset
  resetCurrentProject: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const normalizeProjectClientProfile = (client: Client): Client => {
  const projectType = normalizeProjectType(client.projectType, client.vertical);
  const vertical = getVerticalFromProjectType(projectType);

  return {
    ...client,
    vertical,
    projectType,
    analysisProjectTypes: normalizeAnalysisProjectTypes(client.analysisProjectTypes, projectType),
    sector: normalizeSector(client.sector),
    geoScope: normalizeGeoScope(client.geoScope, projectType),
    country: normalizeCountry(client.country, normalizeGeoScope(client.geoScope, projectType)),
    primaryLanguage: normalizePrimaryLanguage(client.primaryLanguage),
    brandTerms: normalizeBrandTerms(client.brandTerms),
    initialConfigPreset: normalizeInitialConfigPreset(client.initialConfigPreset, projectType),
    subSector: normalizeSubSector(client.subSector),
    iaVisibility: client.iaVisibility || createDefaultIAVisibilityState(),
  };
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const SYNC_DEBOUNCE_MS = 900;
  // --- State Initialization ---
  const [clients, setClients] = useState<Client[]>(() => ClientRepository.getClients());
  const [generalNotes, setGeneralNotes] = useState<Note[]>(() =>
    ClientRepository.getGeneralNotes(),
  );
  const [currentClientId, setCurrentClientId] = useState<string>(() => {
    const saved = ClientRepository.getCurrentClientId();
    if (saved && clients.find((c) => c.id === saved)) {
      return saved;
    }
    return clients[0]?.id || '';
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncInFlightRef = useRef(false);
  const pendingSyncAfterCurrentRef = useRef(false);
  const latestSnapshotRef = useRef({
    clients,
    generalNotes,
    currentClientId,
  });

  const syncSnapshot = useCallback(
    async (
      snapshot: {
        clients: Client[];
        generalNotes: Note[];
        currentClientId: string;
      },
      updatedFields: string[] = ['clients', 'generalNotes', 'currentClientId'],
    ) => {
      if (!isHydrated) {
        return;
      }

      if (isSyncInFlightRef.current) {
        pendingSyncAfterCurrentRef.current = true;
        return;
      }

      isSyncInFlightRef.current = true;
      try {
        await ProjectRemoteRepository.saveSnapshot(snapshot, { updatedFields });
      } catch (error) {
        if ((error as Error).message !== 'version_conflict') {
          console.warn('Project sync failed; keeping local cache.', error);
        }
      } finally {
        isSyncInFlightRef.current = false;
        if (pendingSyncAfterCurrentRef.current) {
          pendingSyncAfterCurrentRef.current = false;
          void syncSnapshot(latestSnapshotRef.current, updatedFields);
        }
      }
    },
    [isHydrated],
  );

  const scheduleSnapshotSync = useCallback(
    (updatedFields: string[] = ['clients', 'generalNotes', 'currentClientId']) => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        void syncSnapshot(latestSnapshotRef.current, updatedFields);
      }, SYNC_DEBOUNCE_MS);
    },
    [syncSnapshot],
  );

  const flushSnapshotSync = useCallback(
    (updatedFields: string[] = ['clients', 'generalNotes', 'currentClientId']) => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      void syncSnapshot(latestSnapshotRef.current, updatedFields);
    },
    [syncSnapshot],
  );

  const flushSnapshotSyncNextTick = useCallback(
    (updatedFields: string[] = ['clients', 'generalNotes', 'currentClientId']) => {
      setTimeout(() => flushSnapshotSync(updatedFields), 0);
    },
    [flushSnapshotSync],
  );

  // --- Derived State ---

  const currentClient = useMemo(
    () => clients.find((c) => c.id === currentClientId) || clients[0] || null,
    [clients, currentClientId],
  );
  const modules = useMemo(() => (currentClient ? currentClient.modules : []), [currentClient]);

  // --- Derived State for Score ---
  const projectScoreContext = useMemo(() => {
    if (!currentClient) {
      return null;
    }

    return computeProjectScoreContext({
      modules,
      projectType: currentClient.projectType || getProjectTypeFromVertical(currentClient.vertical),
      sector: currentClient.sector,
      geoScope: currentClient.geoScope || normalizeGeoScope(undefined, currentClient.projectType || getProjectTypeFromVertical(currentClient.vertical)),
    });
  }, [currentClient, modules]);

  const globalScore = useMemo(() => {
    if (!modules) {
      return 0;
    }
    return projectScoreContext?.score || 0;
  }, [modules, projectScoreContext]);

  // --- Persistence Effects ---
  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const snapshot = await ProjectRemoteRepository.bootstrap();
      if (!mounted) {
        return;
      }

      setClients(snapshot.clients);
      setGeneralNotes(snapshot.generalNotes);
      const nextClientId =
        snapshot.currentClientId && snapshot.clients.some((client) => client.id === snapshot.currentClientId)
          ? snapshot.currentClientId
          : snapshot.clients[0]?.id || '';
      setCurrentClientId(nextClientId);
      setIsHydrated(true);
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    ClientRepository.saveClients(clients);
    ClientRepository.saveGeneralNotes(generalNotes);
    if (currentClientId) {
      ClientRepository.saveCurrentClientId(currentClientId);
    }
    latestSnapshotRef.current = {
      clients,
      generalNotes,
      currentClientId,
    };
    scheduleSnapshotSync();
  }, [clients, generalNotes, currentClientId, isHydrated, scheduleSnapshotSync]);

  useEffect(() => () => {
    flushSnapshotSync();
  }, [flushSnapshotSync]);

  // --- Actions ---

  const addClient = useCallback((input: NewClientInput) => {
    const vertical = input.vertical;
    const strategy = StrategyFactory.getStrategy(vertical);
    const initialModules = strategy.getModules();
    const templateVersion = strategy.getTemplateVersion();
    const projectType = input.projectType || getProjectTypeFromVertical(vertical);

    const createdAt = Date.now();
    const contextualRoadmap = buildContextualRoadmap({
      projectType,
      sector: input.sector,
      useGenericConfig: input.initialConfigPreset?.useGenericConfig,
      createdAt,
    });
    const suggestionMetaByTask = new Map(
      contextualRoadmap.suggestions.map((suggestion) => [`${suggestion.moduleId}:${suggestion.taskId}`, suggestion.meta]),
    );
    const customRoadmapOrder: string[] = [];
    const initialModulesWithContext = initialModules.map((module) => ({
      ...module,
      tasks: module.tasks.map((task) => {
        const match = suggestionMetaByTask.get(`${module.id}:${task.id}`);
        if (!match) {
          return task;
        }
        customRoadmapOrder.push(task.id);
        return {
          ...task,
          isInCustomRoadmap: true,
          templateMeta: match,
        };
      }),
    }));

    const newClient: Client = {
      id: crypto.randomUUID(),
      name: input.name,
      vertical,
      projectType,
      analysisProjectTypes: normalizeAnalysisProjectTypes(input.analysisProjectTypes, projectType),
      sector: normalizeSector(input.sector),
      geoScope: normalizeGeoScope(input.geoScope, projectType),
      country: normalizeCountry(input.country, normalizeGeoScope(input.geoScope, projectType)),
      primaryLanguage: normalizePrimaryLanguage(input.primaryLanguage),
      brandTerms: normalizeBrandTerms(input.brandTerms),
      initialConfigPreset: normalizeInitialConfigPreset(
        input.initialConfigPreset || {
          ...input.initialConfigPreset,
          suggestedModuleIds: contextualRoadmap.suggestedModuleIds,
          useGenericConfig: contextualRoadmap.roadmapTemplateMode === 'generic',
        },
        projectType,
      ),
      subSector: normalizeSubSector(input.subSector),
      modules: initialModulesWithContext, // Deep copy handled in Strategy
      templateVersion,
      createdAt,
      notes: [],
      completedTasksLog: [],
      customRoadmapOrder,
      roadmapTemplateMode: contextualRoadmap.roadmapTemplateMode,
      moduleWeights: contextualRoadmap.moduleWeights,
      iaVisibility: createDefaultIAVisibilityState(),
    };
    setClients((prev) => [...prev, newClient]);
    setCurrentClientId(newClient.id);
    flushSnapshotSyncNextTick(['clients', 'currentClientId']);
  }, [flushSnapshotSyncNextTick]);

  const deleteClient = useCallback(
    (id: string) => {
      if (clients.length <= 1) {
        alert('No puedes eliminar el único proyecto.');
        return;
      }
      const newClients = clients.filter((c) => c.id !== id);
      setClients(newClients);
      if (currentClientId === id) {
        setCurrentClientId(newClients[0].id);
      }
      flushSnapshotSyncNextTick(['clients', 'currentClientId']);
    },
    [clients, currentClientId, flushSnapshotSyncNextTick],
  );

  const switchClient = useCallback((id: string) => {
    setCurrentClientId(id);
  }, []);

  const renameClient = useCallback(
    (id: string, name: string) => {
      const nextName = name.trim();
      if (!nextName) {
        return;
      }
      setClients((prev) =>
        prev.map((client) => (client.id === id ? { ...client, name: nextName } : client)),
      );
      flushSnapshotSyncNextTick(['clients']);
    },
    [flushSnapshotSyncNextTick],
  );

  const updateCurrentClientProfile = useCallback(
    (updates: Pick<Client, 'projectType' | 'sector' | 'geoScope' | 'brandTerms' | 'analysisProjectTypes'>) => {
      setClients((prev) =>
        prev.map((client) => {
          if (client.id !== currentClientId) {
            return client;
          }

          const projectType = normalizeProjectType(updates.projectType, client.vertical);
          const geoScope = normalizeGeoScope(updates.geoScope, projectType);

          return normalizeProjectClientProfile({
            ...client,
            projectType,
            analysisProjectTypes: normalizeAnalysisProjectTypes(updates.analysisProjectTypes, projectType),
            sector: normalizeSector(updates.sector),
            geoScope,
            brandTerms: normalizeBrandTerms(updates.brandTerms),
          });
        }),
      );
      flushSnapshotSyncNextTick(['clients']);
    },
    [currentClientId, flushSnapshotSyncNextTick],
  );

  const saveClientSnapshot = useCallback(
    (snapshot: Omit<SeoPerformanceSnapshot, 'id' | 'timestamp'>) => {
      if (!currentClientId) {
        return;
      }

      setClients((prev) =>
        prev.map((client) => {
          if (client.id !== currentClientId) {
            return client;
          }

          const existing = client.seoSnapshots || [];
          const dedupeKey = `${snapshot.scope}:${snapshot.scopeId}:${snapshot.period.currentStart}:${snapshot.period.currentEnd}:${snapshot.property}:${snapshot.captureType}`;
          const filtered = existing.filter((item) => {
            const itemKey = `${item.scope}:${item.scopeId}:${item.period.currentStart}:${item.period.currentEnd}:${item.property}:${item.captureType}`;
            return itemKey !== dedupeKey;
          });

          return {
            ...client,
            seoSnapshots: [
              {
                ...snapshot,
                id: crypto.randomUUID(),
                timestamp: Date.now(),
              },
              ...filtered,
            ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 500),
          };
        }),
      );
      flushSnapshotSyncNextTick(['clients']);
    },
    [currentClientId, flushSnapshotSyncNextTick],
  );

  const updateCurrentClientModules = useCallback(
    (newModules: ModuleData[]) => {
      setClients((prev) =>
        prev.map((c) => (c.id === currentClientId ? { ...c, modules: newModules } : c)),
      );
    },
    [currentClientId],
  );

  const updateCurrentClientIAVisibility = useCallback(
    (updater: (state: ReturnType<typeof createDefaultIAVisibilityState>) => ReturnType<typeof createDefaultIAVisibilityState>) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) {
            return c;
          }

          const currentIAVisibility = c.iaVisibility || createDefaultIAVisibilityState();
          return {
            ...c,
            iaVisibility: updater(currentIAVisibility),
          };
        }),
      );
    },
    [currentClientId],
  );

  const addTask = useCallback(
    (
      moduleId: number,
      title: string,
      description: string,
      impact: 'High' | 'Medium' | 'Low',
      category: string,
      options?: {
        isInCustomRoadmap?: boolean;
        flow?: InsightFlowTrace;
        status?: TaskStatus;
        assignee?: string;
        insightSourceMeta?: InsightSourceMeta;
      },
    ) => {
      const newModules = modules.map((m) => {
        if (m.id !== moduleId) return m;
        const newTask: any = {
          id: `custom-${Date.now()}`,
          title,
          description,
          impact,
          category,
          isCustom: true,
          isInCustomRoadmap: options?.isInCustomRoadmap || false,
          flow: options?.flow,
          status: options?.status || 'pending',
          assignee: options?.assignee,
          insightSourceMeta: options?.insightSourceMeta,
          templateMeta: currentClient
            ? {
                templateId: 'custom-client',
                templateLabel: 'Personalizado por cliente',
                origin: 'client_custom',
                projectType: currentClient.projectType || 'MEDIA',
                sector: currentClient.sector,
                moduleId,
                priority: impact,
                generatedAt: Date.now(),
              }
            : undefined,
        };
        return {
          ...m,
          tasks: [...m.tasks, newTask],
        };
      });
      updateCurrentClientModules(newModules);
    },
    [currentClient, modules, updateCurrentClientModules],
  );

  const addTasksBulk = useCallback(
    (
      tasks: {
        moduleId: number;
        title: string;
        description: string;
        impact: 'High' | 'Medium' | 'Low';
        category: string;
        status?: TaskStatus;
        isInRoadmap?: boolean;
      }[],
    ) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) return c;

          let newModules = [...c.modules];
          const tasksByModule = new Map<number, any[]>();
          const newRoadmapOrder = [...(c.customRoadmapOrder || [])];

          // Group new tasks by module
          tasks.forEach((task) => {
            if (!tasksByModule.has(task.moduleId)) {
              tasksByModule.set(task.moduleId, []);
            }
            const newTask = {
              id: crypto.randomUUID(),
              title: task.title,
              description: task.description,
              impact: task.impact,
              status: task.status || 'pending',
              category: task.category,
              isCustom: true,
              isInCustomRoadmap: task.isInRoadmap || false,
              templateMeta: c
                ? {
                    templateId: 'custom-client',
                    templateLabel: 'Personalizado por cliente',
                    origin: 'client_custom' as const,
                    projectType: c.projectType || 'MEDIA',
                    sector: c.sector,
                    moduleId: task.moduleId,
                    priority: task.impact,
                    generatedAt: Date.now(),
                  }
                : undefined,
            };
            tasksByModule.get(task.moduleId)?.push(newTask);

            if (newTask.isInCustomRoadmap) {
              newRoadmapOrder.push(newTask.id);
            }
          });

          // Update modules
          newModules = newModules.map((m) => {
            if (tasksByModule.has(m.id)) {
              return {
                ...m,
                tasks: [...m.tasks, ...(tasksByModule.get(m.id) || [])],
              };
            }
            return m;
          });

          return {
            ...c,
            modules: newModules,
            customRoadmapOrder: newRoadmapOrder,
          };
        }),
      );
    },
    [currentClientId],
  );

  const deleteTask = useCallback(
    (moduleId: number, taskId: string) => {
      const newModules = modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          tasks: m.tasks.filter((t) => t.id !== taskId),
        };
      });
      updateCurrentClientModules(newModules);
    },
    [modules, updateCurrentClientModules],
  );

  const updateTaskNotes = useCallback(
    (moduleId: number, taskId: string, notes: string) => {
      const newModules = modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          tasks: m.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return { ...t, userNotes: notes };
          }),
        };
      });
      updateCurrentClientModules(newModules);
    },
    [modules, updateCurrentClientModules],
  );

  const updateTaskImpact = useCallback(
    (moduleId: number, taskId: string, impact: 'High' | 'Medium' | 'Low') => {
      const newModules = modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          tasks: m.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return { ...t, impact };
          }),
        };
      });
      updateCurrentClientModules(newModules);
    },
    [modules, updateCurrentClientModules],
  );

  const updateTaskDetails = useCallback(
    (moduleId: number, taskId: string, updates: Partial<Task>) => {
      const newModules = modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          tasks: m.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return { ...t, ...updates };
          }),
        };
      });
      updateCurrentClientModules(newModules);
    },
    [modules, updateCurrentClientModules],
  );

  const addKanbanColumn = useCallback(
    (title: string) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) return c;
          const currentColumns =
            c.kanbanColumns && c.kanbanColumns.length > 0
              ? c.kanbanColumns
              : DEFAULT_KANBAN_COLUMNS;
          const newColumn = { id: crypto.randomUUID(), title };
          return { ...c, kanbanColumns: [...currentColumns, newColumn] };
        }),
      );
    },
    [currentClientId],
  );

  const deleteKanbanColumn = useCallback(
    (columnId: string) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) return c;
          const currentColumns =
            c.kanbanColumns && c.kanbanColumns.length > 0
              ? c.kanbanColumns
              : DEFAULT_KANBAN_COLUMNS;
          return { ...c, kanbanColumns: currentColumns.filter((col) => col.id !== columnId) };
        }),
      );
    },
    [currentClientId],
  );

  const toggleTaskCommunicated = useCallback(
    (moduleId: number, taskId: string) => {
      if (!currentClient) return;

      const newModules = modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          tasks: m.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return { ...t, communicated: !t.communicated };
          }),
        };
      });
      updateCurrentClientModules(newModules);
    },
    [currentClient, modules, updateCurrentClientModules],
  );

  const toggleCustomRoadmapTask = useCallback(
    (moduleId: number, taskId: string) => {
      if (!currentClient) return;

      const newModules = modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          tasks: m.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return { ...t, isInCustomRoadmap: !t.isInCustomRoadmap };
          }),
        };
      });

      let newOrder = currentClient.customRoadmapOrder || [];
      const task = modules.find((m) => m.id === moduleId)?.tasks.find((t) => t.id === taskId);

      if (task && !task.isInCustomRoadmap) {
        // Adding
        if (!newOrder.includes(taskId)) {
          newOrder = [...newOrder, taskId];
        }
      } else {
        // Removing
        newOrder = newOrder.filter((id) => id !== taskId);
      }

      setClients((prev) =>
        prev.map((c) =>
          c.id === currentClientId
            ? { ...c, modules: newModules, customRoadmapOrder: newOrder }
            : c,
        ),
      );
    },
    [currentClient, modules, currentClientId],
  );

  const updateAIRoadmap = useCallback(
    (tasks: Task[]) => {
      setClients((prev) =>
        prev.map((c) => (c.id === currentClientId ? { ...c, aiRoadmap: tasks } : c)),
      );
    },
    [currentClientId],
  );

  const saveAIRoadmapGeneration = useCallback(
    (
      record: Omit<AIRoadmapGenerationRecord, 'id' | 'timestamp'> &
        Partial<Pick<AIRoadmapGenerationRecord, 'id' | 'timestamp'>>,
    ) => {
      const persistedRecord: AIRoadmapGenerationRecord = {
        ...record,
        id: record.id || crypto.randomUUID(),
        timestamp: record.timestamp || Date.now(),
      };
      setClients((prev) =>
        prev.map((c) =>
          c.id === currentClientId
            ? {
                ...c,
                aiRoadmapGenerationHistory: [
                  persistedRecord,
                  ...(c.aiRoadmapGenerationHistory || []),
                ].slice(0, 100),
              }
            : c,
        ),
      );
    },
    [currentClientId],
  );

  const importMultipleAIRoadmapTasks = useCallback(
    (tasks: Task[]) => {
      const targetModuleId = 9; // MIA: Fichas de IA
      const newModules = modules.map((m) => {
        if (m.id !== targetModuleId) return m;

        const existingIds = new Set(m.tasks.map((t) => t.id));
        const newTasks = tasks.filter((t) => !existingIds.has(t.id));

        if (newTasks.length === 0) return m;

        return {
          ...m,
          tasks: [...m.tasks, ...newTasks],
        };
      });
      updateCurrentClientModules(newModules);
    },
    [modules, updateCurrentClientModules],
  );

  const updateIAVisibilityConfig = useCallback(
    (config: Partial<IAVisibilityPromptConfig>) => {
      updateCurrentClientIAVisibility((state) => ({
        ...state,
        config: {
          ...state.config,
          ...config,
        },
      }));
    },
    [updateCurrentClientIAVisibility],
  );

  const saveIAVisibilityRunResult = useCallback(
    (result: IAVisibilityRunResult) => {
      updateCurrentClientIAVisibility((state) => ({
        ...state,
        history: [result, ...state.history],
      }));
    },
    [updateCurrentClientIAVisibility],
  );

  const clearIAVisibilityHistory = useCallback(() => {
    updateCurrentClientIAVisibility((state) => ({
      ...state,
      history: [],
    }));
  }, [updateCurrentClientIAVisibility]);

  const filterIAVisibilityHistory = useCallback(
    (runIdsToKeep: string[]) => {
      const allowedRunIds = new Set(runIdsToKeep);
      updateCurrentClientIAVisibility((state) => ({
        ...state,
        history: state.history.filter((entry) => allowedRunIds.has(entry.id)),
      }));
    },
    [updateCurrentClientIAVisibility],
  );

  const handleReorderRoadmap = useCallback(
    (newOrder: string[]) => {
      setClients((prev) =>
        prev.map((c) => (c.id === currentClientId ? { ...c, customRoadmapOrder: newOrder } : c)),
      );
    },
    [currentClientId],
  );

  const toggleTask = useCallback(
    (moduleId: number, taskId: string) => {
      let taskToToggle: any = null;
      modules.forEach((m) => {
        if (m.id === moduleId) {
          const found = m.tasks.find((t) => t.id === taskId);
          if (found) taskToToggle = found;
        }
      });

      if (!taskToToggle) return;

      const isNowComplete = taskToToggle.status !== 'completed';

      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) return c;

          const newModules = c.modules.map((m) => {
            if (m.id !== moduleId) return m;
            return {
              ...m,
              tasks: m.tasks.map((t) => {
                if (t.id !== taskId) return t;
                const newStatus = isNowComplete ? 'completed' : 'pending';
                return { ...t, status: newStatus };
              }),
            };
          });

          let newLog = c.completedTasksLog || [];
          if (isNowComplete) {
            const logEntry: CompletedTask = {
              id: crypto.randomUUID(),
              taskId: taskId,
              title: taskToToggle.title,
              description: taskToToggle.description,
              completedAt: Date.now(),
              source: 'module',
              moduleId: moduleId,
              beforeAfter: {
                link: {
                  property: taskToToggle.impactLink?.property || taskToToggle.insightSourceMeta?.property || '',
                  query: taskToToggle.impactLink?.query || taskToToggle.insightSourceMeta?.query || '',
                  url: taskToToggle.impactLink?.url || taskToToggle.insightSourceMeta?.url || '',
                  module: c.modules.find((module) => module.id === moduleId)?.title || `Módulo ${moduleId}`,
                },
                postWindowDays: taskToToggle.impactPostWindowDays || 28,
                minimumValidationDays: 14,
                status: 'pending_baseline',
                insight: 'Completa el baseline y el periodo post para evaluar impacto real.',
                trace: {
                  source: 'gsc',
                  property: taskToToggle.impactLink?.property || taskToToggle.insightSourceMeta?.property || '',
                  query: taskToToggle.impactLink?.query || taskToToggle.insightSourceMeta?.query,
                  url: taskToToggle.impactLink?.url || taskToToggle.insightSourceMeta?.url,
                  module: c.modules.find((module) => module.id === moduleId)?.title || `Módulo ${moduleId}`,
                  projectType: c.projectType,
                  sector: c.sector,
                  geoScope: c.geoScope,
                  timestamp: Date.now(),
                },
              },
            };
            newLog = [logEntry, ...newLog];
          }

          return {
            ...c,
            modules: newModules,
            completedTasksLog: newLog,
          };
        }),
      );
    },
    [modules, currentClientId],
  );

  const updateTaskStatus = useCallback(
    (moduleId: number, taskId: string, newStatus: TaskStatus) => {
      let taskToUpdate: any = null;
      modules.forEach((m) => {
        if (m.id === moduleId) {
          const found = m.tasks.find((t) => t.id === taskId);
          if (found) taskToUpdate = found;
        }
      });

      if (!taskToUpdate) return;

      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) return c;

          const newModules = c.modules.map((m) => {
            if (m.id !== moduleId) return m;
            return {
              ...m,
              tasks: m.tasks.map((t) => {
                if (t.id !== taskId) return t;
                return { ...t, status: newStatus };
              }),
            };
          });

          let newLog = c.completedTasksLog || [];
          if (newStatus === 'completed' && taskToUpdate.status !== 'completed') {
            const logEntry: CompletedTask = {
              id: crypto.randomUUID(),
              taskId: taskId,
              title: taskToUpdate.title,
              description: taskToUpdate.description,
              completedAt: Date.now(),
              source: 'module',
              moduleId: moduleId,
              beforeAfter: {
                link: {
                  property: taskToUpdate.impactLink?.property || taskToUpdate.insightSourceMeta?.property || '',
                  query: taskToUpdate.impactLink?.query || taskToUpdate.insightSourceMeta?.query || '',
                  url: taskToUpdate.impactLink?.url || taskToUpdate.insightSourceMeta?.url || '',
                  module: c.modules.find((module) => module.id === moduleId)?.title || `Módulo ${moduleId}`,
                },
                postWindowDays: taskToUpdate.impactPostWindowDays || 28,
                minimumValidationDays: 14,
                status: 'pending_baseline',
                insight: 'Completa el baseline y el periodo post para evaluar impacto real.',
                trace: {
                  source: 'gsc',
                  property: taskToUpdate.impactLink?.property || taskToUpdate.insightSourceMeta?.property || '',
                  query: taskToUpdate.impactLink?.query || taskToUpdate.insightSourceMeta?.query,
                  url: taskToUpdate.impactLink?.url || taskToUpdate.insightSourceMeta?.url,
                  module: c.modules.find((module) => module.id === moduleId)?.title || `Módulo ${moduleId}`,
                  projectType: c.projectType,
                  sector: c.sector,
                  geoScope: c.geoScope,
                  timestamp: Date.now(),
                },
              },
            };
            newLog = [logEntry, ...newLog];
          }

          return {
            ...c,
            modules: newModules,
            completedTasksLog: newLog,
          };
        }),
      );
    },
    [modules, currentClientId],
  );

  const addManualCompletedTask = useCallback(
    (title: string, description: string) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) return c;
          const newEntry: CompletedTask = {
            id: crypto.randomUUID(),
            title,
            description,
            completedAt: Date.now(),
            source: 'manual',
          };
          return {
            ...c,
            completedTasksLog: [newEntry, ...(c.completedTasksLog || [])],
          };
        }),
      );
    },
    [currentClientId],
  );

  const deleteCompletedTaskLog = useCallback(
    (logEntryId: string) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) return c;
          return {
            ...c,
            completedTasksLog: (c.completedTasksLog || []).filter(
              (entry) => entry.id !== logEntryId,
            ),
          };
        }),
      );
    },
    [currentClientId],
  );

  const updateCompletedTaskImpact = useCallback(
    (logEntryId: string, updates: Partial<CompletedTask['beforeAfter']>) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== currentClientId) return c;
          return {
            ...c,
            completedTasksLog: (c.completedTasksLog || []).map((entry) => {
              if (entry.id !== logEntryId) return entry;
              return {
                ...entry,
                beforeAfter: {
                  link: entry.beforeAfter?.link || {},
                  postWindowDays: entry.beforeAfter?.postWindowDays || 28,
                  minimumValidationDays: entry.beforeAfter?.minimumValidationDays || 14,
                  status: entry.beforeAfter?.status || 'pending_baseline',
                  insight: entry.beforeAfter?.insight || 'Pendiente de evaluación.',
                  trace: entry.beforeAfter?.trace || {
                    source: 'gsc',
                    property: '',
                    projectType: c.projectType,
                    sector: c.sector,
                    geoScope: c.geoScope,
                    timestamp: Date.now(),
                  },
                  ...entry.beforeAfter,
                  ...updates,
                },
              };
            }),
          };
        }),
      );
    },
    [currentClientId],
  );

  const addNote = useCallback(
    (
      content: string,
      type: 'project' | 'general',
      options?: Partial<Pick<Note, 'scopeType' | 'scopeId' | 'author' | 'tags' | 'isInternal' | 'isPinned' | 'trace'>>,
    ) => {
      const newNote: Note = {
        id: crypto.randomUUID(),
        content,
        scopeType: options?.scopeType || (type === 'general' ? 'global' : 'client'),
        scopeId: options?.scopeId || (type === 'general' ? 'global' : currentClientId),
        author: options?.author || 'Equipo SEO',
        tags: options?.tags || [],
        isInternal: options?.isInternal || false,
        isPinned: options?.isPinned || false,
        trace: options?.trace,
        createdAt: Date.now(),
      };

      if (type === 'general') {
        setGeneralNotes((prev) => [newNote, ...prev]);
      } else {
        setClients((prev) =>
          prev.map((c) =>
            c.id === currentClientId ? { ...c, notes: [newNote, ...(c.notes || [])] } : c,
          ),
        );
      }
    },
    [currentClientId],
  );

  const togglePinNote = useCallback(
    (noteId: string, type: 'project' | 'general') => {
      if (type === 'general') {
        setGeneralNotes((prev) =>
          prev.map((note) =>
            note.id === noteId ? { ...note, isPinned: !note.isPinned, updatedAt: Date.now() } : note,
          ),
        );
        return;
      }

      setClients((prev) =>
        prev.map((client) =>
          client.id === currentClientId
            ? {
                ...client,
                notes: (client.notes || []).map((note) =>
                  note.id === noteId ? { ...note, isPinned: !note.isPinned, updatedAt: Date.now() } : note,
                ),
              }
            : client,
        ),
      );
    },
    [currentClientId],
  );

  const toggleInternalNote = useCallback(
    (noteId: string, type: 'project' | 'general') => {
      if (type === 'general') {
        setGeneralNotes((prev) =>
          prev.map((note) =>
            note.id === noteId ? { ...note, isInternal: !note.isInternal, updatedAt: Date.now() } : note,
          ),
        );
        return;
      }

      setClients((prev) =>
        prev.map((client) =>
          client.id === currentClientId
            ? {
                ...client,
                notes: (client.notes || []).map((note) =>
                  note.id === noteId ? { ...note, isInternal: !note.isInternal, updatedAt: Date.now() } : note,
                ),
              }
            : client,
        ),
      );
    },
    [currentClientId],
  );

  const convertNoteToTask = useCallback(
    (noteId: string, type: 'project' | 'general', moduleId = 1) => {
      const sourceNotes =
        type === 'general'
          ? generalNotes
          : clients.find((client) => client.id === currentClientId)?.notes || [];
      const note = sourceNotes.find((item) => item.id === noteId);
      if (!note || !note.content.trim()) return;

      addTask(
        moduleId,
        `Nota convertida · ${note.scopeType || 'global'}`,
        note.content,
        'Medium',
        'Nota',
        {
          isInCustomRoadmap: true,
          insightSourceMeta: {
            insightId: `note-${note.id}`,
            sourceType: 'note',
            sourceLabel: note.scopeType || 'global',
            moduleId,
            metricsSnapshot: {},
            property: note.trace?.property || '',
            query: note.trace?.query || '',
            url: note.trace?.url || '',
            timestamp: Date.now(),
          },
        },
      );
      togglePinNote(noteId, type);
    },
    [addTask, clients, currentClientId, generalNotes, togglePinNote],
  );

  const updateNote = useCallback(
    (noteId: string, content: string, type: 'project' | 'general') => {
      if (type === 'general') {
        setGeneralNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, content, updatedAt: Date.now() } : n)),
        );
      } else {
        setClients((prev) =>
          prev.map((c) =>
            c.id === currentClientId
              ? {
                  ...c,
                  notes: (c.notes || []).map((n) =>
                    n.id === noteId ? { ...n, content, updatedAt: Date.now() } : n,
                  ),
                }
              : c,
          ),
        );
      }
    },
    [currentClientId],
  );

  const deleteNote = useCallback(
    (noteId: string, type: 'project' | 'general') => {
      if (type === 'general') {
        setGeneralNotes((prev) => prev.filter((n) => n.id !== noteId));
      } else {
        setClients((prev) =>
          prev.map((c) =>
            c.id === currentClientId
              ? { ...c, notes: (c.notes || []).filter((n) => n.id !== noteId) }
              : c,
          ),
        );
      }
    },
    [currentClientId],
  );

  const importData = useCallback((newClients: Client[], newNotes: Note[]) => {
    // Merge Strategy:
    // 1. Clients: Append if ID doesn't exist. Update if ID exists? No, keep existing to avoid overwrite unless explicit.
    // Let's adopt "Keep Existing" strategy for ID collision, append others.

    setClients((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const uniqueNewClients = newClients
        .map((client) => normalizeProjectClientProfile(client))
        .filter((c) => !existingIds.has(c.id));
      return [...prev, ...uniqueNewClients];
    });

    setGeneralNotes((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const uniqueNewNotes = newNotes.filter((n) => !existingIds.has(n.id));
      return [...prev, ...uniqueNewNotes];
    });
    flushSnapshotSyncNextTick(['clients', 'generalNotes']);
  }, [flushSnapshotSyncNextTick]);

  const restoreProjectData = useCallback(
    (backupClients: Client[], backupNotes: Note[], backupCurrentClientId?: string) => {
      setClients((prev) => {
        const backupIds = new Set(backupClients.map((c) => c.id));
        // Keep clients that are NOT in backup (preserves locally created clients not present in backup)
        const keptClients = prev.filter((c) => !backupIds.has(c.id));
        // Add all backup clients (overwriting matches)
        const normalizedBackupClients = backupClients.map((client) =>
          normalizeProjectClientProfile(client),
        );
        return [...keptClients, ...normalizedBackupClients];
      });

      setGeneralNotes((prev) => {
        const backupIds = new Set(backupNotes.map((n) => n.id));
        const keptNotes = prev.filter((n) => !backupIds.has(n.id));
        return [...keptNotes, ...backupNotes];
      });

      if (backupCurrentClientId) {
        // Verify it exists in the new list (it should, we just added it)
        if (backupClients.find((c) => c.id === backupCurrentClientId)) {
          setCurrentClientId(backupCurrentClientId);
        }
      }
      flushSnapshotSyncNextTick(['clients', 'generalNotes', 'currentClientId']);
    },
    [flushSnapshotSyncNextTick],
  );

  const resetCurrentProject = useCallback(() => {
    if (!currentClient) return;
    if (window.confirm('¿Seguro que quieres reiniciar el progreso de ESTE proyecto?')) {
      const strategy = StrategyFactory.getStrategy(currentClient.vertical);
      updateCurrentClientModules(strategy.getModules());
      setClients((prev) => prev.map((c) => (c.id === currentClient.id ? { ...c, templateVersion: strategy.getTemplateVersion() } : c)));
      flushSnapshotSyncNextTick(['clients']);
    }
  }, [currentClient, flushSnapshotSyncNextTick, updateCurrentClientModules]);

  const contextValue = useMemo<ProjectContextType>(
    () => ({
      clients,
      currentClientId,
      currentClient,
      modules,
      globalScore,
      projectScoreContext,
      generalNotes,
      addClient,
      renameClient,
      deleteClient,
      switchClient,
      updateCurrentClientProfile,
      saveClientSnapshot,
      addTask,
      addTasksBulk,
      deleteTask,
      toggleTask,
      updateTaskStatus,
      updateTaskNotes,
      updateTaskImpact,
      updateTaskDetails,
      toggleTaskCommunicated,
      addKanbanColumn,
      deleteKanbanColumn,
      toggleCustomRoadmapTask,
      handleReorderRoadmap,
      addManualCompletedTask,
      deleteCompletedTaskLog,
      updateCompletedTaskImpact,
      updateAIRoadmap,
      saveAIRoadmapGeneration,
      importMultipleAIRoadmapTasks,
      updateIAVisibilityConfig,
      saveIAVisibilityRunResult,
      clearIAVisibilityHistory,
      filterIAVisibilityHistory,
      addNote,
      updateNote,
      deleteNote,
      togglePinNote,
      toggleInternalNote,
      convertNoteToTask,
      importData,
      restoreProjectData,
      resetCurrentProject,
    }),
    [
      clients,
      currentClientId,
      currentClient,
      modules,
      globalScore,
      projectScoreContext,
      generalNotes,
      addClient,
      renameClient,
      deleteClient,
      switchClient,
      updateCurrentClientProfile,
      saveClientSnapshot,
      addTask,
      addTasksBulk,
      deleteTask,
      toggleTask,
      updateTaskStatus,
      updateTaskNotes,
      updateTaskImpact,
      updateTaskDetails,
      toggleTaskCommunicated,
      addKanbanColumn,
      deleteKanbanColumn,
      toggleCustomRoadmapTask,
      handleReorderRoadmap,
      addManualCompletedTask,
      deleteCompletedTaskLog,
      updateCompletedTaskImpact,
      updateAIRoadmap,
      saveAIRoadmapGeneration,
      importMultipleAIRoadmapTasks,
      updateIAVisibilityConfig,
      saveIAVisibilityRunResult,
      clearIAVisibilityHistory,
      filterIAVisibilityHistory,
      addNote,
      updateNote,
      deleteNote,
      togglePinNote,
      toggleInternalNote,
      convertNoteToTask,
      importData,
      restoreProjectData,
      resetCurrentProject,
    ],
  );

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
