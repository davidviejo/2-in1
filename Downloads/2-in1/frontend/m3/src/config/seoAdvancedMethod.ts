import { sharedToolsCatalog, ToolCatalogArea, ToolCatalogLevel } from './toolsCatalog';

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

const toolLevelToAdvancedLevel = (level: ToolCatalogLevel): AdvancedMethodLevel => {
  if (level === 'high') return 'Alto';
  if (level === 'medium') return 'Medio';
  return 'Bajo';
};

const toolAreaToAdvancedArea = (area: ToolCatalogArea): AdvancedMethodArea => {
  if (area === 'strategy') return 'Estrategia';
  if (area === 'actions') return 'Acciones';
  if (area === 'tools' || area === 'technical') return 'Tools Hub';
  if (area === 'automation') return 'Workflow';
  return 'Intelligence';
};

export const advancedToolCandidates: AdvancedToolCandidate[] = sharedToolsCatalog.map((tool) => ({
  id: tool.id,
  name: tool.name,
  seoImpact: toolLevelToAdvancedLevel(tool.seoImpact),
  technicalDifficulty: toolLevelToAdvancedLevel(tool.technicalDifficulty),
  dependencies: tool.dependencies,
  risk: toolLevelToAdvancedLevel(tool.risk),
  existingCodeReuse: toolLevelToAdvancedLevel(tool.reusableCode),
  suggestedPriority: tool.priority,
  shouldLiveIn: toolAreaToAdvancedArea(tool.area),
  description: tool.description,
}));

export const futureSeoQueueWorkflow: FutureWorkflowExample = {
  title: 'Workflow: Auditoría mensual avanzada',
  statusLabel: 'Preparado para implementación posterior · sin ejecución real',
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

export type MethodImplementationStatusState = 'completed' | 'in_progress' | 'pending';

export interface MethodologySectionNavItem {
  id: string;
  label: string;
  description: string;
}

export interface AdvancedMethodStatusItem {
  label: string;
  description: string;
  state: MethodImplementationStatusState;
}

export interface AdvancedMethodPhaseFilter {
  id: string;
  label: string;
  area?: AdvancedMethodArea;
  phaseIds?: string[];
}

export interface AdvancedToolRadarFilter {
  id: string;
  label: string;
  priority?: AdvancedToolCandidate['suggestedPriority'];
  area?: AdvancedMethodArea;
}

export interface AdvancedMethodCta {
  label: string;
  description: string;
  path: string;
  area: AdvancedMethodArea;
}

export interface AdvancedMethodNextStep {
  phase: string;
  title: string;
  description: string;
  state: MethodImplementationStatusState;
}

export const methodologySectionNavItems: MethodologySectionNavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Visión transversal del framework.',
  },
  {
    id: 'contexto-real',
    label: 'Contexto real',
    description: 'Señales read-only disponibles del proyecto.',
  },
  {
    id: 'priorizacion',
    label: 'Priorización',
    description: 'Scoring visual read-only de impacto/esfuerzo.',
  },
  {
    id: 'mapa-operativo',
    label: 'Mapa operativo',
    description: 'Dónde se ejecuta cada parte.',
  },
  {
    id: 'fases',
    label: 'Fases',
    description: 'Criterios, entregables y checkpoints.',
  },
  {
    id: 'herramientas',
    label: 'Herramientas',
    description: 'Radar de candidatas futuras.',
  },
  {
    id: 'cola-seo',
    label: 'Cola SEO',
    description: 'Automatización conceptual sin ejecución real.',
  },
  {
    id: 'cola-seo-dry-run',
    label: 'Dry-run',
    description: 'Simulación frontend de workflows sin ejecución.',
  },
  {
    id: 'piloto-cola-seo',
    label: 'Piloto',
    description: 'Selección manual y paquete simulado.',
  },
  {
    id: 'gobernanza-cola-seo',
    label: 'Gobernanza',
    description: 'Permisos, contratos y readiness Fase 6.',
  },
  {
    id: 'siguientes-pasos',
    label: 'Siguientes pasos',
    description: 'Roadmap recomendado de implantación.',
  },
];

