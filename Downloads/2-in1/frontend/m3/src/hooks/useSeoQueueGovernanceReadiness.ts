import { useMemo } from 'react';
import {
  seoQueueGovernanceBlockingReasons,
  seoQueuePhase6Criteria,
  seoQueueStepGovernancePolicies,
  seoQueueToolDryRunContracts,
  SeoQueueGovernanceReadiness,
} from '@/config/seoQueueGovernance';
import { seoQueueWorkflows, SeoQueueStepType } from '@/config/seoQueueWorkflows';
import { sharedToolsCatalog } from '@/config/toolsCatalog';
import { useSeoQueuePilotSelection } from '@/hooks/useSeoQueuePilotSelection';
import { useToolsCatalogReconciliation } from '@/hooks/useToolsCatalogReconciliation';
import { useToolsCatalogSignals } from '@/hooks/useToolsCatalogSignals';

export interface SeoQueueGovernanceChecklistItem {
  id: string;
  label: string;
  description: string;
  fulfilled: boolean;
  blockingReason?: string;
}

export interface SeoQueueGovernanceIssue {
  id: string;
  label: string;
  severity: SeoQueueGovernanceReadiness;
  recommendation: string;
}

export interface SeoQueueGovernanceReadinessResult {
  readiness: SeoQueueGovernanceReadiness;
  readinessScore: number;
  workflowsReady: number;
  workflowsPartial: number;
  workflowsBlocked: number;
  toolsWithContract: number;
  toolsWithoutContract: string[];
  contractsReady: number;
  contractsPartial: number;
  contractsBlocked: number;
  stepsWithoutOwner: string[];
  stepsWithoutReviewer: string[];
  stepsWithoutHumanPolicy: string[];
  stepsWithoutAudit: string[];
  stepsWithoutRollback: string[];
  actionsNotAllowedForExecution: string[];
  blockingReasons: string[];
  checklist: SeoQueueGovernanceChecklistItem[];
  issues: SeoQueueGovernanceIssue[];
  governanceReportMarkdown: string;
  governanceReportJson: string;
}

const policyByStepType = new Map(
  seoQueueStepGovernancePolicies.map((policy) => [policy.stepType, policy]),
);
const contractByToolId = new Map(
  seoQueueToolDryRunContracts.map((contract) => [contract.toolId, contract]),
);
const catalogToolIds = new Set(sharedToolsCatalog.map((tool) => tool.id));

const unique = (items: string[]) => Array.from(new Set(items));

const buildReportMarkdown = (
  result: Omit<
    SeoQueueGovernanceReadinessResult,
    'governanceReportMarkdown' | 'governanceReportJson'
  >,
) =>
  [
    '# Gobernanza para ejecución controlada',
    '',
    '> Informe read-only. No ejecuta herramientas, no crea jobs, no crea tareas y no modifica roadmap.',
    '',
    `Readiness global: ${result.readiness} (${result.readinessScore}%)`,
    '',
    '## Checklist Fase 6',
    ...result.checklist.map(
      (item) => `- [${item.fulfilled ? 'x' : ' '}] ${item.label}: ${item.description}`,
    ),
    '',
    '## Bloqueos',
    ...(result.blockingReasons.length
      ? result.blockingReasons.map((reason) => `- ${reason}`)
      : ['- Sin bloqueos críticos']),
    '',
    '## Herramientas sin contrato',
    ...(result.toolsWithoutContract.length
      ? result.toolsWithoutContract.map((tool) => `- ${tool}`)
      : ['- Ninguna']),
    '',
    '## Acciones no aptas para ejecución',
    ...(result.actionsNotAllowedForExecution.length
      ? result.actionsNotAllowedForExecution.map((action) => `- ${action}`)
      : ['- Ninguna']),
  ].join('\n');

