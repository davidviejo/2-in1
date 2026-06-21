import { useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import type { Task } from '@/types';

export type AdvancedMethodSignalStatus = 'available' | 'empty' | 'unavailable' | 'not_detectable';

export type AdvancedMethodSignalArea =
  | 'Intelligence'
  | 'Estrategia'
  | 'Acciones'
  | 'Tools Hub'
  | 'Validación';

export interface AdvancedMethodSignal {
  id: string;
  title: string;
  description: string;
  status: AdvancedMethodSignalStatus;
  statusLabel: string;
  value: string;
  detail?: string;
  area: AdvancedMethodSignalArea;
  route?: {
    label: string;
    path: string;
  };
}

export interface AdvancedMethodSignalsSummary {
  available: number;
  empty: number;
  unavailable: number;
  notDetectable: number;
}

export interface AdvancedMethodSignalsContext {
  clientName: string;
  hasActiveClient: boolean;
  summary: AdvancedMethodSignalsSummary;
  signals: AdvancedMethodSignal[];
}

const getStatusLabel = (status: AdvancedMethodSignalStatus) => {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'empty':
      return 'Vacío';
    case 'not_detectable':
      return 'No detectable';
    case 'unavailable':
    default:
      return 'No disponible';
  }
};

const getRoadmapTasks = (tasks: Task[], customRoadmapOrder?: string[]) => {
  const roadmapIds = new Set(customRoadmapOrder || []);
  return tasks.filter((task) => task.isInCustomRoadmap || roadmapIds.has(task.id));
};