export const advancedMethodStatusItems: AdvancedMethodStatusItem[] = [
  {
    label: 'Documentado',
    description: 'La metodología ya explica fases, criterios y estándares desde configuración.',
    state: 'completed',
  },
  {
    label: 'Componentizado',
    description: 'La UI está dividida en componentes mantenibles y reutilizables.',
    state: 'completed',
  },
  {
    label: 'Conectado visualmente',
    description: 'Metodología orienta hacia Intelligence, Estrategia, Acciones y Tools Hub.',
    state: 'in_progress',
  },
  {
    label: 'Conexión read-only con datos existentes',
    description: 'Metodología ya puede leer señales disponibles sin escribir ni persistir cambios.',
    state: 'completed',
  },
  {
    label: 'Scoring impacto/esfuerzo visual',
    description: 'Recomendaciones metodológicas calculadas sin crear tareas ni editar roadmap.',
    state: 'completed',
  },
  {
    label: 'Tools Hub avanzado read-only',
    description: 'Catálogo compartido y señales de gobierno disponibles sin ejecutar herramientas.',
    state: 'completed',
  },
  {
    label: 'Reconciliación de catálogo',
    description:
      'Comparación read-only entre metodología, backend y launcher para detectar divergencias.',
    state: 'completed',
  },
  {
    label: 'Cola SEO dry-run simulada',
    description: 'Workflows frontend simulados con bloqueos, logs y outputs sin ejecución real.',
    state: 'completed',
  },
  {
    label: 'Selección manual de piloto',
    description: 'Preparación local de paquetes simulados sin persistir ni ejecutar acciones.',
    state: 'completed',
  },
  {
    label: 'Gobernanza para ejecución controlada',
    description:
      'Permisos, contratos dry-run, auditoría y rollback definidos como contrato futuro.',
    state: 'in_progress',
  },
  {
    label: 'Pendiente de automatización',
    description: 'La Cola SEO sigue siendo conceptual, sin ejecución, colas ni logs reales.',
    state: 'pending',
  },
  {
    label: 'Pendiente de reporting',
    description: 'Los entregables y exportaciones avanzadas quedan para fases posteriores.',
    state: 'pending',
  },
];

export const advancedMethodPhaseFilters: AdvancedMethodPhaseFilter[] = [
  { id: 'all', label: 'Todas' },
  { id: 'intelligence', label: 'Intelligence', area: 'Intelligence' },
  { id: 'estrategia', label: 'Estrategia', area: 'Estrategia' },
  { id: 'acciones', label: 'Acciones', area: 'Acciones' },
  { id: 'tools-hub', label: 'Tools Hub', area: 'Tools Hub' },
  { id: 'reporting-validacion', label: 'Reporting / Validación', phaseIds: ['validacion'] },
];

export const advancedToolRadarFilters: AdvancedToolRadarFilter[] = [
  { id: 'all', label: 'Todas' },
  { id: 'p1', label: 'P1', priority: 'P1' },
  { id: 'p2', label: 'P2', priority: 'P2' },
  { id: 'p3', label: 'P3', priority: 'P3' },
  { id: 'intelligence', label: 'Intelligence', area: 'Intelligence' },
  { id: 'estrategia', label: 'Estrategia', area: 'Estrategia' },
  { id: 'acciones', label: 'Acciones', area: 'Acciones' },
  { id: 'tools-hub', label: 'Tools Hub', area: 'Tools Hub' },
  { id: 'workflow', label: 'Workflow', area: 'Workflow' },
];

