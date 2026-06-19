export type AdvancedMethodArea =
  | 'Intelligence'
  | 'Estrategia'
  | 'Acciones'
  | 'Tools Hub'
  | 'Workflow';

export type AdvancedMethodLevel = 'Alto' | 'Medio' | 'Bajo';

export interface AdvancedMethodRouteLink {
  label: string;
  path: string;
  area: AdvancedMethodArea;
}

export interface AdvancedMethodPhase {
  id: string;
  title: string;
  objective: string;
  entryCriteria: string[];
  exitCriteria: string[];
  relatedRoutes: AdvancedMethodRouteLink[];
  recommendedActions: string[];
  relatedTools: string[];
  expectedDeliverables: string[];
  risksAndCheckpoints: string[];
  futureWorkflows: string[];
}

export interface AdvancedToolCandidate {
  id: string;
  name: string;
  seoImpact: AdvancedMethodLevel;
  technicalDifficulty: AdvancedMethodLevel;
  dependencies: string[];
  risk: AdvancedMethodLevel;
  existingCodeReuse: AdvancedMethodLevel;
  suggestedPriority: 'P1' | 'P2' | 'P3';
  shouldLiveIn: AdvancedMethodArea;
  description: string;
}

export interface AdvancedMethodNavigationItem {
  title: string;
  description: string;
  route: AdvancedMethodRouteLink;
}

export interface FutureWorkflowExample {
  title: string;
  statusLabel: string;
  steps: string[];
}

export const advancedMethodOverview = {
  title: 'Método SEO Avanzado 2026',
  subtitle:
    'Framework transversal para conectar diagnóstico, decisión estratégica, ejecución, herramientas y validación sin duplicar módulos existentes.',
  principles: [
    'Metodología documenta criterios, fases y estándares; no ejecuta acciones reales.',
    'Estrategia prioriza decisiones y roadmap usando rutas ya existentes.',
    'Acciones centraliza ejecución en Kanban, Gantt y tareas realizadas.',
    'Tools Hub gobierna herramientas candidatas, beta, migradas y futuras.',
    'Intelligence concentra datos, GSC, clustering, indexación, señales y oportunidades.',
  ],
} as const;

export const advancedMethodNavigation: AdvancedMethodNavigationItem[] = [
  {
    title: 'Diagnóstico avanzado',
    description:
      'Lectura de señales, auditoría, clustering, GSC e indexación para detectar oportunidades.',
    route: {
      label: 'Intelligence / Checklist / GSC Impact',
      path: '/app/checklist',
      area: 'Intelligence',
    },
  },
  {
    title: 'Decisión estratégica',
    description: 'Priorización, business cases, roadmap cliente y roadmap asistido por IA.',
    route: { label: 'Roadmap Cliente', path: '/app/client-roadmap', area: 'Estrategia' },
  },
  {
    title: 'Roadmap IA',
    description: 'Generación y refinamiento de propuestas antes de convertirlas en ejecución.',
    route: { label: 'Roadmap IA', path: '/app/ai-roadmap', area: 'Estrategia' },
  },
  {
    title: 'Ejecución',
    description: 'Trabajo operativo en tareas, estados, responsables y fechas.',
    route: { label: 'Kanban', path: '/app/kanban', area: 'Acciones' },
  },
  {
    title: 'Planificación temporal',
    description: 'Secuencia, progreso, fechas comprometidas y coordinación del delivery.',
    route: { label: 'Gantt', path: '/app/gantt', area: 'Acciones' },
  },
  {
    title: 'Validación',
    description: 'Histórico de acciones, impacto before/after y entregables realizados.',
    route: {
      label: 'Tareas realizadas / snapshots',
      path: '/app/completed-tasks',
      area: 'Acciones',
    },
  },
  {
    title: 'Herramientas',
    description: 'Catálogo, runtime, estado, scoring futuro y gobierno de herramientas.',
    route: { label: 'Tools Hub', path: '/app/tools-hub', area: 'Tools Hub' },
  },
  {
    title: 'Automatización futura',
    description: 'Preparación conceptual para Cola SEO con dry-run, logs y revisión humana.',
    route: { label: 'Acciones / futura Cola SEO', path: '/app/kanban', area: 'Workflow' },
  },
];

