import { SeoQueueRiskLevel, SeoQueueStepType } from '@/config/seoQueueWorkflows';

export type SeoQueueApprovalRequirement = 'none' | 'recommended' | 'required' | 'blocked';
export type SeoQueueControlledMode = 'dry-run' | 'preview' | 'controlled-execution-future';
export type SeoQueueGovernanceReadiness = 'ready' | 'partial' | 'blocked';

export interface SeoQueueStepGovernancePolicy {
  stepType: SeoQueueStepType;
  riskLevel: SeoQueueRiskLevel;
  approvalRequirement: SeoQueueApprovalRequirement;
  allowedInDryRun: boolean;
  allowedInControlledExecution: boolean;
  requiresHumanApproval: boolean;
  requiresBeforeSnapshot: boolean;
  requiresAfterSnapshot: boolean;
  requiresRollbackPlan: boolean;
  requiresAuditLog: boolean;
  requiresOwner: boolean;
  requiresReviewer: boolean;
  canCreateTask: boolean;
  canModifyRoadmap: boolean;
  canCallExternalApi: boolean;
  canChangeWebsite: boolean;
  canSendNotification: boolean;
  notes: string;
}

export interface SeoQueueToolDryRunContract {
  toolId: string;
  toolName: string;
  allowedModes: SeoQueueControlledMode[];
  requiredInputs: string[];
  simulatedOutputs: string[];
  blockedActions: string[];
  requiredApprovals: string[];
  auditRequirements: string[];
  rollbackRequirements: string[];
  riskNotes: string[];
  readinessForPhase6: SeoQueueGovernanceReadiness;
}

