export type SeoQueueWorkflowCategory =
  | 'audit'
  | 'cannibalization'
  | 'internal-linking'
  | 'indexation'
  | 'ai-briefing'
  | 'validation'
  | 'tools-governance';

export type SeoQueueRiskLevel = 'low' | 'medium' | 'high';
export type SeoQueuePilotSuitability = 'low' | 'medium' | 'high';
export type SeoQueueStepType =
  | 'precheck'
  | 'analysis'
  | 'recommendation'
  | 'validation'
  | 'export'
  | 'human-review';

export interface SeoQueueDryRunStepConfig {
  id: string;
  title: string;
  description: string;
  type: SeoQueueStepType;
  dependsOnStepIds: string[];
  canRunInParallel: boolean;
  requiredSignals: string[];
  requiredToolIds: string[];
  simulatedDurationLabel: string;
  dryRunLogMessages: string[];
  blockedIfMissing: string[];
  outputPreview: string;
}

export interface SeoQueueWorkflowConfig {
  id: string;
  name: string;
  description: string;
  category: SeoQueueWorkflowCategory;
  recommendedFor: string[];
  requiredSignals: string[];
  requiredTools: string[];
  riskLevel: SeoQueueRiskLevel;
  dryRunOnly: true;
  requiresHumanReview: boolean;
  estimatedSteps: number;
  expectedOutputs: string[];
  pilotSuitability: SeoQueuePilotSuitability;
  minimumRequirements: string[];
  humanApprovalPolicy: string[];
  suggestedOwnerArea: string;
  suggestedReviewers: string[];
  packageOutputs: string[];
  nextPhaseWarnings: string[];
  steps: SeoQueueDryRunStepConfig[];
}

