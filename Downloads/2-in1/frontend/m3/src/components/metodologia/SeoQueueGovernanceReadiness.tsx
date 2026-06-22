import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  seoQueueStepGovernancePolicies,
  seoQueueToolDryRunContracts,
} from '@/config/seoQueueGovernance';
import { useSeoQueueGovernanceReadiness } from '@/hooks/useSeoQueueGovernanceReadiness';

const readinessVariant = {
  ready: 'success',
  partial: 'warning',
  blocked: 'danger',
} as const;

const governanceCtas = [
  { label: 'Revisar Tools Hub', path: '/app/tools-hub' },
  { label: 'Preparar Checklist', path: '/app/checklist' },
  { label: 'Revisar GSC Impact', path: '/app/gsc-impact' },
  { label: 'Revisar Roadmap', path: '/app/client-roadmap' },
  { label: 'Ver Kanban', path: '/app/kanban' },
] as const;

export const SeoQueueGovernanceReadiness: React.FC = () => {
  const readiness = useSeoQueueGovernanceReadiness();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');

  const copyReport = async (format: 'markdown' | 'json') => {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('unavailable');
      return;
    }

    await navigator.clipboard.writeText(
      format === 'markdown' ? readiness.governanceReportMarkdown : readiness.governanceReportJson,
    );
    setCopyStatus('copied');
  };

  return (
    <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="gobernanza-cola-seo">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="warning">Fase 5C · gobierno read-only</Badge>
          <h2 className="mt-3 text-xl font-semibold text-foreground">
            Gobernanza para ejecución controlada
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Esta capa prepara permisos, contratos dry-run, aprobación humana, auditoría, rollback y
            límites de seguridad. No ejecuta nada, no crea jobs, no crea tareas y no modifica
            roadmap.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Badge variant={readinessVariant[readiness.readiness]}>{readiness.readiness}</Badge>
          <Badge variant="neutral">{readiness.readinessScore}% readiness</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Metric label="Workflows listos" value={readiness.workflowsReady} />
        <Metric label="Workflows parciales" value={readiness.workflowsPartial} />
        <Metric label="Workflows bloqueados" value={readiness.workflowsBlocked} />
        <Metric label="Contratos cubiertos" value={readiness.toolsWithContract} />
        <Metric label="Contratos ready" value={readiness.contractsReady} />
        <Metric label="Contratos parciales" value={readiness.contractsPartial} />
        <Metric label="Contratos bloqueados" value={readiness.contractsBlocked} />
        <Metric label="Bloqueos actuales" value={readiness.blockingReasons.length} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
        <section className="rounded-xl border border-border bg-surface-alt p-4">
          <h3 className="font-semibold text-foreground">Matriz de permisos por tipo de paso</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Paso</th>
                  <th className="px-2 py-2">Aprobación</th>
                  <th className="px-2 py-2">Dry-run</th>
                  <th className="px-2 py-2">Fase 6 futura</th>
                  <th className="px-2 py-2">Mutaciones bloqueadas</th>
                </tr>
              </thead>
              <tbody>
                {seoQueueStepGovernancePolicies.map((policy) => (
                  <tr key={policy.stepType} className="border-t border-border">
                    <td className="px-2 py-2 font-medium text-foreground">{policy.stepType}</td>
                    <td className="px-2 py-2">
                      <Badge variant={policy.requiresHumanApproval ? 'danger' : 'success'}>
                        {policy.approvalRequirement}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">{policy.allowedInDryRun ? 'sí' : 'no'}</td>
                    <td className="px-2 py-2">
                      {policy.allowedInControlledExecution ? 'condicional' : 'no apto'}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {!policy.canCreateTask &&
                      !policy.canModifyRoadmap &&
                      !policy.canCallExternalApi
                        ? 'tareas · roadmap · APIs'
                        : 'revisar contrato'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface-alt p-4">
          <h3 className="font-semibold text-foreground">
            Checklist ready for controlled execution
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {readiness.checklist.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <Badge variant={item.fulfilled ? 'success' : 'danger'}>
                    {item.fulfilled ? 'cumplido' : 'pendiente'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <InfoList
          title="Bloqueos actuales"
          items={
            readiness.blockingReasons.length ? readiness.blockingReasons : ['Sin bloqueos críticos']
          }
        />
        <InfoList
          title="Riesgos pendientes"
          items={
            readiness.issues.length
              ? readiness.issues.map((issue) => issue.label)
              : ['Sin issues críticos']
          }
        />
        <InfoList
          title="No apto para ejecución sin revisión"
          items={readiness.actionsNotAllowedForExecution.slice(0, 10)}
        />
      </div>

      <section className="mt-5 rounded-xl border border-border bg-surface-alt p-4">
        <h3 className="font-semibold text-foreground">Contratos dry-run por herramienta</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {seoQueueToolDryRunContracts.map((contract) => (
            <article key={contract.toolId} className="rounded-lg border border-border bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-medium text-foreground">{contract.toolName}</h4>
                <Badge variant={readinessVariant[contract.readinessForPhase6]}>
                  {contract.readinessForPhase6}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Modos: {contract.allowedModes.join(', ')}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Bloqueado: {contract.blockedActions.slice(0, 3).join(' · ')}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-surface-alt p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Badge variant="neutral">Preview de informe</Badge>
            <h3 className="mt-2 font-semibold text-foreground">Informe de gobernanza</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Copia opcional mediante acción explícita. No se guarda en storage ni se envía a
              backend.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => void copyReport('markdown')}
            >
              Copiar Markdown
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => void copyReport('json')}
            >
              Copiar JSON
            </button>
          </div>
        </div>
        {copyStatus !== 'idle' ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {copyStatus === 'copied'
              ? 'Informe copiado por acción explícita del usuario.'
              : 'Clipboard API no disponible; usa la preview visual.'}
          </p>
        ) : null}
        <pre className="mt-4 max-h-72 overflow-auto rounded-lg border border-border bg-white p-4 text-xs leading-5 text-muted-foreground">
          {readiness.governanceReportMarkdown}
        </pre>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {governanceCtas.map((cta) => (
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
  <div className="rounded-lg border border-border bg-surface-alt p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
  </div>
);

interface InfoListProps {
  title: string;
  items: string[];
}

const InfoList: React.FC<InfoListProps> = ({ title, items }) => (
  <div className="rounded-xl border border-border bg-surface-alt p-4">
    <p className="font-semibold text-foreground">{title}</p>
    <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  </div>
);