export interface SeoQueuePhase6Criterion {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

export const seoQueueStepGovernancePolicies: SeoQueueStepGovernancePolicy[] = [
  {
    stepType: 'precheck',
    riskLevel: 'low',
    approvalRequirement: 'none',
    allowedInDryRun: true,
    allowedInControlledExecution: true,
    requiresHumanApproval: false,
    requiresBeforeSnapshot: false,
    requiresAfterSnapshot: false,
    requiresRollbackPlan: false,
    requiresAuditLog: true,
    requiresOwner: true,
    requiresReviewer: false,
    canCreateTask: false,
    canModifyRoadmap: false,
    canCallExternalApi: false,
    canChangeWebsite: false,
    canSendNotification: false,
    notes: 'Solo valida requisitos y nunca debe mutar datos.',
  },
  {
    stepType: 'analysis',
    riskLevel: 'medium',
    approvalRequirement: 'recommended',
    allowedInDryRun: true,
    allowedInControlledExecution: true,
    requiresHumanApproval: false,
    requiresBeforeSnapshot: false,
    requiresAfterSnapshot: false,
    requiresRollbackPlan: false,
    requiresAuditLog: true,
    requiresOwner: true,
    requiresReviewer: true,
    canCreateTask: false,
    canModifyRoadmap: false,
    canCallExternalApi: false,
    canChangeWebsite: false,
    canSendNotification: false,
    notes: 'Puede leer señales existentes, pero las APIs externas quedan fuera de 5C.',
  },
  {
    stepType: 'recommendation',
    riskLevel: 'medium',
    approvalRequirement: 'recommended',
    allowedInDryRun: true,
    allowedInControlledExecution: true,
    requiresHumanApproval: true,
    requiresBeforeSnapshot: false,
    requiresAfterSnapshot: false,
    requiresRollbackPlan: false,
    requiresAuditLog: true,
    requiresOwner: true,
    requiresReviewer: true,
    canCreateTask: false,
    canModifyRoadmap: false,
    canCallExternalApi: false,
    canChangeWebsite: false,
    canSendNotification: false,
    notes: 'Una recomendación no debe convertirse automáticamente en tarea o roadmap.',
  },
  {
    stepType: 'validation',
    riskLevel: 'medium',
    approvalRequirement: 'recommended',
    allowedInDryRun: true,
    allowedInControlledExecution: true,
    requiresHumanApproval: true,
    requiresBeforeSnapshot: true,
    requiresAfterSnapshot: true,
    requiresRollbackPlan: false,
    requiresAuditLog: true,
    requiresOwner: true,
    requiresReviewer: true,
    canCreateTask: false,
    canModifyRoadmap: false,
    canCallExternalApi: false,
    canChangeWebsite: false,
    canSendNotification: false,
    notes: 'Debe dejar evidencia before/after antes de usarse en reporting.',
  },
  {
    stepType: 'export',
    riskLevel: 'high',
    approvalRequirement: 'required',
    allowedInDryRun: true,
    allowedInControlledExecution: false,
    requiresHumanApproval: true,
    requiresBeforeSnapshot: true,
    requiresAfterSnapshot: true,
    requiresRollbackPlan: true,
    requiresAuditLog: true,
    requiresOwner: true,
    requiresReviewer: true,
    canCreateTask: false,
    canModifyRoadmap: false,
    canCallExternalApi: false,
    canChangeWebsite: false,
    canSendNotification: false,
    notes: 'Exportar o entregar requiere aprobación previa y trazabilidad completa.',
  },
  {
    stepType: 'human-review',
    riskLevel: 'high',
    approvalRequirement: 'required',
    allowedInDryRun: true,
    allowedInControlledExecution: true,
    requiresHumanApproval: true,
    requiresBeforeSnapshot: false,
    requiresAfterSnapshot: false,
    requiresRollbackPlan: true,
    requiresAuditLog: true,
    requiresOwner: true,
    requiresReviewer: true,
    canCreateTask: false,
    canModifyRoadmap: false,
    canCallExternalApi: false,
    canChangeWebsite: false,
    canSendNotification: false,
    notes: 'Punto de control obligatorio; nunca debe saltarse en ejecución futura.',
  },
];

export const seoQueueToolDryRunContracts: SeoQueueToolDryRunContract[] = [
  {
    toolId: 'gsc-impact-analyzer',
    toolName: 'GSC Impact',
    allowedModes: ['dry-run', 'preview'],
    requiredInputs: ['Cliente activo', 'Propiedad GSC', 'Periodo comparable'],
    simulatedOutputs: ['Snapshot de rendimiento', 'Lista de URLs/queries candidatas'],
    blockedActions: ['Consultar APIs nuevas', 'Crear tareas', 'Modificar roadmap'],
    requiredApprovals: ['SEO Lead para usar evidencias en priorización'],
    auditRequirements: ['Registrar periodo, propiedad y filtros usados'],
    rollbackRequirements: ['No aplica rollback operativo; solo descartar recomendación'],
    riskNotes: ['Riesgo de inferencias débiles si faltan datos comparables'],
    readinessForPhase6: 'partial',
  },
  {
    toolId: 'seo-checklist-audit',
    toolName: 'Checklist SEO',
    allowedModes: ['dry-run', 'preview'],
    requiredInputs: ['Cliente activo', 'Hallazgos existentes'],
    simulatedOutputs: ['Mapa de gaps', 'Requisitos técnicos/editoriales'],
    blockedActions: ['Crear tareas automáticas', 'Cerrar checks sin revisión'],
    requiredApprovals: ['Responsable SEO para convertir hallazgos en acciones'],
    auditRequirements: ['Registrar fuente del hallazgo y severidad'],
    rollbackRequirements: ['No aplicar cambios sin plan de reversión por tarea'],
    riskNotes: ['Riesgo bajo si se mantiene read-only'],
    readinessForPhase6: 'partial',
  },
  {
    toolId: 'cannibalization-detector',
    toolName: 'Detector de canibalización',
    allowedModes: ['dry-run', 'preview', 'controlled-execution-future'],
    requiredInputs: ['GSC', 'Clusters', 'Reglas de intención'],
    simulatedOutputs: ['Conflictos URL/query', 'Recomendaciones de consolidación'],
    blockedActions: ['Redirigir URLs', 'Reescribir contenidos', 'Cambiar canonical'],
    requiredApprovals: ['SEO Lead', 'Editor SEO'],
    auditRequirements: ['Guardar queries, URLs candidatas y criterio de intención'],
    rollbackRequirements: ['Plan de reversión editorial y técnico antes de cambios'],
    riskNotes: ['Alto impacto editorial si se automatiza sin revisión'],
    readinessForPhase6: 'partial',
  },
  {
    toolId: 'internal-linking-recommender',
    toolName: 'Recomendador de enlazado interno',
    allowedModes: ['dry-run'],
    requiredInputs: ['Clusters', 'Grafo de enlaces', 'URLs priorizadas'],
    simulatedOutputs: ['Pares origen/destino', 'Anchors sugeridos'],
    blockedActions: ['Insertar enlaces', 'Publicar anchors', 'Modificar HTML'],
    requiredApprovals: ['Editor SEO', 'SEO Lead'],
    auditRequirements: ['Registrar origen, destino, anchor y justificación'],
    rollbackRequirements: ['Lista de enlaces a revertir y snapshot before/after'],
    riskNotes: ['No soporta dry-run suficiente en catálogo actual'],
    readinessForPhase6: 'blocked',
  },
  {
    toolId: 'indexation-monitor',
    toolName: 'Monitor de indexación',
    allowedModes: ['dry-run'],
    requiredInputs: ['GSC', 'Sitemap', 'Política de cuotas'],
    simulatedOutputs: ['URLs críticas', 'Riesgos de cobertura'],
    blockedActions: ['Llamar URL Inspection API', 'Solicitar indexación'],
    requiredApprovals: ['SEO Técnico', 'SEO Lead'],
    auditRequirements: ['Registrar cuotas, URLs y resultado esperado'],
    rollbackRequirements: ['No aplica rollback si no hay llamada externa; bloquear ejecución real'],
    riskNotes: ['Riesgo alto por APIs externas y cuotas'],
    readinessForPhase6: 'blocked',
  },
  {
    toolId: 'ai-brief-generator',
    toolName: 'Generador de briefs IA',
    allowedModes: ['dry-run', 'preview'],
    requiredInputs: ['Roadmap IA', 'Plantilla editorial', 'Contexto de marca'],
    simulatedOutputs: ['Estructura de brief', 'Checklist editorial'],
    blockedActions: ['Llamar LLMs', 'Publicar brief', 'Enviar entregable'],
    requiredApprovals: ['Editor SEO', 'Content Manager'],
    auditRequirements: ['Registrar plantilla, fuentes y responsable editorial'],
    rollbackRequirements: ['Descartar borrador y mantener historial de revisión'],
    riskNotes: ['Riesgo editorial y de calidad si no hay revisión humana'],
    readinessForPhase6: 'partial',
  },
  {
    toolId: 'before-after-control',
    toolName: 'Control before/after',
    allowedModes: ['dry-run', 'preview'],
    requiredInputs: ['Tareas completadas', 'Snapshots', 'Ventana de medición'],
    simulatedOutputs: ['Resumen before/after', 'Aprendizajes'],
    blockedActions: ['Emitir reporte final', 'Cerrar iniciativas automáticamente'],
    requiredApprovals: ['SEO Lead', 'Responsable de cuenta'],
    auditRequirements: ['Registrar fechas, fuente y criterio de atribución'],
    rollbackRequirements: ['No aplica rollback operativo; documentar límites de atribución'],
    riskNotes: ['Riesgo de atribución incorrecta si faltan ventanas comparables'],
    readinessForPhase6: 'partial',
  },
  {
    toolId: 'impact-effort-prioritizer',
    toolName: 'Priorizador impacto/esfuerzo',
    allowedModes: ['dry-run', 'preview'],
    requiredInputs: ['Señales metodológicas', 'Roadmap', 'Criterios de negocio'],
    simulatedOutputs: ['Ranking de prioridades', 'Justificación de esfuerzo'],
    blockedActions: ['Editar roadmap', 'Crear tareas', 'Cambiar fechas'],
    requiredApprovals: ['SEO Lead', 'Cliente si afecta planificación'],
    auditRequirements: ['Registrar señales usadas y criterio de scoring'],
    rollbackRequirements: ['Mantener roadmap sin cambios hasta aprobación'],
    riskNotes: ['Puede sesgar prioridades si faltan datos de negocio'],
    readinessForPhase6: 'partial',
  },
  {
    toolId: 'tools-hub-launcher',
    toolName: 'Tools Hub Launcher',
    allowedModes: ['dry-run', 'preview'],
    requiredInputs: ['Catálogo compartido', 'Catálogo backend', 'Launcher catalog'],
    simulatedOutputs: ['Consistencia de catálogo', 'Lista de herramientas aptas'],
    blockedActions: ['Start/stop/install/open', 'Cambiar estado runtime'],
    requiredApprovals: ['Product Owner', 'Tech Lead'],
    auditRequirements: ['Registrar divergencias, ids y estado de reconciliación'],
    rollbackRequirements: ['No cambiar runtime desde Metodología'],
    riskNotes: ['Cualquier ejecución real debe permanecer fuera de 5C'],
    readinessForPhase6: 'partial',
  },
];

export const seoQueuePhase6Criteria: SeoQueuePhase6Criterion[] = [
  {
    id: 'contracts',
    label: 'Contratos dry-run completos',
    description: 'Cada herramienta requerida debe tener contrato y readiness no bloqueado.',
    required: true,
  },
  {
    id: 'approval-policy',
    label: 'Política humana definida',
    description: 'Cada tipo de paso debe tener regla de aprobación y reviewer responsable.',
    required: true,
  },
  {
    id: 'audit-log',
    label: 'Auditoría mínima',
    description: 'Todo paso futuro debe definir qué se registra y dónde se revisa.',
    required: true,
  },
  {
    id: 'rollback',
    label: 'Rollback o bloqueo explícito',
    description: 'Las acciones sensibles deben tener plan de reversión o quedar bloqueadas.',
    required: true,
  },
  {
    id: 'no-direct-mutation',
    label: 'Sin mutación directa',
    description: 'Crear tareas, modificar roadmap, llamar APIs o cambiar web sigue deshabilitado.',
    required: true,
  },
];

export const seoQueueGovernanceBlockingReasons = [
  'Herramienta sin contrato dry-run',
  'Contrato marcado como blocked para Fase 6',
  'Paso sin owner o reviewer',
  'Paso sensible sin auditoría',
  'Paso sensible sin rollback',
  'Acción mutativa no permitida en gobernanza',
  'Divergencias críticas de catálogo',
] as const;
