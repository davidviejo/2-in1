import { useMemo } from 'react';
import { AdvancedMethodSignal, useAdvancedMethodSignals } from '@/hooks/useAdvancedMethodSignals';
import { useToolsCatalogReconciliation } from '@/hooks/useToolsCatalogReconciliation';
import { useToolsCatalogSignals } from '@/hooks/useToolsCatalogSignals';

export type AdvancedMethodPriorityLevel = 'low' | 'medium' | 'high';
export type AdvancedMethodReadiness = 'ready' | 'partial' | 'blocked';
export type AdvancedMethodRecommendationCategory =
  | 'intelligence'
  | 'strategy'
  | 'actions'
  | 'tools'
  | 'validation'
  | 'reporting';
export type AdvancedMethodConfidence = 'low' | 'medium' | 'high';

export interface AdvancedMethodRecommendation {
  id: string;
  title: string;
  description: string;
  impact: AdvancedMethodPriorityLevel;
  effort: AdvancedMethodPriorityLevel;
  readiness: AdvancedMethodReadiness;
  category: AdvancedMethodRecommendationCategory;
  reason: string;
  missingSignals: string[];
  recommendedRoute: string;
  recommendedCtaLabel: string;
  confidence: AdvancedMethodConfidence;
}

export interface AdvancedMethodPrioritizationSummary {
  total: number;
  ready: number;
  partial: number;
  blocked: number;
  highImpact: number;
  lowEffort: number;
}

export interface AdvancedMethodPrioritizationResult {
  recommendations: AdvancedMethodRecommendation[];
  summary: AdvancedMethodPrioritizationSummary;
}

const isAvailable = (signal?: AdvancedMethodSignal) => signal?.status === 'available';
const isMissing = (signal?: AdvancedMethodSignal) =>
  !signal ||
  signal.status === 'empty' ||
  signal.status === 'unavailable' ||
  signal.status === 'not_detectable';

const getSignal = (signals: AdvancedMethodSignal[], id: string) =>
  signals.find((signal) => signal.id === id);

const createRecommendation = (
  recommendation: AdvancedMethodRecommendation,
): AdvancedMethodRecommendation => recommendation;

