import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { advancedMethodPhases } from '@/config/seoAdvancedMethod';

export const AdvancedMethodPhases: React.FC = () => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="fases">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Fases avanzadas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fases, criterios, entregables y conexiones operativas definidos desde configuración
          tipada.
        </p>
      </div>
      <Badge variant="success">{advancedMethodPhases.length} fases conectadas</Badge>
    </div>

    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      {advancedMethodPhases.map((phase, index) => (
        <article key={phase.id} className="rounded-xl border border-border bg-surface-alt p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
                {index + 1}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{phase.title}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {phase.relatedRoutes.map((route) => (
                <Link key={`${phase.id}-${route.path}`} to={route.path}>
                  <Badge variant="neutral">{route.label}</Badge>
                </Link>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{phase.objective}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <CriteriaList title="Criterios de entrada" items={phase.entryCriteria} />
            <CriteriaList title="Criterios de salida" items={phase.exitCriteria} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <PhaseSummary title="Acciones recomendadas" items={phase.recommendedActions} />
            <PhaseSummary title="Entregables esperados" items={phase.expectedDeliverables} />
            <PhaseSummary title="Herramientas relacionadas" items={phase.relatedTools} />
            <PhaseSummary title="Riesgos / checkpoints" items={phase.risksAndCheckpoints} />
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-border bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workflows futuros sugeridos
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {phase.futureWorkflows.join(' · ')}
            </p>
          </div>
        </article>
      ))}
    </div>
  </Card>
);

interface ListProps {
  title: string;
  items: string[];
}

const CriteriaList: React.FC<ListProps> = ({ title, items }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <ul className="mt-2 space-y-1.5 text-sm text-foreground">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  </div>
);

const PhaseSummary: React.FC<ListProps> = ({ title, items }) => (
  <div className="rounded-lg border border-border bg-white p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <p className="mt-2 text-sm text-muted-foreground">{items.join(' · ')}</p>
  </div>
);