const countTaskStatuses = (tasks: Task[]) => {
  const statusCounts = tasks.reduce<Record<string, number>>((acc, task) => {
    const status = task.status || 'sin estado';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([status, count]) => `${status}: ${count}`)
    .join(' · ');
};

export const useAdvancedMethodSignals = (): AdvancedMethodSignalsContext => {
  const { currentClient, currentClientId, generalNotes, modules } = useProject();

  return useMemo(() => {
    const hasActiveClient = Boolean(currentClientId && currentClient);
    const tasks = modules.flatMap((module) => module.tasks || []);
    const completedTasks = currentClient?.completedTasksLog || [];
    const roadmapTasks = getRoadmapTasks(tasks, currentClient?.customRoadmapOrder);
    const aiRoadmapTasks = currentClient?.aiRoadmap || [];
    const projectNotes = currentClient?.notes || [];
    const seoSnapshots = currentClient?.seoSnapshots || [];
    const seoClusters = currentClient?.seoClusters || [];
    const iaVisibilityHistory = currentClient?.iaVisibility?.history || [];
    const iaVisibilityPrompts = currentClient?.iaVisibility?.config?.prompts || [];
    const gscEvidenceCount =
      seoSnapshots.length +
      completedTasks.filter((task) => task.beforeAfter?.trace.source === 'gsc').length;

    const signal = (input: Omit<AdvancedMethodSignal, 'statusLabel'>): AdvancedMethodSignal => ({
      ...input,
      statusLabel: getStatusLabel(input.status),
    });

    const signals: AdvancedMethodSignal[] = [
      signal({
        id: 'active-client',
        title: 'Cliente/proyecto activo',
        description: 'Proyecto que contextualiza la metodología en modo lectura.',
        status: hasActiveClient ? 'available' : 'unavailable',
        value: hasActiveClient
          ? currentClient?.name || 'Proyecto sin nombre'
          : 'Sin cliente activo',
        detail: hasActiveClient
          ? `${currentClient?.projectType || currentClient?.vertical || 'Tipo no definido'} · ${
              currentClient?.sector || 'sector no definido'
            }`
          : 'Selecciona o crea un cliente desde el flujo existente para ver señales reales.',
        area: 'Intelligence',
        route: { label: 'Abrir Dashboard', path: '/app' },
      }),
      signal({
        id: 'tasks',
        title: 'Tareas existentes',
        description: 'Tareas agregadas desde módulos y tableros existentes; no se editan aquí.',
        status: !hasActiveClient ? 'unavailable' : tasks.length > 0 ? 'available' : 'empty',
        value: hasActiveClient ? `${tasks.length} tareas` : 'No disponible',
        detail:
          tasks.length > 0
            ? countTaskStatuses(tasks) || 'Sin desglose de estados'
            : 'Sin tareas detectadas',
        area: 'Acciones',
        route: { label: 'Ver Kanban', path: '/app/kanban' },
      }),
      signal({
        id: 'completed-tasks',
        title: 'Tareas completadas',
        description: 'Histórico de acciones cerradas disponible para validación y aprendizajes.',
        status: !hasActiveClient
          ? 'unavailable'
          : completedTasks.length > 0
            ? 'available'
            : 'empty',
        value: hasActiveClient ? `${completedTasks.length} completadas` : 'No disponible',
        detail:
          completedTasks.length > 0
            ? 'Puede usarse como evidencia read-only para validación.'
            : 'Sin histórico completado en el cliente activo.',
        area: 'Validación',
        route: { label: 'Ver tareas realizadas', path: '/app/completed-tasks' },
      }),
      signal({
        id: 'client-roadmap',
        title: 'Roadmap cliente',
        description: 'Tareas marcadas para roadmap cliente o presentes en el orden personalizado.',
        status: !hasActiveClient ? 'unavailable' : roadmapTasks.length > 0 ? 'available' : 'empty',
        value: hasActiveClient ? `${roadmapTasks.length} items` : 'No disponible',
        detail:
          roadmapTasks.length > 0
            ? 'Disponible para priorización en la sección operativa existente.'
            : 'No hay items de roadmap cliente detectados.',
        area: 'Estrategia',
        route: { label: 'Abrir Roadmap', path: '/app/client-roadmap' },
      }),
      signal({
        id: 'ai-roadmap',
        title: 'Roadmap IA',
        description: 'Propuestas IA guardadas en el cliente activo, si existen.',
        status: !hasActiveClient
          ? 'unavailable'
          : aiRoadmapTasks.length > 0
            ? 'available'
            : 'empty',
        value: hasActiveClient ? `${aiRoadmapTasks.length} propuestas` : 'No disponible',
        detail: currentClient?.aiRoadmapGenerationHistory?.length
          ? `${currentClient.aiRoadmapGenerationHistory.length} generaciones guardadas`
          : 'Sin historial de generación IA detectable.',
        area: 'Estrategia',
        route: { label: 'Abrir Roadmap IA', path: '/app/ai-roadmap' },
      }),
      signal({
        id: 'notes',
        title: 'Notas',
        description: 'Notas de proyecto y notas generales expuestas por el contexto actual.',
        status: !hasActiveClient
          ? 'unavailable'
          : projectNotes.length + generalNotes.length > 0
            ? 'available'
            : 'empty',
        value: hasActiveClient
          ? `${projectNotes.length} proyecto · ${generalNotes.length} generales`
          : 'No disponible',
        detail:
          'Solo lectura desde Metodología; la gestión de notas permanece en su flujo existente.',
        area: 'Validación',
      }),
      signal({
        id: 'seo-snapshots',
        title: 'Snapshots SEO',
        description: 'Capturas de rendimiento disponibles en el cliente activo.',
        status: !hasActiveClient ? 'unavailable' : seoSnapshots.length > 0 ? 'available' : 'empty',
        value: hasActiveClient ? `${seoSnapshots.length} snapshots` : 'No disponible',
        detail:
          seoSnapshots.length > 0
            ? 'Contexto útil para before/after y reporting futuro.'
            : 'No hay snapshots SEO detectados.',
        area: 'Validación',
        route: { label: 'Validar realizadas', path: '/app/completed-tasks' },
      }),
      signal({
        id: 'seo-clusters',
        title: 'Clusters SEO',
        description: 'Clusters configurados en el perfil del cliente, si existen.',
        status: !hasActiveClient ? 'unavailable' : seoClusters.length > 0 ? 'available' : 'empty',
        value: hasActiveClient ? `${seoClusters.length} clusters` : 'No disponible',
        detail:
          seoClusters.length > 0
            ? `${seoClusters.reduce((acc, cluster) => acc + (cluster.urls?.length || 0), 0)} URLs asociadas`
            : 'Sin clusters configurados en el cliente activo.',
        area: 'Intelligence',
        route: { label: 'Auditar en Checklist', path: '/app/checklist' },
      }),
      signal({
        id: 'gsc',
        title: 'GSC / señales de Search Console',
        description: 'Evidencias GSC detectables sin leer tokens ni llamar APIs nuevas.',
        status: !hasActiveClient
          ? 'unavailable'
          : gscEvidenceCount > 0
            ? 'available'
            : 'not_detectable',
        value: hasActiveClient ? `${gscEvidenceCount} evidencias` : 'No disponible',
        detail:
          gscEvidenceCount > 0
            ? 'Detectado por snapshots o análisis before/after con traza GSC.'
            : 'No se detectan señales GSC expuestas de forma limpia en el contexto.',
        area: 'Intelligence',
        route: { label: 'Revisar GSC Impact', path: '/app/gsc-impact' },
      }),
      signal({
        id: 'ia-visibility',
        title: 'IA Visibility',
        description: 'Configuración e histórico de visibilidad IA guardados en cliente.',
        status: !hasActiveClient
          ? 'unavailable'
          : iaVisibilityHistory.length > 0 || iaVisibilityPrompts.length > 0
            ? 'available'
            : 'empty',
        value: hasActiveClient
          ? `${iaVisibilityPrompts.length} prompts · ${iaVisibilityHistory.length} resultados`
          : 'No disponible',
        detail: 'Disponible como contexto estratégico; no se ejecutan prompts desde Metodología.',
        area: 'Intelligence',
        route: { label: 'Abrir Roadmap IA', path: '/app/ai-roadmap' },
      }),
      signal({
        id: 'tools-catalog',
        title: 'Catálogo Tools Hub',
        description: 'Lectura del catálogo real de Tools Hub desde una fuente compartida.',
        status: 'not_detectable',
        value: 'No detectable',
        detail:
          'Tools Hub existe como ruta, pero no expone un catálogo compartido limpio para este panel.',
        area: 'Tools Hub',
        route: { label: 'Abrir Tools Hub', path: '/app/tools-hub' },
      }),
    ];

    const summary = signals.reduce<AdvancedMethodSignalsSummary>(
      (acc, item) => {
        if (item.status === 'available') acc.available += 1;
        if (item.status === 'empty') acc.empty += 1;
        if (item.status === 'unavailable') acc.unavailable += 1;
        if (item.status === 'not_detectable') acc.notDetectable += 1;
        return acc;
      },
      { available: 0, empty: 0, unavailable: 0, notDetectable: 0 },
    );

    return {
      clientName: currentClient?.name || 'Sin cliente activo',
      hasActiveClient,
      summary,
      signals,
    };
  }, [currentClient, currentClientId, generalNotes.length, modules]);
};