export const useAdvancedMethodPrioritization = (): AdvancedMethodPrioritizationResult => {
  const { hasActiveClient, signals } = useAdvancedMethodSignals();
  const toolsSignals = useToolsCatalogSignals();
  const reconciliation = useToolsCatalogReconciliation();

  return useMemo(() => {
    const activeClient = getSignal(signals, 'active-client');
    const tasks = getSignal(signals, 'tasks');
    const completedTasks = getSignal(signals, 'completed-tasks');
    const clientRoadmap = getSignal(signals, 'client-roadmap');
    const aiRoadmap = getSignal(signals, 'ai-roadmap');
    const snapshots = getSignal(signals, 'seo-snapshots');
    const clusters = getSignal(signals, 'seo-clusters');
    const gsc = getSignal(signals, 'gsc');
    const iaVisibility = getSignal(signals, 'ia-visibility');
    const toolsCatalog = getSignal(signals, 'tools-catalog');

    const recommendations: AdvancedMethodRecommendation[] = [];

    // Regla base: sin cliente activo no se debe inferir prioridad operativa.
    if (!hasActiveClient || isMissing(activeClient)) {
      recommendations.push(
        createRecommendation({
          id: 'select-active-client',
          title: 'Seleccionar proyecto antes de priorizar',
          description:
            'El método necesita un cliente/proyecto activo para convertir señales reales en recomendaciones accionables.',
          impact: 'high',
          effort: 'low',
          readiness: 'blocked',
          category: 'intelligence',
          reason: 'No hay contexto activo suficiente para calcular prioridades fiables.',
          missingSignals: ['Cliente/proyecto activo'],
          recommendedRoute: '/app',
          recommendedCtaLabel: 'Abrir Dashboard',
          confidence: 'high',
        }),
      );
    }

    // Regla A/B: las tareas existentes necesitan roadmap para ejecución ordenada.
    if (isAvailable(tasks) && isAvailable(clientRoadmap)) {
      recommendations.push(
        createRecommendation({
          id: 'execute-from-existing-roadmap',
          title: 'Priorizar ejecución desde roadmap existente',
          description:
            'Hay tareas y roadmap cliente disponibles; la siguiente decisión metodológica es ordenar ejecución sin crear otro tablero paralelo.',
          impact: 'high',
          effort: 'low',
          readiness: 'ready',
          category: 'strategy',
          reason:
            'Tareas existentes y roadmap cliente ya están disponibles en las áreas operativas.',
          missingSignals: [],
          recommendedRoute: '/app/client-roadmap',
          recommendedCtaLabel: 'Priorizar en Roadmap',
          confidence: 'high',
        }),
      );
    } else if (isAvailable(tasks) && isMissing(clientRoadmap)) {
      recommendations.push(
        createRecommendation({
          id: 'order-tasks-before-execution',
          title: 'Ordenar tareas en roadmap antes de ejecutar',
          description:
            'Hay tareas detectadas, pero no roadmap cliente disponible; conviene priorizar antes de mover ejecución a Kanban/Gantt.',
          impact: 'high',
          effort: 'medium',
          readiness: 'partial',
          category: 'strategy',
          reason: 'Existe backlog de tareas, pero falta una secuencia estratégica visible.',
          missingSignals: ['Roadmap cliente con items'],
          recommendedRoute: '/app/client-roadmap',
          recommendedCtaLabel: 'Abrir Roadmap Cliente',
          confidence: 'medium',
        }),
      );
    } else if (hasActiveClient && isMissing(tasks)) {
      recommendations.push(
        createRecommendation({
          id: 'build-actionable-backlog',
          title: 'Crear backlog accionable antes del scoring operativo',
          description:
            'No hay tareas detectadas; priorizar impacto/esfuerzo requiere primero convertir hallazgos en acciones existentes.',
          impact: 'medium',
          effort: 'medium',
          readiness: 'blocked',
          category: 'actions',
          reason: 'Sin tareas no hay unidad operativa para ordenar ejecución.',
          missingSignals: ['Tareas existentes'],
          recommendedRoute: '/app/checklist',
          recommendedCtaLabel: 'Auditar en Checklist',
          confidence: 'medium',
        }),
      );
    }

    // Regla C: snapshots o tareas completadas habilitan validación before/after.
    if (isAvailable(snapshots) || isAvailable(completedTasks)) {
      recommendations.push(
        createRecommendation({
          id: 'validate-before-after-impact',
          title: 'Validar impacto before/after',
          description:
            'Hay evidencias de ejecución o snapshots; el método puede orientar validación sin tocar tareas ni reportes.',
          impact: 'high',
          effort: 'low',
          readiness: 'ready',
          category: 'validation',
          reason:
            'Snapshots o tareas completadas permiten revisar impacto de acciones ya realizadas.',
          missingSignals: [],
          recommendedRoute: '/app/completed-tasks',
          recommendedCtaLabel: 'Validar tareas realizadas',
          confidence: 'high',
        }),
      );
    }

    // Regla D: clusters existentes pueden orientar contenidos y enlazado.
    if (isAvailable(clusters)) {
      recommendations.push(
        createRecommendation({
          id: 'use-clusters-for-content-priority',
          title: 'Usar clusters para priorizar contenidos y enlazado',
          description:
            'Los clusters disponibles ayudan a ordenar oportunidades de contenido, enlazado interno y auditoría temática.',
          impact: 'high',
          effort: 'medium',
          readiness: 'ready',
          category: 'intelligence',
          reason: 'Hay clusters SEO configurados en el perfil del cliente activo.',
          missingSignals: [],
          recommendedRoute: '/app/checklist',
          recommendedCtaLabel: 'Auditar clusters',
          confidence: 'medium',
        }),
      );
    }

    // Regla E: sin GSC detectable, bloquear priorización por rendimiento.
    if (isMissing(gsc)) {
      recommendations.push(
        createRecommendation({
          id: 'review-gsc-before-performance-priority',
          title: 'Revisar datos GSC antes de priorizar por rendimiento',
          description:
            'No hay evidencias GSC detectables en las señales read-only; evita priorizar por caída/crecimiento sin datos fiables.',
          impact: 'high',
          effort: 'medium',
          readiness: hasActiveClient ? 'partial' : 'blocked',
          category: 'intelligence',
          reason:
            'La señal GSC está vacía, no disponible o no detectable desde el contexto limpio.',
          missingSignals: ['Evidencias GSC'],
          recommendedRoute: '/app/gsc-impact',
          recommendedCtaLabel: 'Revisar GSC Impact',
          confidence: 'high',
        }),
      );
    }

    // Regla F: IA Visibility disponible puede cruzarse con estrategia de contenidos.
    if (isAvailable(iaVisibility)) {
      recommendations.push(
        createRecommendation({
          id: 'cross-ai-visibility-with-content-strategy',
          title: 'Cruzar visibilidad IA con estrategia de contenidos',
          description:
            'La visibilidad IA disponible puede informar temas, entidades y gaps antes de generar nuevas iniciativas.',
          impact: 'medium',
          effort: 'medium',
          readiness: 'ready',
          category: 'strategy',
          reason: 'Hay prompts o resultados de IA Visibility guardados en el cliente activo.',
          missingSignals: [],
          recommendedRoute: '/app/ai-roadmap',
          recommendedCtaLabel: 'Abrir Roadmap IA',
          confidence: 'medium',
        }),
      );
    } else if (isAvailable(aiRoadmap)) {
      recommendations.push(
        createRecommendation({
          id: 'review-ai-roadmap-context',
          title: 'Revisar Roadmap IA como apoyo estratégico',
          description:
            'Hay propuestas IA disponibles; úsalas como insumo de decisión, no como ejecución automática.',
          impact: 'medium',
          effort: 'low',
          readiness: 'ready',
          category: 'strategy',
          reason: 'Roadmap IA tiene propuestas guardadas aunque IA Visibility no esté activa.',
          missingSignals: [],
          recommendedRoute: '/app/ai-roadmap',
          recommendedCtaLabel: 'Revisar Roadmap IA',
          confidence: 'medium',
        }),
      );
    }

    // Regla G: el catálogo compartido permite recomendaciones reales de gobierno de herramientas.
    if (isAvailable(toolsCatalog) && toolsSignals.p1ReadOnlySafe > 0) {
      recommendations.push(
        createRecommendation({
          id: 'prioritize-safe-p1-tools',
          title: 'Priorizar integración metodológica de herramientas P1 seguras',
          description:
            'Hay herramientas P1 read-only safe en el catálogo compartido; pueden conectarse al método sin ejecución automática.',
          impact: 'high',
          effort: 'medium',
          readiness: 'ready',
          category: 'tools',
          reason: `${toolsSignals.p1ReadOnlySafe} herramientas P1 son seguras en modo lectura y ya tienen ruta recomendada.`,
          missingSignals: [],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Gobernar en Tools Hub',
          confidence: 'high',
        }),
      );
    }

    if (isAvailable(toolsCatalog) && toolsSignals.candidateOrPlanned >= 6) {
      recommendations.push(
        createRecommendation({
          id: 'order-tools-backlog-before-automation',
          title: 'Ordenar backlog de herramientas antes de automatizar',
          description:
            'El catálogo contiene varias herramientas candidatas o planificadas; conviene priorizar gobierno antes de Cola SEO.',
          impact: 'medium',
          effort: 'medium',
          readiness: 'partial',
          category: 'tools',
          reason: `${toolsSignals.candidateOrPlanned} herramientas están en estado candidate/planned.`,
          missingSignals: ['Scoring operativo por ownership y dependencias'],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Revisar catálogo',
          confidence: 'medium',
        }),
      );
    }

    if (isAvailable(toolsCatalog) && toolsSignals.queueWithoutDryRun > 0) {
      recommendations.push(
        createRecommendation({
          id: 'define-dry-run-before-seo-queue',
          title: 'Definir dry-run antes de incluir herramientas en Cola SEO',
          description:
            'Algunas herramientas están marcadas como aptas para cola futura, pero todavía no soportan dry-run.',
          impact: 'high',
          effort: 'medium',
          readiness: 'partial',
          category: 'tools',
          reason: `${toolsSignals.queueWithoutDryRun} herramientas podrían entrar en cola sin dry-run definido.`,
          missingSignals: ['Contrato dry-run por herramienta'],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Revisar guardrails',
          confidence: 'high',
        }),
      );
    }

    if (isAvailable(toolsCatalog) && toolsSignals.requiresHumanReview > 0) {
      recommendations.push(
        createRecommendation({
          id: 'define-human-review-policy',
          title: 'Marcar políticas de revisión humana antes de ejecución asistida',
          description:
            'El catálogo identifica herramientas que requieren revisión humana; esto debe gobernarse antes de automatizar.',
          impact: 'high',
          effort: 'medium',
          readiness: 'partial',
          category: 'tools',
          reason: `${toolsSignals.requiresHumanReview} herramientas requieren revisión humana explícita.`,
          missingSignals: ['Política de aprobación por herramienta'],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Definir políticas',
          confidence: 'high',
        }),
      );
    }

    if (isMissing(toolsCatalog)) {
      recommendations.push(
        createRecommendation({
          id: 'prepare-shared-tools-catalog-source',
          title: 'Preparar fuente compartida para catálogo Tools Hub',
          description:
            'Antes de scoring real de herramientas, conviene exponer el catálogo desde una fuente compartida y testeable.',
          impact: 'medium',
          effort: 'high',
          readiness: 'blocked',
          category: 'tools',
          reason: 'Tools Hub no expone una señal de catálogo reutilizable para Metodología.',
          missingSignals: ['Catálogo compartido de Tools Hub'],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Abrir Tools Hub',
          confidence: 'high',
        }),
      );
    }

    // Regla H: reconciliación entre catálogo metodológico, backend y launcher antes de automatizar.
    if (reconciliation.summary.criticalDivergences > 0) {
      recommendations.push(
        createRecommendation({
          id: 'resolve-tools-catalog-consistency',
          title: 'Resolver consistencia del catálogo antes de automatizar',
          description:
            'Hay divergencias entre catálogo metodológico, backend o launcher; conviene resolverlas antes de diseñar Cola SEO.',
          impact: 'high',
          effort: 'medium',
          readiness: 'partial',
          category: 'tools',
          reason: `${reconciliation.summary.criticalDivergences} divergencias críticas detectadas en la reconciliación read-only.`,
          missingSignals: ['Catálogo reconciliado sin divergencias críticas'],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Revisar consistencia',
          confidence: 'high',
        }),
      );
    }

    if (
      reconciliation.summary.consistencyLevel === 'high' &&
      toolsSignals.readyForDryRun > 0 &&
      toolsSignals.readOnlySafe > 0
    ) {
      recommendations.push(
        createRecommendation({
          id: 'prepare-tools-for-seo-queue-dry-run',
          title: 'Preparar selección de herramientas candidatas para Cola SEO dry-run',
          description:
            'La consistencia del catálogo es alta y ya hay herramientas seguras con dry-run para diseñar una fase de simulación.',
          impact: 'high',
          effort: 'medium',
          readiness: 'partial',
          category: 'tools',
          reason: `${toolsSignals.readyForDryRun} herramientas soportan dry-run y ${toolsSignals.readOnlySafe} son read-only safe.`,
          missingSignals: ['Diseño de Cola SEO dry-run'],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Preparar selección',
          confidence: 'medium',
        }),
      );
    }

    if (reconciliation.summary.backendOnly > 0) {
      recommendations.push(
        createRecommendation({
          id: 'classify-backend-only-tools',
          title: 'Clasificar herramientas backend dentro del gobierno metodológico',
          description:
            'Existen herramientas operativas detectadas solo en backend; deben clasificarse antes de aparecer en metodología.',
          impact: 'medium',
          effort: 'medium',
          readiness: 'partial',
          category: 'tools',
          reason: `${reconciliation.summary.backendOnly} herramientas aparecen solo en catálogo backend.`,
          missingSignals: ['Clasificación metodológica de herramientas backend'],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Clasificar backend',
          confidence: 'medium',
        }),
      );
    }

    if (reconciliation.summary.methodologyOnly > 0) {
      recommendations.push(
        createRecommendation({
          id: 'validate-methodology-only-tools',
          title:
            'Validar si herramientas planificadas deben implementarse o mantenerse como backlog',
          description:
            'Hay herramientas solo en metodología; deben validarse como candidatas reales, backlog o no disponibles.',
          impact: 'medium',
          effort: 'medium',
          readiness: 'partial',
          category: 'tools',
          reason: `${reconciliation.summary.methodologyOnly} herramientas están solo en el catálogo metodológico.`,
          missingSignals: ['Decisión de implementación o backlog por herramienta'],
          recommendedRoute: '/app/tools-hub',
          recommendedCtaLabel: 'Validar backlog',
          confidence: 'medium',
        }),
      );
    }

    const summary = recommendations.reduce<AdvancedMethodPrioritizationSummary>(
      (acc, recommendation) => {
        acc.total += 1;
        if (recommendation.readiness === 'ready') acc.ready += 1;
        if (recommendation.readiness === 'partial') acc.partial += 1;
        if (recommendation.readiness === 'blocked') acc.blocked += 1;
        if (recommendation.impact === 'high') acc.highImpact += 1;
        if (recommendation.effort === 'low') acc.lowEffort += 1;
        return acc;
      },
      { total: 0, ready: 0, partial: 0, blocked: 0, highImpact: 0, lowEffort: 0 },
    );

    return { recommendations, summary };
  }, [hasActiveClient, reconciliation, signals, toolsSignals]);
};
