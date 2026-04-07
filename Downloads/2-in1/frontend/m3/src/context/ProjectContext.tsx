import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import {
  Client,
  ClientVertical,
  Note,
  ModuleData,
  CompletedTask,
  Task,
  TaskStatus,
  IAVisibilityPromptConfig,
  IAVisibilityRunResult,
  createDefaultIAVisibilityState,
} from '../types';
import { ClientRepository } from '../services/clientRepository';
import { ProjectRemoteRepository } from '../services/projectRemoteRepository';
import { StrategyFactory } from '../strategies/StrategyFactory';
import { DEFAULT_KANBAN_COLUMNS } from '../config/kanban';

interface ProjectContextType {
  clients: Client[];
  currentClientId: string;
  currentClient: Client | null;
  modules: ModuleData[];
  globalScore: number;
  generalNotes: Note[];

  // Actions
  addClient: (name: string, vertical: ClientVertical) => void;
  deleteClient: (id: string) => void;
  switchClient: (id: string) => void;

  // Task Actions
  addTask: (
    moduleId: number,
    title: string,
    description: string,
    impact: 'High' | 'Medium' | 'Low',
    category: string,
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

  // Notes Actions
  addNote: (content: string, type: 'project' | 'general') => void;
  updateNote: (noteId: string, content: string, type: 'project' | 'general') => void;
  deleteNote: (noteId: string, type: 'project' | 'general') => void;

  // AI Roadmap Actions
  updateAIRoadmap: (tasks: Task[]) => void;
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

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  // --- Derived State ---

  const currentClient = useMemo(
    () => clients.find((c) => c.id === currentClientId) || clients[0] || null,
    [clients, currentClientId],
  );
  const modules = useMemo(() => (currentClient ? currentClient.modules : []), [currentClient]);

  // --- Derived State for Score ---
  const globalScore = useMemo(() => {
    if (!modules) {
      return 0;
    }
    let totalTasks = 0;
    let completedTasks = 0;

    modules.forEach((m) => {
      totalTasks += m.tasks.length;
      completedTasks += m.tasks.filter((t) => t.status === 'completed').length;
    });

    return totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  }, [modules]);

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

    const syncSnapshot = async () => {
      try {
        await ProjectRemoteRepository.saveSnapshot({
          clients,
          generalNotes,
          currentClientId,
        });
      } catch (error) {
        if ((error as Error).message !== 'version_conflict') {
          console.warn('Project sync failed; keeping local cache.', error);
        }
      }
    };

    syncSnapshot();
  }, [clients, generalNotes, currentClientId, isHydrated]);

  // --- Actions ---

  const addClient = useCallback((name: string, vertical: ClientVertical) => {
    const strategy = StrategyFactory.getStrategy(vertical);
    const initialModules = strategy.getModules();
    const templateVersion = strategy.getTemplateVersion();

    const newClient: Client = {
      id: crypto.randomUUID(),
      name,
      vertical,
      modules: initialModules, // Deep copy handled in Strategy
      templateVersion,
      createdAt: Date.now(),
      notes: [],
      completedTasksLog: [],
      customRoadmapOrder: [],
      iaVisibility: createDefaultIAVisibilityState(),
    };
    setClients((prev) => [...prev, newClient]);
    setCurrentClientId(newClient.id);
  }, []);

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
    },
    [clients, currentClientId],
  );

  const switchClient = useCallback((id: string) => {
    setCurrentClientId(id);
  }, []);

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
    ) => {
      const newModules = modules.map((m) => {
        if (m.id !== moduleId) return m;
        const newTask: any = {
          id: `custom-${Date.now()}`,
          title,
          description,
          impact,
          status: 'pending',
          category,
          isCustom: true,
        };
        return {
          ...m,
          tasks: [...m.tasks, newTask],
        };
      });
      updateCurrentClientModules(newModules);
    },
    [modules, updateCurrentClientModules],
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
          const currentColumns = c.kanbanColumns || DEFAULT_KANBAN_COLUMNS;
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
          const currentColumns = c.kanbanColumns || DEFAULT_KANBAN_COLUMNS;
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

  const addNote = useCallback(
    (content: string, type: 'project' | 'general') => {
      const newNote: Note = {
        id: crypto.randomUUID(),
        content,
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
        .map((client) => ({ ...client, iaVisibility: client.iaVisibility || createDefaultIAVisibilityState() }))
        .filter((c) => !existingIds.has(c.id));
      return [...prev, ...uniqueNewClients];
    });

    setGeneralNotes((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const uniqueNewNotes = newNotes.filter((n) => !existingIds.has(n.id));
      return [...prev, ...uniqueNewNotes];
    });
  }, []);

  const restoreProjectData = useCallback(
    (backupClients: Client[], backupNotes: Note[], backupCurrentClientId?: string) => {
      setClients((prev) => {
        const backupIds = new Set(backupClients.map((c) => c.id));
        // Keep clients that are NOT in backup (preserves locally created clients not present in backup)
        const keptClients = prev.filter((c) => !backupIds.has(c.id));
        // Add all backup clients (overwriting matches)
        const normalizedBackupClients = backupClients.map((client) => ({
          ...client,
          iaVisibility: client.iaVisibility || createDefaultIAVisibilityState(),
        }));
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
    },
    [],
  );

  const resetCurrentProject = useCallback(() => {
    if (!currentClient) return;
    if (window.confirm('¿Seguro que quieres reiniciar el progreso de ESTE proyecto?')) {
      const strategy = StrategyFactory.getStrategy(currentClient.vertical);
      updateCurrentClientModules(strategy.getModules());
      setClients((prev) => prev.map((c) => (c.id === currentClient.id ? { ...c, templateVersion: strategy.getTemplateVersion() } : c)));
    }
  }, [currentClient, updateCurrentClientModules]);

  const contextValue = useMemo<ProjectContextType>(
    () => ({
      clients,
      currentClientId,
      currentClient,
      modules,
      globalScore,
      generalNotes,
      addClient,
      deleteClient,
      switchClient,
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
      updateAIRoadmap,
      importMultipleAIRoadmapTasks,
      updateIAVisibilityConfig,
      saveIAVisibilityRunResult,
      clearIAVisibilityHistory,
      filterIAVisibilityHistory,
      addNote,
      updateNote,
      deleteNote,
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
      generalNotes,
      addClient,
      deleteClient,
      switchClient,
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
      updateAIRoadmap,
      importMultipleAIRoadmapTasks,
      updateIAVisibilityConfig,
      saveIAVisibilityRunResult,
      clearIAVisibilityHistory,
      filterIAVisibilityHistory,
      addNote,
      updateNote,
      deleteNote,
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
