import { useMemo } from 'react';
import { seoQueueWorkflows, SeoQueueWorkflowConfig } from '@/config/seoQueueWorkflows';
import { sharedToolsCatalog } from '@/config/toolsCatalog';
import { useAdvancedMethodPrioritization } from '@/hooks/useAdvancedMethodPrioritization';
import { AdvancedMethodSignal, useAdvancedMethodSignals } from '@/hooks/useAdvancedMethodSignals';
import { useToolsCatalogReconciliation } from '@/hooks/useToolsCatalogReconciliation';
import { useToolsCatalogSignals } from '@/hooks/useToolsCatalogSignals';

export type SeoQueueDryRunReadiness = 'simulable' | 'partial' | 'blocked';
export type SeoQueueDryRunStepReadiness = 'ready' | 'blocked' | 'human-review';

export interface SeoQueueDryRunStep {
  id: string;
  title: string;
  description: string;
  type: SeoQueueWorkflowConfig['steps'][number]['type'];
  dependsOnStepIds: string[];
  canRunInParallel: boolean;
  readiness: SeoQueueDryRunStepReadiness;
  requiredSignals: string[];
  requiredToolIds: string[];
  missingSignals: string[];
  missingTools: string[];
  blockedReasons: string[];
  simulatedDurationLabel: string;
  dryRunLogMessages: string[];
  outputPreview: string;
  requiresHumanReview: boolean;
}

export interface SeoQueueDryRunWorkflow {
  id: string;
  name: string;
  description: string;
  category: SeoQueueWorkflowConfig['category'];
  riskLevel: SeoQueueWorkflowConfig['riskLevel'];
  readiness: SeoQueueDryRunReadiness;
  recommendedFor: string[];
  requiredSignals: string[];
  requiredTools: string[];
  missingSignals: string[];
  missingTools: string[];
  blockedReasons: string[];
  expectedOutputs: string[];
  simulatedLogs: string[];
  steps: SeoQueueDryRunStep[];
  readySteps: number;
  blockedSteps: number;
  humanReviewSteps: number;
  parallelSteps: number;
}

export interface SeoQueueDryRunSummary {
  total: number;
  simulable: number;
  partial: number;
  blocked: number;
  stepsReady: number;
  stepsBlocked: number;
  stepsHumanReview: number;
  parallelSteps: number;
  readiness: SeoQueueDryRunReadiness;
}

export interface SeoQueueDryRunResult {
  workflows: SeoQueueDryRunWorkflow[];
  summary: SeoQueueDryRunSummary;
  recommendationsCount: number;
}

const getSignal = (signals: AdvancedMethodSignal[], id: string) =>
  signals.find((signal) => signal.id === id);

const isSignalAvailable = (signals: AdvancedMethodSignal[], id: string) =>
  getSignal(signals, id)?.status === 'available';

const toolById = new Map(sharedToolsCatalog.map((tool) => [tool.id, tool]));