export const advancedMethodPhases: AdvancedMethodPhase[] = [
  {
    id: 'diagnostico',
    title: 'Diagnóstico avanzado',
    objective:
      'Construir una lectura fiable del estado SEO combinando GSC, auditoría técnica, contenidos, clusters e indexación.',
    entryCriteria: [
      'Cliente/proyecto seleccionado',
      'Propiedad GSC o dataset cargado',
      'URLs o secciones críticas identificadas',
    ],
    exitCriteria: [
      'Oportunidades priorizadas',
      'Riesgos críticos documentados',
      'Insights accionables vinculados a rutas operativas',
    ],
    relatedRoutes: [
      { label: 'Dashboard', path: '/app', area: 'Intelligence' },
      { label: 'Checklist', path: '/app/checklist', area: 'Intelligence' },
      { label: 'GSC Impact', path: '/app/gsc-impact', area: 'Intelligence' },
    ],
    recommendedActions: [
      'Revisar caída/crecimiento por URL y query',
      'Cruzar clusters con rendimiento',
      'Detectar problemas de indexación',
    ],
    relatedTools: [
      'Monitor de indexación',
      'Detector de canibalización',
      'Matriz URL + KW + Title + Meta',
    ],
    expectedDeliverables: [
      'Mapa de oportunidades',
      'Lista de riesgos',
      'Snapshot inicial de rendimiento',
    ],
    risksAndCheckpoints: [
      'Evitar conclusiones con datos parciales',
      'Validar períodos comparables',
      'Separar marca y no marca',
    ],
    futureWorkflows: ['Auditoría mensual avanzada', 'Detección automática de pérdidas por cluster'],
  },
  {
    id: 'estrategia',
    title: 'Decisión estratégica',
    objective:
      'Traducir señales en prioridades, business cases, hitos y secuencia de roadmap sin crear un roadmap paralelo.',
    entryCriteria: [
      'Insights abiertos',
      'Objetivos de negocio claros',
      'Capacidad de ejecución estimada',
    ],
    exitCriteria: ['Roadmap priorizado', 'Hitos definidos', 'Decisiones y supuestos documentados'],
    relatedRoutes: [
      { label: 'Roadmap Cliente', path: '/app/client-roadmap', area: 'Estrategia' },
      { label: 'Roadmap IA', path: '/app/ai-roadmap', area: 'Estrategia' },
      { label: 'Detalle de módulos', path: '/app/module/1', area: 'Estrategia' },
    ],
    recommendedActions: [
      'Calcular impacto/esfuerzo',
      'Definir quick wins y apuestas estructurales',
      'Enviar tareas al roadmap existente',
    ],
    relatedTools: [
      'Priorizador impacto/esfuerzo',
      'Generador de briefs IA',
      'Análisis de gaps de contenido',
    ],
    expectedDeliverables: [
      'Roadmap trimestral',
      'Business case por bloque',
      'Decisiones estratégicas registradas',
    ],
    risksAndCheckpoints: [
      'No mezclar hipótesis con tareas aprobadas',
      'Revisar dependencias antes de prometer fechas',
    ],
    futureWorkflows: ['Priorización asistida por scoring', 'Generación de roadmap de 90 días'],
  },
  {
    id: 'ejecucion',
    title: 'Ejecución controlada',
    objective:
      'Convertir prioridades en tareas trazables con responsables, estados, fechas y validación posterior.',
    entryCriteria: [
      'Tareas priorizadas',
      'Responsables definidos',
      'Dependencias principales revisadas',
    ],
    exitCriteria: ['Tareas en Kanban/Gantt', 'Bloqueos visibles', 'Entregables en seguimiento'],
    relatedRoutes: [
      { label: 'Kanban', path: '/app/kanban', area: 'Acciones' },
      { label: 'Gantt', path: '/app/gantt', area: 'Acciones' },
      { label: 'Tareas realizadas', path: '/app/completed-tasks', area: 'Acciones' },
    ],
    recommendedActions: [
      'Mover tareas por estado real',
      'Asignar fechas y responsables',
      'Registrar notas de ejecución',
    ],
    relatedTools: [
      'Control before/after',
      'Generador de informes',
      'Recomendador de enlazado interno',
    ],
    expectedDeliverables: ['Tablero actualizado', 'Plan temporal visible', 'Histórico de acciones'],
    risksAndCheckpoints: [
      'No automatizar cambios sensibles',
      'Mantener trazabilidad de decisiones',
      'Revisar bloqueos semanalmente',
    ],
    futureWorkflows: ['Cola SEO en dry-run', 'Creación asistida de tareas desde hallazgos'],
  },
  {
    id: 'gobierno-tools',
    title: 'Gobierno de herramientas',
    objective:
      'Clasificar herramientas por impacto, dificultad, riesgo, reutilización y ubicación natural dentro del producto.',
    entryCriteria: [
      'Catálogo revisado',
      'Dependencias y credenciales identificadas',
      'Estado legacy/migrada/beta conocido',
    ],
    exitCriteria: [
      'Radar de herramientas priorizado',
      'Candidatas por fase',
      'Riesgos de ejecución documentados',
    ],
    relatedRoutes: [{ label: 'Tools Hub', path: '/app/tools-hub', area: 'Tools Hub' }],
    recommendedActions: [
      'Etiquetar herramientas candidatas',
      'Definir ownership por área',
      'Separar tool, workflow y módulo Intelligence',
    ],
    relatedTools: ['Validador de schema', 'Clusterizador SERP/KW', 'CRM de link building'],
    expectedDeliverables: [
      'Radar de herramientas',
      'Backlog de integración',
      'Criterios de seguridad',
    ],
    risksAndCheckpoints: [
      'No lanzar tools sin dry-run si modifican datos',
      'Controlar credenciales y cuotas',
    ],
    futureWorkflows: ['Scoring de herramientas en Tools Hub', 'Lanzador de workflows aprobados'],
  },
  {
    id: 'validacion',
    title: 'Validación y mejora continua',
    objective:
      'Medir impacto, cerrar entregables, aprender de resultados y preparar el siguiente ciclo del método.',
    entryCriteria: [
      'Acciones completadas',
      'Ventana de medición suficiente',
      'Snapshot o baseline disponible',
    ],
    exitCriteria: [
      'Before/after evaluado',
      'Entregable preparado',
      'Aprendizajes convertidos en nuevos insights',
    ],
    relatedRoutes: [
      { label: 'Tareas realizadas', path: '/app/completed-tasks', area: 'Acciones' },
      { label: 'GSC Impact', path: '/app/gsc-impact', area: 'Intelligence' },
      { label: 'Tools Hub', path: '/app/tools-hub', area: 'Tools Hub' },
    ],
    recommendedActions: [
      'Comparar baseline vs post acción',
      'Documentar aprendizajes',
      'Reabrir oportunidades si no hay mejora',
    ],
    relatedTools: ['Control before/after', 'Generador de informes', 'GEO/AEO/LLMs'],
    expectedDeliverables: [
      'Informe mensual',
      'Registro before/after',
      'Backlog de mejora continua',
    ],
    risksAndCheckpoints: [
      'No atribuir impacto sin ventana suficiente',
      'Diferenciar estacionalidad, marca y cambios externos',
    ],
    futureWorkflows: ['Reporte mensual asistido', 'Validación automática de impacto por tarea'],
  },
];

