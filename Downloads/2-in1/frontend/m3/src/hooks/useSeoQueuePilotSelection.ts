import { useMemo, useState } from 'react';
import {
  SeoQueueDryRunStep,
  SeoQueueDryRunWorkflow,
  useSeoQueueDryRun,
} from '@/hooks/useSeoQueueDryRun';

export type SeoQueuePilotRecommendation = 'candidate' | 'not_recommended';
export type SeoQueueApprovalLevel = 'none' | 'recommended' | 'required';

export interface SeoQueuePilotChecklistItem {
  label: string;
  fulfilled: boolean;
  reason: string;
}

export interface SeoQueueApprovalPolicyItem {
  stepId: string;
  stepTitle: string;
  stepType: SeoQueueDryRunStep['type'];
  approvalLevel: SeoQueueApprovalLevel;
  reason: string;
}

export interface SeoQueueActionPackagePreview {
  workflowId: string;
  workflowName: string;
  objective: string;
  requirements: SeoQueuePilotChecklistItem[];
  steps: Array<{
    id: string;
    title: string;
    type: SeoQueueDryRunStep['type'];
    readiness: SeoQueueDryRunStep['readiness'];
    dependsOnStepIds: string[];
    canRunInParallel: boolean;
  }>;
  dependencies: string[];
  requiredTools: string[];
  requiredSignals: string[];
  blockers: string[];
  humanApprovalPolicy: SeoQueueApprovalPolicyItem[];
  expectedOutputs: string[];
  nextPhaseRecommendations: string[];
  markdown: string;
  json: string;
}

export interface SeoQueuePilotSelectionResult {
  workflows: SeoQueueDryRunWorkflow[];
  candidateWorkflows: SeoQueueDryRunWorkflow[];
  notRecommendedWorkflows: SeoQueueDryRunWorkflow[];
  selectedWorkflow?: SeoQueueDryRunWorkflow;
  selectedWorkflowId: string;
  setSelectedWorkflowId: (workflowId: string) => void;
  checklist: SeoQueuePilotChecklistItem[];
  fulfilledRequirements: SeoQueuePilotChecklistItem[];
  missingRequirements: SeoQueuePilotChecklistItem[];
  risks: string[];
  humanApprovalPolicy: SeoQueueApprovalPolicyItem[];
  blockedSteps: SeoQueueDryRunStep[];
  parallelSteps: SeoQueueDryRunStep[];
  simulatedOutputs: string[];
  actionPackage?: SeoQueueActionPackagePreview;
}

const approvalByStepType: Record<SeoQueueDryRunStep['type'], SeoQueueApprovalLevel> = {
  precheck: 'none',
  analysis: 'none',
  recommendation: 'recommended',
  validation: 'recommended',
  export: 'required',
  'human-review': 'required',
};

const approvalReasonByStepType: Record<SeoQueueDryRunStep['type'], string> = {
  precheck: 'Precheck informativo; no requiere aprobación si no hay ejecución real.',
  analysis: 'Análisis simulado; no requiere aprobación mientras sea read-only.',
  recommendation:
    'Recomendación metodológica; conviene revisión humana antes de convertirla en acción.',
  validation:
    'Validación simulada; conviene revisión humana antes de reportar o cerrar decisiones.',
  export: 'Exportación o entregable; requiere aprobación previa antes de compartirlo formalmente.',
  'human-review': 'Paso diseñado explícitamente como control de aprobación humana obligatoria.',
};

const buildApprovalPolicy = (workflow?: SeoQueueDryRunWorkflow): SeoQueueApprovalPolicyItem[] => {
  if (!workflow) return [];

  return workflow.steps.map((step) => {
    const approvalLevel = step.requiresHumanReview ? 'required' : approvalByStepType[step.type];
    return {
      stepId: step.id,
      stepTitle: step.title,
      stepType: step.type,
      approvalLevel,
      reason: step.requiresHumanReview
        ? 'Aprobación obligatoria porque el paso o una herramienta asociada requiere revisión humana.'
        : approvalReasonByStepType[step.type],
    };
  });
};

const buildChecklist = (workflow?: SeoQueueDryRunWorkflow): SeoQueuePilotChecklistItem[] => {
  if (!workflow) return [];

  const missingSignals = new Set(workflow.missingSignals);
  const missingTools = new Set(workflow.missingTools);
  const blockers = workflow.blockedReasons.join(' ');

  return workflow.minimumRequirements.map((requirement) => {
    const normalized = requirement.toLowerCase();
    const signalBlocked = Array.from(missingSignals).some((signal) =>
      normalized.includes(signal.replace(/-/g, ' ')),
    );
    const toolBlocked = Array.from(missingTools).some((tool) => normalized.includes(tool));
    const globallyBlocked = blockers.toLowerCase().includes(normalized);
    const fulfilled =
      workflow.readiness !== 'blocked' && !signalBlocked && !toolBlocked && !globallyBlocked;

    return {
      label: requirement,
      fulfilled,
      reason: fulfilled
        ? 'Disponible para revisión piloto en modo dry-run.'
        : 'Requisito pendiente o bloqueado por señales/herramientas actuales.',
    };
  });
};