export const useSeoQueueGovernanceReadiness = (): SeoQueueGovernanceReadinessResult => {
  const pilotSelection = useSeoQueuePilotSelection();
  const toolsSignals = useToolsCatalogSignals();
  const reconciliation = useToolsCatalogReconciliation();

  return useMemo(() => {
    const requiredToolIds = unique(seoQueueWorkflows.flatMap((workflow) => workflow.requiredTools));
    const toolsWithoutContract = requiredToolIds.filter((toolId) => !contractByToolId.has(toolId));
    const contractsReady = seoQueueToolDryRunContracts.filter(
      (contract) => contract.readinessForPhase6 === 'ready',
    ).length;
    const contractsPartial = seoQueueToolDryRunContracts.filter(
      (contract) => contract.readinessForPhase6 === 'partial',
    ).length;
    const contractsBlocked = seoQueueToolDryRunContracts.filter(
      (contract) => contract.readinessForPhase6 === 'blocked',
    ).length;

    const stepsWithoutHumanPolicy = unique(
      seoQueueWorkflows.flatMap((workflow) =>
        workflow.steps
          .filter((step) => !policyByStepType.has(step.type))
          .map((step) => `${workflow.name} · ${step.title}`),
      ),
    );
    const stepsWithoutOwner = unique(
      seoQueueWorkflows.flatMap((workflow) =>
        workflow.suggestedOwnerArea
          ? []
          : workflow.steps.map((step) => `${workflow.name} · ${step.title}`),
      ),
    );
    const stepsWithoutReviewer = unique(
      seoQueueWorkflows.flatMap((workflow) =>
        workflow.suggestedReviewers.length
          ? []
          : workflow.steps.map((step) => `${workflow.name} · ${step.title}`),
      ),
    );
    const stepsWithoutAudit = unique(
      seoQueueWorkflows.flatMap((workflow) =>
        workflow.steps
          .filter((step) => !policyByStepType.get(step.type)?.requiresAuditLog)
          .map((step) => `${workflow.name} · ${step.title}`),
      ),
    );
    const stepsWithoutRollback = unique(
      seoQueueWorkflows.flatMap((workflow) =>
        workflow.steps
          .filter((step) => {
            const policy = policyByStepType.get(step.type);
            return policy?.riskLevel === 'high' && !policy.requiresRollbackPlan;
          })
          .map((step) => `${workflow.name} · ${step.title}`),
      ),
    );
    const actionsNotAllowedForExecution = seoQueueStepGovernancePolicies.flatMap((policy) => {
      const blocked: string[] = [];
      if (!policy.canCreateTask) blocked.push(`${policy.stepType}: crear tareas`);
      if (!policy.canModifyRoadmap) blocked.push(`${policy.stepType}: modificar roadmap`);
      if (!policy.canCallExternalApi) blocked.push(`${policy.stepType}: llamar APIs externas`);
      if (!policy.canChangeWebsite) blocked.push(`${policy.stepType}: cambiar web`);
      return blocked;
    });

    const blockingReasons = unique([
      ...(toolsWithoutContract.length ? ['Herramientas requeridas sin contrato dry-run'] : []),
      ...(contractsBlocked > 0 ? ['Hay contratos bloqueados para Fase 6'] : []),
      ...(stepsWithoutHumanPolicy.length ? ['Hay pasos sin política humana'] : []),
      ...(stepsWithoutAudit.length ? ['Hay pasos sin auditoría mínima'] : []),
      ...(stepsWithoutRollback.length ? ['Hay pasos high-risk sin rollback'] : []),
      ...(reconciliation.summary.criticalDivergences > 0
        ? ['Divergencias críticas de catálogo pendientes']
        : []),
      ...seoQueueGovernanceBlockingReasons.filter((reason) =>
        reason.includes('mutativa') ? true : false,
      ),
    ]);

    const checklist = seoQueuePhase6Criteria.map<SeoQueueGovernanceChecklistItem>((criterion) => {
      const fulfilledById: Record<string, boolean> = {
        contracts: toolsWithoutContract.length === 0 && contractsBlocked === 0,
        'approval-policy':
          stepsWithoutHumanPolicy.length === 0 && stepsWithoutReviewer.length === 0,
        'audit-log': stepsWithoutAudit.length === 0,
        rollback: stepsWithoutRollback.length === 0,
        'no-direct-mutation': true,
      };
      const fulfilled = fulfilledById[criterion.id] ?? false;
      return {
        ...criterion,
        fulfilled,
        blockingReason: fulfilled ? undefined : 'Requisito pendiente para Fase 6.',
      };
    });

    const workflowsReady = pilotSelection.workflows.filter(
      (workflow) => workflow.readiness === 'simulable',
    ).length;
    const workflowsPartial = pilotSelection.workflows.filter(
      (workflow) => workflow.readiness === 'partial',
    ).length;
    const workflowsBlocked = pilotSelection.workflows.filter(
      (workflow) => workflow.readiness === 'blocked',
    ).length;
    const fulfilledChecklist = checklist.filter((item) => item.fulfilled).length;
    const readinessScore = Math.round((fulfilledChecklist / checklist.length) * 100);
    const readiness: SeoQueueGovernanceReadiness =
      blockingReasons.length > 0 || reconciliation.status !== 'ready'
        ? 'blocked'
        : readinessScore === 100 && toolsSignals.readyForDryRun > 0
          ? 'ready'
          : 'partial';

    const issues: SeoQueueGovernanceIssue[] = [
      ...toolsWithoutContract.map((toolId) => ({
        id: `missing-contract-${toolId}`,
        label: `Contrato no definido para ${toolId}`,
        severity: 'blocked' as const,
        recommendation: 'Crear contrato dry-run antes de permitir selección para Fase 6.',
      })),
      ...stepsWithoutHumanPolicy.map((step) => ({
        id: `missing-policy-${step}`,
        label: `Política humana no definida: ${step}`,
        severity: 'blocked' as const,
        recommendation: 'Asignar política de aprobación por tipo de paso.',
      })),
      ...stepsWithoutRollback.map((step) => ({
        id: `missing-rollback-${step}`,
        label: `Rollback requerido: ${step}`,
        severity: 'partial' as const,
        recommendation: 'Definir rollback o mantener el paso no apto para ejecución.',
      })),
    ];

    const baseResult = {
      readiness,
      readinessScore,
      workflowsReady,
      workflowsPartial,
      workflowsBlocked,
      toolsWithContract: requiredToolIds.filter((toolId) => contractByToolId.has(toolId)).length,
      toolsWithoutContract: toolsWithoutContract.filter((toolId) => catalogToolIds.has(toolId)),
      contractsReady,
      contractsPartial,
      contractsBlocked,
      stepsWithoutOwner,
      stepsWithoutReviewer,
      stepsWithoutHumanPolicy,
      stepsWithoutAudit,
      stepsWithoutRollback,
      actionsNotAllowedForExecution: unique(actionsNotAllowedForExecution),
      blockingReasons,
      checklist,
      issues,
    };

    const governanceReportMarkdown = buildReportMarkdown(baseResult);
    return {
      ...baseResult,
      governanceReportMarkdown,
      governanceReportJson: JSON.stringify(
        {
          ...baseResult,
          readOnlyNotice:
            'Informe simulado/read-only: no ejecuta herramientas, no crea jobs, no crea tareas y no modifica roadmap.',
        },
        null,
        2,
      ),
    };
  }, [pilotSelection.workflows, reconciliation, toolsSignals.readyForDryRun]);
};
