import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  SeoQueueApprovalLevel,
  useSeoQueuePilotSelection,
} from '@/hooks/useSeoQueuePilotSelection';

const suitabilityVariant = {
  high: 'success',
  medium: 'warning',
  low: 'neutral',
} as const;

const approvalVariant: Record<SeoQueueApprovalLevel, 'success' | 'warning' | 'danger'> = {
  none: 'success',
  recommended: 'warning',
  required: 'danger',
};

const preparationCtas = [
  { label: 'Ver Tools Hub', path: '/app/tools-hub' },
  { label: 'Preparar GSC', path: '/app/gsc-impact' },
  { label: 'Revisar Checklist', path: '/app/checklist' },
  { label: 'Revisar Roadmap', path: '/app/client-roadmap' },
  { label: 'Ver Kanban', path: '/app/kanban' },
  { label: 'Validar completadas', path: '/app/completed-tasks' },
] as const;

export const SeoQueuePilotSelector: React.FC = () => {
  const {
    workflows,
    candidateWorkflows,
    notRecommendedWorkflows,
    selectedWorkflow,
    selectedWorkflowId,
    setSelectedWorkflowId,
    checklist,
    fulfilledRequirements,
    missingRequirements,
    risks,
    humanApprovalPolicy,
    blockedSteps,
    parallelSteps,
    simulatedOutputs,
    actionPackage,
  } = useSeoQueuePilotSelection();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');

  const copyPlan = async (format: 'markdown' | 'json') => {
    if (!actionPackage || !navigator.clipboard?.writeText) {
      setCopyStatus('unavailable');
      return;
    }

    await navigator.clipboard.writeText(
      format === 'markdown' ? actionPackage.markdown : actionPackage.json,
    );
    setCopyStatus('copied');
  };

  return (
    <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="piloto-cola-seo">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="primary">Fase 5B · selección local</Badge>
          <h2 className="mt-3 text-xl font-semibold text-foreground">
            Selección manual de workflows piloto
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Selecciona un workflow dry-run candidato, revisa requisitos, aprobación humana y paquete
            de acción simulado. Esta vista no crea tareas, no modifica roadmap, no ejecuta
            herramientas y no persiste selección.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Badge variant="success">{candidateWorkflows.length} candidatos</Badge>
          <Badge variant="neutral">{notRecommendedWorkflows.length} no recomendados</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[340px,minmax(0,1fr)]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workflows disponibles ({workflows.length})
          </p>
          {workflows.map((workflow) => {
            const isSelected = workflow.id === selectedWorkflowId;
            const isCandidate = candidateWorkflows.some(
              (candidate) => candidate.id === workflow.id,
            );
            return (
              <button
                key={workflow.id}
                type="button"
                className={`w-full rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-ring ${
                  isSelected
                    ? 'border-primary bg-primary-soft'
                    : 'border-border bg-surface-alt hover:border-primary'
                }`}
                onClick={() => setSelectedWorkflowId(workflow.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{workflow.name}</h3>
                  <Badge variant={suitabilityVariant[workflow.pilotSuitability]}>
                    {workflow.pilotSuitability}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {workflow.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant={isCandidate ? 'success' : 'warning'}>
                    {isCandidate ? 'candidato piloto' : 'revisar bloqueos'}
                  </Badge>
                  <Badge variant="neutral">{workflow.readiness}</Badge>
                </div>
              </button>
            );
          })}
        </div>

        {selectedWorkflow ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-alt p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedWorkflow.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selectedWorkflow.description}
                  </p>
                </div>
                <Badge variant={suitabilityVariant[selectedWorkflow.pilotSuitability]}>
                  suitability {selectedWorkflow.pilotSuitability}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Metric label="Requisitos cumplidos" value={fulfilledRequirements.length} />
                <Metric label="Requisitos faltantes" value={missingRequirements.length} />
                <Metric label="Pasos bloqueados" value={blockedSteps.length} />
                <Metric label="Paralelizables" value={parallelSteps.length} />
                <Metric label="Outputs simulados" value={simulatedOutputs.length} />
                <Metric
                  label="Revisores sugeridos"
                  value={selectedWorkflow.suggestedReviewers.length}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Checklist de readiness">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {checklist.map((item) => (
                    <li key={item.label} className="rounded-lg border border-border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <span>{item.label}</span>
                        <Badge variant={item.fulfilled ? 'success' : 'warning'}>
                          {item.fulfilled ? 'cumplido' : 'pendiente'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs">{item.reason}</p>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Política de aprobación humana">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {humanApprovalPolicy.map((item) => (
                    <li key={item.stepId} className="rounded-lg border border-border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{item.stepTitle}</span>
                        <Badge variant={approvalVariant[item.approvalLevel]}>
                          {item.approvalLevel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs">
                        {item.stepType} · {item.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <InfoList
                title="Bloqueos actuales"
                items={risks.length ? risks : ['Sin bloqueos críticos']}
              />
              <InfoList
                title="Pasos paralelos"
                items={
                  parallelSteps.length
                    ? parallelSteps.map((step) => step.title)
                    : ['Sin paralelización']
                }
              />
              <InfoList title="Outputs simulados" items={simulatedOutputs} />
            </div>

            {actionPackage ? (
              <div className="rounded-xl border border-border bg-surface-alt p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <Badge variant="warning">Vista previa · sin persistencia</Badge>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">
                      Paquete de acción simulado
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Preview en memoria para preparar Fase 6. No crea tareas, no modifica roadmap y
                      no ejecuta herramientas.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                      onClick={() => void copyPlan('markdown')}
                    >
                      Copiar plan Markdown
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                      onClick={() => void copyPlan('json')}
                    >
                      Copiar JSON
                    </button>
                  </div>
                </div>
                {copyStatus !== 'idle' ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {copyStatus === 'copied'
                      ? 'Paquete copiado mediante acción explícita del usuario.'
                      : 'Clipboard API no disponible; usa la vista previa visual.'}
                  </p>
                ) : null}
                <pre className="mt-4 max-h-80 overflow-auto rounded-lg border border-border bg-white p-4 text-xs leading-5 text-muted-foreground">
                  {actionPackage.markdown}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {preparationCtas.map((cta) => (
          <Link
            key={cta.path}
            className="inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            to={cta.path}
          >
            {cta.label}
          </Link>
        ))}
      </div>
    </Card>
  );
};

interface MetricProps {
  label: string;
  value: number | string;
}

const Metric: React.FC<MetricProps> = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-white p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
  </div>
);

interface PanelProps {
  title: string;
  children: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ title, children }) => (
  <div className="rounded-xl border border-border bg-surface-alt p-4">
    <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
    {children}
  </div>
);

interface InfoListProps {
  title: string;
  items: string[];
}

const InfoList: React.FC<InfoListProps> = ({ title, items }) => (
  <div className="rounded-xl border border-border bg-surface-alt p-4">
    <p className="text-sm font-semibold text-foreground">{title}</p>
    <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  </div>
);
