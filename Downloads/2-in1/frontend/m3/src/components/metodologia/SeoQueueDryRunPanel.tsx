import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SeoQueueDryRunReadiness, useSeoQueueDryRun } from '@/hooks/useSeoQueueDryRun';

const readinessVariant: Record<SeoQueueDryRunReadiness, 'success' | 'warning' | 'danger'> = {
  simulable: 'success',
  partial: 'warning',
  blocked: 'danger',
};

const workflowFilters = [
  { id: 'all', label: 'Todos' },
  { id: 'simulable', label: 'Simulables' },
  { id: 'partial', label: 'Parciales' },
  { id: 'blocked', label: 'Bloqueados' },
] as const;

const routeCtas = [
  { label: 'Ver en Tools Hub', path: '/app/tools-hub' },
  { label: 'Ir a Checklist', path: '/app/checklist' },
  { label: 'Ir a GSC Impact', path: '/app/gsc-impact' },
  { label: 'Ir a Roadmap', path: '/app/client-roadmap' },
  { label: 'Ir a Kanban', path: '/app/kanban' },
] as const;

export const SeoQueueDryRunPanel: React.FC = () => {
  const { workflows, summary, recommendationsCount } = useSeoQueueDryRun();
  const [activeFilterId, setActiveFilterId] =
    useState<(typeof workflowFilters)[number]['id']>('all');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(workflows[0]?.id || '');

  const filteredWorkflows = useMemo(
    () =>
      activeFilterId === 'all'
        ? workflows
        : workflows.filter((workflow) => workflow.readiness === activeFilterId),
    [activeFilterId, workflows],
  );

  const selectedWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ||
    filteredWorkflows[0] ||
    workflows[0];

  return (
    <Card className="overflow-hidden border-border bg-white p-0 shadow-sm" id="cola-seo-dry-run">
      <div className="border-b border-border bg-surface-alt p-5 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Badge variant="warning">Dry-run simulado</Badge>
            <h2 className="mt-3 text-xl font-semibold text-foreground">Cola SEO dry-run</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              Simulador frontend de workflows. No ejecuta herramientas, no crea jobs, no crea
              tareas, no edita roadmap y no escribe datos. Solo muestra preparación, bloqueos, logs
              simulados y outputs esperados.
            </p>
          </div>
          <Badge variant={readinessVariant[summary.readiness]}>{summary.readiness}</Badge>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-4">
        <Metric label="Workflows" value={summary.total} variant="neutral" />
        <Metric label="Simulables" value={summary.simulable} variant="success" />
        <Metric label="Parciales" value={summary.partial} variant="warning" />
        <Metric label="Bloqueados" value={summary.blocked} variant="danger" />
        <Metric label="Pasos listos" value={summary.stepsReady} variant="success" />
        <Metric label="Pasos bloqueados" value={summary.stepsBlocked} variant="danger" />
        <Metric label="Revisión humana" value={summary.stepsHumanReview} variant="warning" />
        <Metric label="Paralelizables" value={summary.parallelSteps} variant="neutral" />
      </div>

      <div
        className="flex flex-wrap gap-2 px-5 pb-5 sm:px-6"
        aria-label="Filtros de workflows dry-run"
      >
        {workflowFilters.map((filter) => {
          const isActive = filter.id === activeFilterId;
          return (
            <button
              key={filter.id}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-ring ${
                isActive
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border bg-surface-alt text-foreground hover:border-primary hover:text-primary'
              }`}
              onClick={() => setActiveFilterId(filter.id)}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 px-5 pb-5 sm:px-6 xl:grid-cols-[340px,minmax(0,1fr)]">
        <div className="space-y-3">
          {filteredWorkflows.map((workflow) => (
            <button
              key={workflow.id}
              type="button"
              className={`w-full rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-ring ${
                workflow.id === selectedWorkflow?.id
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface-alt hover:border-primary'
              }`}
              onClick={() => setSelectedWorkflowId(workflow.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-foreground">{workflow.name}</h3>
                <Badge variant={readinessVariant[workflow.readiness]}>{workflow.readiness}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{workflow.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {workflow.readySteps} listos · {workflow.blockedSteps} bloqueados ·{' '}
                {workflow.humanReviewSteps} revisión humana
              </p>
            </button>
          ))}
        </div>

        {selectedWorkflow ? (
          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{selectedWorkflow.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selectedWorkflow.description}</p>
              </div>
              <Badge variant="neutral">{selectedWorkflow.riskLevel} risk</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoBlock title="Señales requeridas" items={selectedWorkflow.requiredSignals} />
              <InfoBlock title="Herramientas requeridas" items={selectedWorkflow.requiredTools} />
              <InfoBlock title="Outputs esperados" items={selectedWorkflow.expectedOutputs} />
              <InfoBlock
                title="Bloqueos workflow"
                items={
                  selectedWorkflow.blockedReasons.length
                    ? selectedWorkflow.blockedReasons
                    : ['Sin bloqueos globales']
                }
              />
            </div>

            <div className="mt-5 space-y-3">
              {selectedWorkflow.steps.map((step) => (
                <article key={step.id} className="rounded-lg border border-border bg-white p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{step.title}</h4>
                        <Badge variant="neutral">{step.type}</Badge>
                        {step.canRunInParallel ? (
                          <Badge variant="primary">paralelizable</Badge>
                        ) : null}
                        {step.requiresHumanReview ? (
                          <Badge variant="warning">revisión humana</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                    <Badge
                      variant={
                        step.readiness === 'ready'
                          ? 'success'
                          : step.readiness === 'human-review'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {step.readiness}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <InfoBlock
                      title="Depende de"
                      items={step.dependsOnStepIds.length ? step.dependsOnStepIds : ['Inicio']}
                    />
                    <InfoBlock title="Duración simulada" items={[step.simulatedDurationLabel]} />
                    <InfoBlock
                      title="Bloqueos"
                      items={
                        step.blockedReasons.length ? step.blockedReasons : ['Sin bloqueos de paso']
                      }
                    />
                    <InfoBlock title="Output preview" items={[step.outputPreview]} />
                  </div>

                  <div className="mt-3 rounded-lg border border-dashed border-border bg-surface-alt p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Logs simulados
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {step.dryRunLogMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border bg-surface-alt p-5 sm:p-6">
        {routeCtas.map((cta) => (
          <Link
            key={cta.path}
            className="inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            to={cta.path}
          >
            {cta.label}
          </Link>
        ))}
        <Badge variant="neutral">
          {recommendationsCount} recomendaciones metodológicas disponibles
        </Badge>
      </div>
    </Card>
  );
};

interface MetricProps {
  label: string;
  value: number | string;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
}

const Metric: React.FC<MetricProps> = ({ label, value, variant }) => (
  <div className="rounded-xl border border-border bg-surface-alt p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Badge variant={variant}>{value}</Badge>
    </div>
  </div>
);

interface InfoBlockProps {
  title: string;
  items: string[];
}

const InfoBlock: React.FC<InfoBlockProps> = ({ title, items }) => (
  <div className="rounded-lg border border-border bg-white p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  </div>
);