export const advancedToolCandidates: AdvancedToolCandidate[] = [
  {
    id: 'cannibalization-detector',
    name: 'Detector de canibalización',
    seoImpact: 'Alto',
    technicalDifficulty: 'Medio',
    dependencies: ['GSC queries/pages', 'clusters', 'reglas de intención'],
    risk: 'Medio',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Intelligence',
    description:
      'Detecta URLs que compiten por las mismas consultas y propone consolidación o diferenciación.',
  },
  {
    id: 'internal-linking-recommender',
    name: 'Recomendador de enlazado interno',
    seoImpact: 'Alto',
    technicalDifficulty: 'Alto',
    dependencies: ['crawler', 'link graph', 'clusters', 'prioridad de URLs'],
    risk: 'Medio',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Workflow',
    description:
      'Propone enlaces internos seguros a partir de arquitectura, clusters y oportunidades.',
  },
  {
    id: 'indexation-monitor',
    name: 'Monitor de indexación',
    seoImpact: 'Alto',
    technicalDifficulty: 'Medio',
    dependencies: ['GSC inspection', 'sitemap', 'crawler'],
    risk: 'Alto',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Intelligence',
    description: 'Monitoriza URLs sin indexar, cambios de cobertura y prioridades de revisión.',
  },
  {
    id: 'serp-kw-clusterizer',
    name: 'Clusterizador SERP/KW',
    seoImpact: 'Alto',
    technicalDifficulty: 'Alto',
    dependencies: ['SERP provider', 'keywords', 'similaridad semántica'],
    risk: 'Medio',
    existingCodeReuse: 'Medio',
    suggestedPriority: 'P2',
    shouldLiveIn: 'Intelligence',
    description: 'Agrupa keywords por similitud SERP e intención para estrategia de contenidos.',
  },
  {
    id: 'ai-brief-generator',
    name: 'Generador de briefs IA',
    seoImpact: 'Alto',
    technicalDifficulty: 'Medio',
    dependencies: ['LLM', 'SERP/KW', 'plantillas editoriales'],
    risk: 'Medio',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Estrategia',
    description: 'Genera briefs revisables a partir de oportunidades, gaps y criterios del método.',
  },
  {
    id: 'schema-validator',
    name: 'Validador de schema',
    seoImpact: 'Medio',
    technicalDifficulty: 'Medio',
    dependencies: ['HTML fetch', 'schema parser', 'reglas de validación'],
    risk: 'Bajo',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Tools Hub',
    description: 'Valida marcado estructurado y genera recomendaciones de corrección.',
  },
  {
    id: 'url-kw-meta-matrix',
    name: 'Matriz URL + KW + Title + Meta',
    seoImpact: 'Alto',
    technicalDifficulty: 'Medio',
    dependencies: ['crawler', 'GSC', 'checklist'],
    risk: 'Bajo',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Intelligence',
    description:
      'Cruza URLs, keywords y metadatos para detectar gaps, duplicados y oportunidades de CTR.',
  },
  {
    id: 'report-generator',
    name: 'Generador de informes',
    seoImpact: 'Alto',
    technicalDifficulty: 'Medio',
    dependencies: ['snapshots', 'tareas', 'GSC', 'exportaciones'],
    risk: 'Medio',
    existingCodeReuse: 'Medio',
    suggestedPriority: 'P2',
    shouldLiveIn: 'Acciones',
    description: 'Compone entregables ejecutivos y técnicos con evidencias y before/after.',
  },
  {
    id: 'link-building-crm',
    name: 'CRM de link building',
    seoImpact: 'Medio',
    technicalDifficulty: 'Alto',
    dependencies: ['prospectos', 'contactos', 'estados', 'privacidad'],
    risk: 'Alto',
    existingCodeReuse: 'Medio',
    suggestedPriority: 'P3',
    shouldLiveIn: 'Acciones',
    description: 'Gestiona oportunidades, contactos y seguimiento de campañas de autoridad.',
  },
  {
    id: 'content-gap-analysis',
    name: 'Análisis de gaps de contenido',
    seoImpact: 'Alto',
    technicalDifficulty: 'Medio',
    dependencies: ['competidores', 'SERP', 'keywords', 'clusters'],
    risk: 'Medio',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Intelligence',
    description:
      'Identifica temas, formatos y URLs faltantes frente a competidores o intención de búsqueda.',
  },
  {
    id: 'geo-aeo-llms',
    name: 'GEO/AEO/LLMs',
    seoImpact: 'Alto',
    technicalDifficulty: 'Alto',
    dependencies: ['prompts', 'LLM providers', 'competidores', 'histórico'],
    risk: 'Alto',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P2',
    shouldLiveIn: 'Intelligence',
    description:
      'Evalúa visibilidad en respuestas IA, entidades, menciones y señales de autoridad.',
  },
  {
    id: 'before-after-control',
    name: 'Control before/after',
    seoImpact: 'Alto',
    technicalDifficulty: 'Medio',
    dependencies: ['snapshots', 'tareas realizadas', 'GSC'],
    risk: 'Bajo',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Acciones',
    description: 'Relaciona acciones completadas con evolución de métricas y evidencia de impacto.',
  },
  {
    id: 'impact-effort-prioritizer',
    name: 'Priorizador impacto/esfuerzo',
    seoImpact: 'Alto',
    technicalDifficulty: 'Medio',
    dependencies: ['insights', 'tareas', 'estimación de esfuerzo', 'valor de negocio'],
    risk: 'Medio',
    existingCodeReuse: 'Alto',
    suggestedPriority: 'P1',
    shouldLiveIn: 'Estrategia',
    description:
      'Ordena iniciativas por impacto, esfuerzo, urgencia, confianza y valor para negocio.',
  },
];

export const futureSeoQueueWorkflow: FutureWorkflowExample = {
  title: 'Workflow: Auditoría mensual avanzada',
  statusLabel: 'Preparado para implementación posterior · sin ejecución real en Fase 1A',
  steps: [
    'Actualizar datos GSC.',
    'Detectar URLs con caída.',
    'Detectar canibalizaciones.',
    'Detectar URLs sin indexar.',
    'Proponer enlazado interno.',
    'Generar tareas en Kanban.',
    'Crear brief IA.',
    'Preparar entregable mensual.',
    'Esperar validación humana.',
  ],
};