const buildMarkdownPackage = (
  workflow: SeoQueueDryRunWorkflow,
  checklist: SeoQueuePilotChecklistItem[],
  approvalPolicy: SeoQueueApprovalPolicyItem[],
): string =>
  [
    `# Paquete de acción simulado: ${workflow.name}`,
    '',
    '> Vista previa read-only. No crea tareas, no modifica roadmap y no ejecuta herramientas.',
    '',
    `## Objetivo`,
    workflow.description,
    '',
    `## Requisitos`,
    ...checklist.map((item) => `- [${item.fulfilled ? 'x' : ' '}] ${item.label} — ${item.reason}`),
    '',
    `## Pasos`,
    ...workflow.steps.map(
      (step) =>
        `- ${step.title} (${step.type}, ${step.readiness}) · depende de: ${step.dependsOnStepIds.join(', ') || 'inicio'}`,
    ),
    '',
    `## Herramientas requeridas`,
    ...(workflow.requiredTools.length
      ? workflow.requiredTools.map((tool) => `- ${tool}`)
      : ['- Ninguna']),
    '',
    `## Señales requeridas`,
    ...(workflow.requiredSignals.length
      ? workflow.requiredSignals.map((signal) => `- ${signal}`)
      : ['- Ninguna']),
    '',
    `## Bloqueos`,
    ...(workflow.blockedReasons.length
      ? workflow.blockedReasons.map((blocker) => `- ${blocker}`)
      : ['- Sin bloqueos globales']),
    '',
    `## Política humana`,
    ...approvalPolicy.map((item) => `- ${item.stepTitle}: ${item.approvalLevel} — ${item.reason}`),
    '',
    `## Outputs esperados`,
    ...workflow.packageOutputs.map((output) => `- ${output}`),
    '',
    `## Recomendaciones Fase 6`,
    ...workflow.nextPhaseWarnings.map((warning) => `- ${warning}`),
  ].join('\n');

const buildActionPackage = (
  workflow?: SeoQueueDryRunWorkflow,
  checklist: SeoQueuePilotChecklistItem[] = [],
  approvalPolicy: SeoQueueApprovalPolicyItem[] = [],
): SeoQueueActionPackagePreview | undefined => {
  if (!workflow) return undefined;

  const blockers = [
    ...workflow.blockedReasons,
    ...workflow.steps.flatMap((step) => step.blockedReasons),
  ];
  const uniqueBlockers = Array.from(new Set(blockers));
  const markdown = buildMarkdownPackage(workflow, checklist, approvalPolicy);
  const preview = {
    workflowId: workflow.id,
    workflowName: workflow.name,
    objective: workflow.description,
    requirements: checklist,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      title: step.title,
      type: step.type,
      readiness: step.readiness,
      dependsOnStepIds: step.dependsOnStepIds,
      canRunInParallel: step.canRunInParallel,
    })),
    dependencies: Array.from(new Set(workflow.steps.flatMap((step) => step.dependsOnStepIds))),
    requiredTools: workflow.requiredTools,
    requiredSignals: workflow.requiredSignals,
    blockers: uniqueBlockers,
    humanApprovalPolicy: approvalPolicy,
    expectedOutputs: workflow.packageOutputs,
    nextPhaseRecommendations: workflow.nextPhaseWarnings,
    markdown,
  };

  return {
    ...preview,
    json: JSON.stringify(
      {
        ...preview,
        markdown: undefined,
        json: undefined,
        readOnlyNotice:
          'Vista previa simulada: no crea tareas, no modifica roadmap y no ejecuta herramientas.',
      },
      null,
      2,
    ),
  };
};

export const useSeoQueuePilotSelection = (): SeoQueuePilotSelectionResult => {
  const { workflows } = useSeoQueueDryRun();
  const candidateWorkflows = useMemo(
    () =>
      workflows.filter(
        (workflow) =>
          workflow.readiness !== 'blocked' &&
          (workflow.pilotSuitability === 'high' || workflow.pilotSuitability === 'medium'),
      ),
    [workflows],
  );
  const notRecommendedWorkflows = useMemo(
    () => workflows.filter((workflow) => !candidateWorkflows.includes(workflow)),
    [candidateWorkflows, workflows],
  );
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const selectedWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ||
    candidateWorkflows[0] ||
    workflows[0];
  const checklist = useMemo(() => buildChecklist(selectedWorkflow), [selectedWorkflow]);
  const humanApprovalPolicy = useMemo(
    () => buildApprovalPolicy(selectedWorkflow),
    [selectedWorkflow],
  );
  const actionPackage = useMemo(
    () => buildActionPackage(selectedWorkflow, checklist, humanApprovalPolicy),
    [checklist, humanApprovalPolicy, selectedWorkflow],
  );

  return {
    workflows,
    candidateWorkflows,
    notRecommendedWorkflows,
    selectedWorkflow,
    selectedWorkflowId: selectedWorkflow?.id || selectedWorkflowId,
    setSelectedWorkflowId,
    checklist,
    fulfilledRequirements: checklist.filter((item) => item.fulfilled),
    missingRequirements: checklist.filter((item) => !item.fulfilled),
    risks: selectedWorkflow
      ? [...selectedWorkflow.nextPhaseWarnings, ...selectedWorkflow.blockedReasons]
      : [],
    humanApprovalPolicy,
    blockedSteps: selectedWorkflow?.steps.filter((step) => step.readiness === 'blocked') || [],
    parallelSteps: selectedWorkflow?.steps.filter((step) => step.canRunInParallel) || [],
    simulatedOutputs: selectedWorkflow?.packageOutputs || [],
    actionPackage,
  };
};