export const seoQueueWorkflows: SeoQueueWorkflowConfig[] = [
  {
    id: 'monthly-advanced-audit',
    name: 'Auditoría mensual avanzada',
    description:
      'Simula un ciclo mensual de diagnóstico, priorización y entregable sin ejecutar herramientas.',
    category: 'audit',
    recommendedFor: ['Clientes con tareas, GSC y snapshots o backlog activo.'],
    requiredSignals: ['active-client', 'gsc', 'tasks'],
    requiredTools: ['gsc-impact-analyzer', 'seo-checklist-audit', 'impact-effort-prioritizer'],
    riskLevel: 'medium',
    dryRunOnly: true,
    requiresHumanReview: true,
    estimatedSteps: 5,
    expectedOutputs: ['Resumen de hallazgos', 'Lista de bloqueos', 'Propuesta de prioridades'],
    pilotSuitability: 'high',
    minimumRequirements: [
      'Cliente activo',
      'Señales GSC disponibles',
      'Backlog o tareas existentes',
      'Catálogo de herramientas reconciliado',
    ],
    humanApprovalPolicy: [
      'Aprobación obligatoria antes de convertir prioridades en tareas.',
      'Revisión recomendada de cualquier recomendación impacto/esfuerzo.',
    ],
    suggestedOwnerArea: 'Estrategia / Intelligence',
    suggestedReviewers: ['SEO Lead', 'Responsable de cuenta', 'Cliente'],
    packageOutputs: [
      'Plan mensual simulado',
      'Bloqueos por señal/herramienta',
      'Checklist de validación humana',
    ],
    nextPhaseWarnings: [
      'No convertir recomendaciones en tareas sin aprobación humana.',
      'No ejecutar herramientas hasta definir permisos y auditoría.',
    ],
    steps: [
      {
        id: 'audit-precheck',
        title: 'Validar contexto mínimo',
        description: 'Comprueba cliente activo, señales GSC y tareas existentes.',
        type: 'precheck',
        dependsOnStepIds: [],
        canRunInParallel: false,
        requiredSignals: ['active-client', 'gsc', 'tasks'],
        requiredToolIds: [],
        simulatedDurationLabel: '1 min simulado',
        dryRunLogMessages: [
          '[dry-run] Contexto de cliente leído.',
          '[dry-run] Señales mínimas comprobadas.',
        ],
        blockedIfMissing: ['Cliente activo', 'Evidencias GSC', 'Tareas existentes'],
        outputPreview: 'Checklist de precondiciones del ciclo mensual.',
      },
      {
        id: 'audit-gsc-review',
        title: 'Revisar señales GSC',
        description: 'Simula lectura de oportunidades y caídas desde GSC Impact.',
        type: 'analysis',
        dependsOnStepIds: ['audit-precheck'],
        canRunInParallel: true,
        requiredSignals: ['gsc'],
        requiredToolIds: ['gsc-impact-analyzer'],
        simulatedDurationLabel: '3 min simulados',
        dryRunLogMessages: [
          '[dry-run] Se prepararían periodos comparables.',
          '[dry-run] No se consulta ninguna API nueva.',
        ],
        blockedIfMissing: ['Evidencias GSC', 'Herramienta GSC Impact reconciliada'],
        outputPreview: 'Lista simulada de URLs/queries a revisar.',
      },
      {
        id: 'audit-checklist-review',
        title: 'Cruzar auditoría checklist',
        description: 'Simula cruce entre hallazgos de checklist y prioridades.',
        type: 'analysis',
        dependsOnStepIds: ['audit-precheck'],
        canRunInParallel: true,
        requiredSignals: ['tasks'],
        requiredToolIds: ['seo-checklist-audit'],
        simulatedDurationLabel: '2 min simulados',
        dryRunLogMessages: [
          '[dry-run] Se leerían hallazgos existentes.',
          '[dry-run] No se crean tareas.',
        ],
        blockedIfMissing: ['Tareas/hallazgos existentes'],
        outputPreview: 'Mapa simulado de gaps técnicos/editoriales.',
      },
      {
        id: 'audit-priority-preview',
        title: 'Generar prioridad metodológica',
        description: 'Simula una recomendación impacto/esfuerzo a partir de señales disponibles.',
        type: 'recommendation',
        dependsOnStepIds: ['audit-gsc-review', 'audit-checklist-review'],
        canRunInParallel: false,
        requiredSignals: ['client-roadmap'],
        requiredToolIds: ['impact-effort-prioritizer'],
        simulatedDurationLabel: '2 min simulados',
        dryRunLogMessages: ['[dry-run] Se prepararían recomendaciones, no se edita roadmap.'],
        blockedIfMissing: ['Roadmap cliente o priorización disponible'],
        outputPreview: 'Ranking simulado de prioridades.',
      },
      {
        id: 'audit-human-review',
        title: 'Revisión humana del entregable',
        description: 'Marca el punto de control humano antes de cualquier ejecución real futura.',
        type: 'human-review',
        dependsOnStepIds: ['audit-priority-preview'],
        canRunInParallel: false,
        requiredSignals: [],
        requiredToolIds: [],
        simulatedDurationLabel: 'manual',
        dryRunLogMessages: ['[dry-run] Se requiere aprobación humana.'],
        blockedIfMissing: ['Criterio de aprobación'],
        outputPreview: 'Pendiente de validación humana.',
      },
    ],
  },
  {
    id: 'cannibalization-review',
    name: 'Revisión de canibalización',
    description: 'Simula detección de URLs competidoras por query/cluster.',
    category: 'cannibalization',
    recommendedFor: ['Proyectos con GSC y clusters.'],
    requiredSignals: ['active-client', 'gsc', 'seo-clusters'],
    requiredTools: ['cannibalization-detector'],
    riskLevel: 'medium',
    dryRunOnly: true,
    requiresHumanReview: true,
    estimatedSteps: 3,
    expectedOutputs: ['Posibles canibalizaciones', 'Recomendaciones de consolidación'],
    pilotSuitability: 'medium',
    minimumRequirements: ['Cliente activo', 'GSC disponible', 'Clusters SEO disponibles'],
    humanApprovalPolicy: [
      'Aprobación obligatoria antes de consolidar, redirigir o reescribir URLs.',
      'Revisión editorial de cualquier conflicto de intención.',
    ],
    suggestedOwnerArea: 'Intelligence / Estrategia',
    suggestedReviewers: ['SEO Lead', 'Editor SEO'],
    packageOutputs: [
      'Mapa simulado de conflictos',
      'Criterios de consolidación',
      'Riesgos editoriales',
    ],
    nextPhaseWarnings: [
      'No aplicar consolidaciones automáticas.',
      'Validar intención y negocio antes de decidir URL canónica.',
    ],
    steps: [
      {
        id: 'cannibalization-precheck',
        title: 'Comprobar GSC y clusters',
        description: 'Valida que hay señales suficientes para no inferir canibalización débil.',
        type: 'precheck',
        dependsOnStepIds: [],
        canRunInParallel: false,
        requiredSignals: ['gsc', 'seo-clusters'],
        requiredToolIds: ['cannibalization-detector'],
        simulatedDurationLabel: '1 min simulado',
        dryRunLogMessages: ['[dry-run] GSC y clusters verificados conceptualmente.'],
        blockedIfMissing: ['GSC', 'Clusters SEO', 'Detector reconciliado'],
        outputPreview: 'Precheck de datos para canibalización.',
      },
      {
        id: 'cannibalization-analysis',
        title: 'Simular agrupación URL/query',
        description: 'Agrupa señales y detecta candidatos sin modificar contenidos.',
        type: 'analysis',
        dependsOnStepIds: ['cannibalization-precheck'],
        canRunInParallel: false,
        requiredSignals: ['gsc', 'seo-clusters'],
        requiredToolIds: ['cannibalization-detector'],
        simulatedDurationLabel: '4 min simulados',
        dryRunLogMessages: [
          '[dry-run] Se calcularían solapamientos de intención.',
          '[dry-run] No se consolida ninguna URL.',
        ],
        blockedIfMissing: ['Datos de query/URL suficientes'],
        outputPreview: 'Tabla simulada de URL principal vs competidoras.',
      },
      {
        id: 'cannibalization-review-human',
        title: 'Validación humana de consolidación',
        description: 'Revisión obligatoria antes de proponer cambios editoriales.',
        type: 'human-review',
        dependsOnStepIds: ['cannibalization-analysis'],
        canRunInParallel: false,
        requiredSignals: [],
        requiredToolIds: [],
        simulatedDurationLabel: 'manual',
        dryRunLogMessages: ['[dry-run] Decisión editorial requiere humano.'],
        blockedIfMissing: ['Responsable editorial'],
        outputPreview: 'Lista de decisiones pendientes.',
      },
    ],
  },
  {
    id: 'internal-linking-opportunities',
    name: 'Oportunidades de enlazado interno',
    description: 'Simula recomendaciones de enlazado sin tocar la web.',
    category: 'internal-linking',
    recommendedFor: ['Proyectos con clusters y URLs priorizadas.'],
    requiredSignals: ['active-client', 'seo-clusters'],
    requiredTools: ['internal-linking-recommender'],
    riskLevel: 'high',
    dryRunOnly: true,
    requiresHumanReview: true,
    estimatedSteps: 3,
    expectedOutputs: ['Ideas de enlaces', 'Bloqueos por falta de grafo'],
    pilotSuitability: 'medium',
    minimumRequirements: ['Cliente activo', 'Clusters SEO disponibles', 'Herramienta con dry-run'],
    humanApprovalPolicy: [
      'Aprobación editorial obligatoria antes de publicar enlaces.',
      'Revisión recomendada de anchors y páginas destino.',
    ],
    suggestedOwnerArea: 'Acciones / Content SEO',
    suggestedReviewers: ['SEO Lead', 'Editor SEO', 'Content Manager'],
    packageOutputs: ['Preview de enlaces', 'Bloqueos por grafo', 'Checklist editorial'],
    nextPhaseWarnings: [
      'No insertar enlaces automáticamente.',
      'Revisar intención, anchor y contexto antes de cualquier implementación.',
    ],
    steps: [
      {
        id: 'linking-precheck',
        title: 'Validar clusters y herramienta',
        description: 'Comprueba si hay clusters y si la herramienta soporta dry-run.',
        type: 'precheck',
        dependsOnStepIds: [],
        canRunInParallel: false,
        requiredSignals: ['seo-clusters'],
        requiredToolIds: ['internal-linking-recommender'],
        simulatedDurationLabel: '1 min simulado',
        dryRunLogMessages: ['[dry-run] Se comprobaría grafo de enlaces si existiera.'],
        blockedIfMissing: ['Clusters SEO', 'Dry-run del recomendador'],
        outputPreview: 'Estado de preparación para enlazado interno.',
      },
      {
        id: 'linking-simulation',
        title: 'Simular pares origen/destino',
        description: 'Prepara candidatos de enlaces en modo conceptual.',
        type: 'recommendation',
        dependsOnStepIds: ['linking-precheck'],
        canRunInParallel: false,
        requiredSignals: ['seo-clusters'],
        requiredToolIds: ['internal-linking-recommender'],
        simulatedDurationLabel: '3 min simulados',
        dryRunLogMessages: [
          '[dry-run] No se insertan enlaces.',
          '[dry-run] Se mostraría preview de oportunidades.',
        ],
        blockedIfMissing: ['Herramienta con dry-run'],
        outputPreview: 'Preview simulado de enlaces internos.',
      },
      {
        id: 'linking-human-review',
        title: 'Aprobación humana de enlaces',
        description: 'Control editorial obligatorio para cualquier enlace sugerido.',
        type: 'human-review',
        dependsOnStepIds: ['linking-simulation'],
        canRunInParallel: false,
        requiredSignals: [],
        requiredToolIds: [],
        simulatedDurationLabel: 'manual',
        dryRunLogMessages: ['[dry-run] Requiere revisión humana.'],
        blockedIfMissing: ['Aprobador editorial'],
        outputPreview: 'Checklist de aprobación.',
      },
    ],
  },
  {
    id: 'indexation-validation',
    name: 'Validación de indexación',
    description: 'Simula revisión de cobertura/indexación con guardrails de cuotas.',
    category: 'indexation',
    recommendedFor: ['Proyectos con GSC y URLs críticas.'],
    requiredSignals: ['active-client', 'gsc'],
    requiredTools: ['indexation-monitor'],
    riskLevel: 'high',
    dryRunOnly: true,
    requiresHumanReview: true,
    estimatedSteps: 3,
    expectedOutputs: ['URLs a revisar', 'Riesgos de indexación'],
    pilotSuitability: 'medium',
    minimumRequirements: ['Cliente activo', 'GSC disponible', 'Política de uso de APIs sensible'],
    humanApprovalPolicy: [
      'Aprobación obligatoria antes de llamadas sensibles de inspección/indexación.',
      'Revisión técnica de cuotas, permisos y riesgos.',
    ],
    suggestedOwnerArea: 'Intelligence / Técnico',
    suggestedReviewers: ['SEO Técnico', 'SEO Lead'],
    packageOutputs: [
      'Listado simulado de URLs críticas',
      'Riesgos por cobertura',
      'Guardrails de cuotas',
    ],
    nextPhaseWarnings: [
      'No llamar APIs de inspección sin permisos explícitos.',
      'No solicitar indexación desde el simulador.',
    ],
    steps: [
      {
        id: 'indexation-precheck',
        title: 'Comprobar señal GSC',
        description: 'Valida si hay evidencia suficiente sin llamar APIs nuevas.',
        type: 'precheck',
        dependsOnStepIds: [],
        canRunInParallel: false,
        requiredSignals: ['gsc'],
        requiredToolIds: ['indexation-monitor'],
        simulatedDurationLabel: '1 min simulado',
        dryRunLogMessages: ['[dry-run] Se verifica disponibilidad de GSC ya expuesta.'],
        blockedIfMissing: ['Evidencias GSC', 'Monitor reconciliado'],
        outputPreview: 'Precheck de indexación.',
      },
      {
        id: 'indexation-risk-preview',
        title: 'Preparar preview de URLs críticas',
        description: 'Simula una lista de URLs candidatas a validación.',
        type: 'analysis',
        dependsOnStepIds: ['indexation-precheck'],
        canRunInParallel: false,
        requiredSignals: ['gsc'],
        requiredToolIds: ['indexation-monitor'],
        simulatedDurationLabel: '3 min simulados',
        dryRunLogMessages: [
          '[dry-run] No se llama URL Inspection API.',
          '[dry-run] Se preparan riesgos hipotéticos.',
        ],
        blockedIfMissing: ['Dry-run del monitor'],
        outputPreview: 'Listado simulado de URLs con riesgo.',
      },
      {
        id: 'indexation-human-review',
        title: 'Revisión humana por cuota/riesgo',
        description: 'Evita llamadas sensibles sin aprobación.',
        type: 'human-review',
        dependsOnStepIds: ['indexation-risk-preview'],
        canRunInParallel: false,
        requiredSignals: [],
        requiredToolIds: [],
        simulatedDurationLabel: 'manual',
        dryRunLogMessages: ['[dry-run] Revisión humana obligatoria por riesgo alto.'],
        blockedIfMissing: ['Aprobación de uso de APIs'],
        outputPreview: 'Aprobación pendiente.',
      },
    ],
  },
  {
    id: 'ai-briefing-preparation',
    name: 'Preparación de briefing IA',
    description: 'Simula preparación de briefs IA revisables.',
    category: 'ai-briefing',
    recommendedFor: ['Proyectos con Roadmap IA o clusters/contenidos.'],
    requiredSignals: ['active-client', 'ai-roadmap'],
    requiredTools: ['ai-brief-generator'],
    riskLevel: 'medium',
    dryRunOnly: true,
    requiresHumanReview: true,
    estimatedSteps: 3,
    expectedOutputs: ['Brief borrador', 'Checklist editorial'],
    pilotSuitability: 'medium',
    minimumRequirements: [
      'Cliente activo',
      'Roadmap IA o contexto editorial',
      'Plantilla de brief aprobada',
    ],
    humanApprovalPolicy: [
      'Aprobación editorial obligatoria antes de producir o entregar briefs reales.',
      'Revisión recomendada de fuentes, intención y tono.',
    ],
    suggestedOwnerArea: 'Estrategia / Content SEO',
    suggestedReviewers: ['Editor SEO', 'Content Manager', 'SEO Lead'],
    packageOutputs: ['Estructura de brief simulada', 'Checklist editorial', 'Bloqueos por datos'],
    nextPhaseWarnings: [
      'No llamar modelos LLM desde el simulador.',
      'No publicar briefs sin revisión editorial humana.',
    ],
    steps: [
      {
        id: 'brief-precheck',
        title: 'Validar contexto IA',
        description: 'Comprueba si existen propuestas IA o contexto suficiente.',
        type: 'precheck',
        dependsOnStepIds: [],
        canRunInParallel: false,
        requiredSignals: ['ai-roadmap'],
        requiredToolIds: ['ai-brief-generator'],
        simulatedDurationLabel: '1 min simulado',
        dryRunLogMessages: ['[dry-run] Se lee contexto IA existente.'],
        blockedIfMissing: ['Roadmap IA o prompts disponibles'],
        outputPreview: 'Contexto para brief.',
      },
      {
        id: 'brief-draft-preview',
        title: 'Simular borrador de brief',
        description: 'Genera solo una previsualización conceptual sin llamar LLMs.',
        type: 'recommendation',
        dependsOnStepIds: ['brief-precheck'],
        canRunInParallel: false,
        requiredSignals: ['ai-roadmap'],
        requiredToolIds: ['ai-brief-generator'],
        simulatedDurationLabel: '2 min simulados',
        dryRunLogMessages: [
          '[dry-run] No se llama a proveedores LLM.',
          '[dry-run] Se muestra estructura de brief.',
        ],
        blockedIfMissing: ['Plantilla de brief', 'Dry-run del generador'],
        outputPreview: 'Estructura simulada H1/H2, intención, entidades y fuentes.',
      },
      {
        id: 'brief-human-review',
        title: 'Revisión editorial humana',
        description: 'Control de calidad antes de cualquier brief real.',
        type: 'human-review',
        dependsOnStepIds: ['brief-draft-preview'],
        canRunInParallel: false,
        requiredSignals: [],
        requiredToolIds: [],
        simulatedDurationLabel: 'manual',
        dryRunLogMessages: ['[dry-run] Brief requiere validación editorial.'],
        blockedIfMissing: ['Editor responsable'],
        outputPreview: 'Brief pendiente de revisión.',
      },
    ],
  },
  {
    id: 'before-after-validation',
    name: 'Validación before/after',
    description: 'Simula validación de impacto con tareas completadas o snapshots.',
    category: 'validation',
    recommendedFor: ['Clientes con tareas completadas o snapshots SEO.'],
    requiredSignals: ['active-client', 'completed-tasks'],
    requiredTools: ['before-after-control'],
    riskLevel: 'low',
    dryRunOnly: true,
    requiresHumanReview: false,
    estimatedSteps: 2,
    expectedOutputs: ['Resumen before/after', 'Aprendizajes'],
    pilotSuitability: 'high',
    minimumRequirements: [
      'Cliente activo',
      'Tareas completadas o snapshots',
      'Ventana de medición definida',
    ],
    humanApprovalPolicy: [
      'Revisión recomendada del análisis antes de reportarlo al cliente.',
      'Aprobación previa si se exporta como entregable formal.',
    ],
    suggestedOwnerArea: 'Validación / Reporting',
    suggestedReviewers: ['SEO Lead', 'Responsable de cuenta'],
    packageOutputs: ['Resumen before/after simulado', 'Aprendizajes', 'Preguntas abiertas'],
    nextPhaseWarnings: [
      'No emitir reporte final sin validar ventana y atribución.',
      'No cerrar acciones futuras automáticamente.',
    ],
    steps: [
      {
        id: 'before-after-precheck',
        title: 'Validar evidencia existente',
        description: 'Comprueba tareas completadas o snapshots.',
        type: 'precheck',
        dependsOnStepIds: [],
        canRunInParallel: false,
        requiredSignals: ['completed-tasks'],
        requiredToolIds: ['before-after-control'],
        simulatedDurationLabel: '1 min simulado',
        dryRunLogMessages: ['[dry-run] Se buscan evidencias ya guardadas.'],
        blockedIfMissing: ['Tareas completadas o snapshots'],
        outputPreview: 'Evidencias disponibles para validación.',
      },
      {
        id: 'before-after-summary',
        title: 'Simular resumen de impacto',
        description: 'Prepara una lectura de impacto sin generar informe final.',
        type: 'validation',
        dependsOnStepIds: ['before-after-precheck'],
        canRunInParallel: false,
        requiredSignals: ['completed-tasks'],
        requiredToolIds: ['before-after-control'],
        simulatedDurationLabel: '2 min simulados',
        dryRunLogMessages: ['[dry-run] Se prepara resumen; no se exporta reporte.'],
        blockedIfMissing: ['Ventana de medición suficiente'],
        outputPreview: 'Resumen simulado de mejora/neutral/empeoramiento.',
      },
    ],
  },
  {
    id: 'tools-governance-before-automation',
    name: 'Gobierno de herramientas antes de automatizar',
    description:
      'Simula revisión de consistencia, dry-run y revisión humana antes de cualquier cola.',
    category: 'tools-governance',
    recommendedFor: ['Antes de diseñar cualquier ejecución asistida.'],
    requiredSignals: ['tools-catalog'],
    requiredTools: ['tools-hub-launcher'],
    riskLevel: 'medium',
    dryRunOnly: true,
    requiresHumanReview: true,
    estimatedSteps: 3,
    expectedOutputs: [
      'Bloqueos de catálogo',
      'Políticas de revisión',
      'Lista de herramientas aptas',
    ],
    pilotSuitability: 'high',
    minimumRequirements: [
      'Catálogo compartido disponible',
      'Reconciliación backend/launcher revisada',
      'Política humana definida',
    ],
    humanApprovalPolicy: [
      'Aprobación obligatoria antes de habilitar cualquier herramienta en cola real.',
      'Revisión técnica de dry-run, logs y permisos por herramienta.',
    ],
    suggestedOwnerArea: 'Tools Hub / Producto',
    suggestedReviewers: ['Product Owner', 'SEO Lead', 'Tech Lead'],
    packageOutputs: [
      'Matriz de herramientas aptas',
      'Bloqueos de catálogo',
      'Política de aprobación',
    ],
    nextPhaseWarnings: [
      'No pasar a ejecución real sin contratos dry-run por herramienta.',
      'No habilitar herramientas con divergencias críticas.',
    ],
    steps: [
      {
        id: 'tools-consistency-precheck',
        title: 'Revisar consistencia del catálogo',
        description: 'Comprueba divergencias entre metodología, backend y launcher.',
        type: 'precheck',
        dependsOnStepIds: [],
        canRunInParallel: false,
        requiredSignals: ['tools-catalog'],
        requiredToolIds: ['tools-hub-launcher'],
        simulatedDurationLabel: '1 min simulado',
        dryRunLogMessages: ['[dry-run] Se calcula consistencia del catálogo.'],
        blockedIfMissing: ['Catálogo reconciliado'],
        outputPreview: 'Score de consistencia y divergencias.',
      },
      {
        id: 'tools-guardrails-preview',
        title: 'Preparar guardrails de dry-run',
        description: 'Identifica herramientas sin dry-run y con revisión humana.',
        type: 'validation',
        dependsOnStepIds: ['tools-consistency-precheck'],
        canRunInParallel: true,
        requiredSignals: ['tools-catalog'],
        requiredToolIds: ['tools-hub-launcher'],
        simulatedDurationLabel: '2 min simulados',
        dryRunLogMessages: ['[dry-run] Se listan herramientas bloqueadas por guardrails.'],
        blockedIfMissing: ['Señales de catálogo'],
        outputPreview: 'Lista simulada de herramientas aptas/no aptas.',
      },
      {
        id: 'tools-human-policy',
        title: 'Definir política humana',
        description: 'Punto de control para herramientas sensibles.',
        type: 'human-review',
        dependsOnStepIds: ['tools-guardrails-preview'],
        canRunInParallel: false,
        requiredSignals: [],
        requiredToolIds: [],
        simulatedDurationLabel: 'manual',
        dryRunLogMessages: ['[dry-run] Política humana pendiente.'],
        blockedIfMissing: ['Política de aprobación'],
        outputPreview: 'Matriz de aprobación pendiente.',
      },
    ],
  },
];