export const useSeoQueueDryRun = (): SeoQueueDryRunResult => {
  const { hasActiveClient, signals } = useAdvancedMethodSignals();
  const prioritization = useAdvancedMethodPrioritization();
  const toolsSignals = useToolsCatalogSignals();
  const reconciliation = useToolsCatalogReconciliation();

  return useMemo(() => {
    const workflows = seoQueueWorkflows.map<SeoQueueDryRunWorkflow>((workflow) => {
      const workflowMissingSignals = workflow.requiredSignals.filter(
        (signalId) => !isSignalAvailable(signals, signalId),
      );
      const workflowMissingTools = workflow.requiredTools.filter((toolId) => !toolById.has(toolId));
      const workflowUnreconciledTools = workflow.requiredTools.filter((toolId) => {
        const item = reconciliation.items.find((candidate) => candidate.id === toolId);
        return !item || item.matchLevel !== 'matched';
      });
      const workflowBlockedReasons: string[] = [];

      if (!hasActiveClient) workflowBlockedReasons.push('No hay cliente activo.');
      if (workflowMissingSignals.length > 0) {
        workflowBlockedReasons.push(`Faltan señales: ${workflowMissingSignals.join(', ')}.`);
      }
      if (workflowMissingTools.length > 0) {
        workflowBlockedReasons.push(`Faltan herramientas: ${workflowMissingTools.join(', ')}.`);
      }
      if (workflowUnreconciledTools.length > 0) {
        workflowBlockedReasons.push(
          `Herramientas sin match reconciliado: ${workflowUnreconciledTools.join(', ')}.`,
        );
      }
      if (reconciliation.status !== 'ready' && workflow.requiredTools.length > 0) {
        workflowBlockedReasons.push('Reconciliación de catálogo no disponible en estado ready.');
      }
      if (reconciliation.summary.criticalDivergences > 0 && workflow.requiredTools.length > 0) {
        workflowBlockedReasons.push('Hay divergencias críticas en la reconciliación del catálogo.');
      }

      const steps = workflow.steps.map<SeoQueueDryRunStep>((step) => {
        const missingSignals = step.requiredSignals.filter(
          (signalId) => !isSignalAvailable(signals, signalId),
        );
        const missingTools = step.requiredToolIds.filter((toolId) => !toolById.has(toolId));
        const unreconciledTools = step.requiredToolIds.filter((toolId) => {
          const item = reconciliation.items.find((candidate) => candidate.id === toolId);
          return !item || item.matchLevel !== 'matched';
        });
        const requiredTools = step.requiredToolIds
          .map((toolId) => toolById.get(toolId))
          .filter(Boolean);
        const toolsWithoutDryRun = requiredTools.filter(
          (tool) => tool?.canRunInQueue && !tool.supportsDryRun,
        );
        const humanReviewTools = requiredTools.filter((tool) => tool?.requiresHumanReview);
        const blockedReasons: string[] = [];

        if (!hasActiveClient) blockedReasons.push('Workflow bloqueado: no hay cliente activo.');
        if (missingSignals.length > 0)
          blockedReasons.push(`Faltan señales: ${missingSignals.join(', ')}.`);
        if (missingTools.length > 0)
          blockedReasons.push(`Herramientas no catalogadas: ${missingTools.join(', ')}.`);
        if (unreconciledTools.length > 0) {
          blockedReasons.push(
            `Herramientas sin match reconciliado: ${unreconciledTools.join(', ')}.`,
          );
        }
        if (reconciliation.status !== 'ready' && step.requiredToolIds.length > 0) {
          blockedReasons.push('Reconciliación de catálogo no disponible en estado ready.');
        }
        if (toolsWithoutDryRun.length > 0) {
          blockedReasons.push(
            `Herramientas sin dry-run: ${toolsWithoutDryRun.map((tool) => tool?.name).join(', ')}.`,
          );
        }
        if (reconciliation.summary.criticalDivergences > 0 && step.requiredToolIds.length > 0) {
          blockedReasons.push(
            'Catálogo con divergencias críticas; no se simula paso dependiente de herramientas.',
          );
        }

        const requiresHumanReview = step.type === 'human-review' || humanReviewTools.length > 0;
        const readiness: SeoQueueDryRunStepReadiness =
          blockedReasons.length > 0 ? 'blocked' : requiresHumanReview ? 'human-review' : 'ready';

        return {
          id: step.id,
          title: step.title,
          description: step.description,
          type: step.type,
          dependsOnStepIds: step.dependsOnStepIds,
          canRunInParallel: step.canRunInParallel,
          readiness,
          requiredSignals: step.requiredSignals,
          requiredToolIds: step.requiredToolIds,
          missingSignals,
          missingTools,
          blockedReasons,
          simulatedDurationLabel: step.simulatedDurationLabel,
          dryRunLogMessages: [
            ...step.dryRunLogMessages,
            readiness === 'blocked'
              ? '[dry-run] Paso bloqueado; no se ejecutaría nada.'
              : '[dry-run] Paso simulable; no se ejecutaría nada real.',
          ],
          outputPreview: step.outputPreview,
          requiresHumanReview,
        };
      });

      const readySteps = steps.filter((step) => step.readiness === 'ready').length;
      const blockedSteps = steps.filter((step) => step.readiness === 'blocked').length;
      const humanReviewSteps = steps.filter((step) => step.readiness === 'human-review').length;
      const parallelSteps = steps.filter((step) => step.canRunInParallel).length;
      const readiness: SeoQueueDryRunReadiness =
        workflowBlockedReasons.length > 0 || blockedSteps === steps.length
          ? 'blocked'
          : blockedSteps > 0 || humanReviewSteps > 0
            ? 'partial'
            : 'simulable';

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        category: workflow.category,
        riskLevel: workflow.riskLevel,
        readiness,
        recommendedFor: workflow.recommendedFor,
        requiredSignals: workflow.requiredSignals,
        requiredTools: workflow.requiredTools,
        missingSignals: workflowMissingSignals,
        missingTools: workflowMissingTools,
        blockedReasons: workflowBlockedReasons,
        expectedOutputs: workflow.expectedOutputs,
        simulatedLogs: steps.flatMap((step) => step.dryRunLogMessages),
        steps,
        readySteps,
        blockedSteps,
        humanReviewSteps,
        parallelSteps,
      };
    });

    const summary = workflows.reduce<SeoQueueDryRunSummary>(
      (acc, workflow) => {
        acc.total += 1;
        if (workflow.readiness === 'simulable') acc.simulable += 1;
        if (workflow.readiness === 'partial') acc.partial += 1;
        if (workflow.readiness === 'blocked') acc.blocked += 1;
        acc.stepsReady += workflow.readySteps;
        acc.stepsBlocked += workflow.blockedSteps;
        acc.stepsHumanReview += workflow.humanReviewSteps;
        acc.parallelSteps += workflow.parallelSteps;
        return acc;
      },
      {
        total: 0,
        simulable: 0,
        partial: 0,
        blocked: 0,
        stepsReady: 0,
        stepsBlocked: 0,
        stepsHumanReview: 0,
        parallelSteps: 0,
        readiness: 'blocked',
      },
    );

    summary.readiness =
      summary.simulable > 0
        ? 'simulable'
        : summary.partial > 0 || toolsSignals.readyForDryRun > 0
          ? 'partial'
          : 'blocked';

    return {
      workflows,
      summary,
      recommendationsCount: prioritization.summary.total,
    };
  }, [
    hasActiveClient,
    prioritization.summary.total,
    reconciliation,
    signals,
    toolsSignals.readyForDryRun,
  ]);
};