export const advancedMethodCtas: AdvancedMethodCta[] = [
  {
    label: 'Analizar en Intelligence',
    description: 'Abrir el panel principal para lectura inicial de señales y contexto.',
    path: '/app',
    area: 'Intelligence',
  },
  {
    label: 'Auditar en Checklist',
    description: 'Revisar controles técnicos/editoriales antes de priorizar.',
    path: '/app/checklist',
    area: 'Intelligence',
  },
  {
    label: 'Revisar impacto GSC',
    description: 'Contrastar cambios de rendimiento con datos de Search Console.',
    path: '/app/gsc-impact',
    area: 'Intelligence',
  },
  {
    label: 'Priorizar en Roadmap',
    description: 'Convertir decisiones en roadmap cliente sin duplicar planificación.',
    path: '/app/client-roadmap',
    area: 'Estrategia',
  },
  {
    label: 'Generar Roadmap IA',
    description: 'Explorar propuestas asistidas antes de aprobar ejecución.',
    path: '/app/ai-roadmap',
    area: 'Estrategia',
  },
  {
    label: 'Ejecutar en Kanban',
    description: 'Llevar acciones aprobadas al tablero operativo existente.',
    path: '/app/kanban',
    area: 'Acciones',
  },
  {
    label: 'Planificar en Gantt',
    description: 'Secuenciar entregables, dependencias y fechas de ejecución.',
    path: '/app/gantt',
    area: 'Acciones',
  },
  {
    label: 'Validar tareas realizadas',
    description: 'Cerrar evidencias, aprendizajes y resultados de tareas completadas.',
    path: '/app/completed-tasks',
    area: 'Acciones',
  },
  {
    label: 'Gobernar en Tools Hub',
    description: 'Revisar catálogo, estado y gobierno de herramientas existentes/futuras.',
    path: '/app/tools-hub',
    area: 'Tools Hub',
  },
];

export const advancedMethodNextSteps: AdvancedMethodNextStep[] = [
  {
    phase: 'Fase 1A',
    title: 'Método config-driven integrado en Metodología',
    description: 'Framework transversal visible sin backend, endpoints ni automatización real.',
    state: 'completed',
  },
  {
    phase: 'Fase 1A.1',
    title: 'Componentización y estabilización',
    description: 'Página limpiada como orquestador y contenido centralizado en configuración.',
    state: 'completed',
  },
  {
    phase: 'Fase 1B',
    title: 'Navegación interna, filtros y accionabilidad visual',
    description: 'Mejorar lectura y acceso a áreas operativas sin conectar datos reales.',
    state: 'completed',
  },
  {
    phase: 'Fase 2',
    title: 'Conexión read-only con datos existentes',
    description: 'Leer clientes, proyectos, tareas, GSC o snapshots sin modificar modelos backend.',
    state: 'completed',
  },
  {
    phase: 'Fase 3',
    title: 'Priorización impacto/esfuerzo',
    description: 'Añadir scoring visible y trazable para ordenar iniciativas.',
    state: 'completed',
  },
  {
    phase: 'Fase 4A',
    title: 'Tools Hub avanzado read-only',
    description: 'Gobierno ampliado, estados, scoring y ownership de herramientas.',
    state: 'completed',
  },
  {
    phase: 'Fase 4B',
    title: 'Reconciliación de catálogo',
    description: 'Comparar metodología, backend y launcher sin ejecutar herramientas.',
    state: 'completed',
  },
  {
    phase: 'Fase 5A',
    title: 'Cola SEO dry-run simulada',
    description: 'Simular workflows con dependencias, logs y revisión sin acciones reales.',
    state: 'completed',
  },
  {
    phase: 'Fase 5B',
    title: 'Selección manual de workflows',
    description: 'Preparar paquetes de acción simulados sin ejecución ni persistencia automática.',
    state: 'completed',
  },
  {
    phase: 'Fase 5C',
    title: 'Hardening de gobernanza',
    description: 'Definir permisos, contratos dry-run, auditoría, rollback y readiness de Fase 6.',
    state: 'in_progress',
  },
  {
    phase: 'Fase 6',
    title: 'Ejecución controlada con revisión humana',
    description: 'Habilitar acciones sensibles solo con confirmación, permisos y auditoría.',
    state: 'pending',
  },
  {
    phase: 'Fase 7',
    title: 'Reporting y exportaciones',
    description: 'Convertir evidencias, tareas y resultados en entregables exportables.',
    state: 'pending',
  },
];
