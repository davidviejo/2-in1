import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { advancedMethodPhaseFilters, advancedMethodPhases } from '@/config/seoAdvancedMethod';

export const AdvancedMethodPhases: React.FC = () => {
  const [activeFilterId, setActiveFilterId] = useState('all');

  const activeFilter =
    advancedMethodPhaseFilters.find((filter) => filter.id === activeFilterId) ??
    advancedMethodPhaseFilters[0];

  const filteredPhases = useMemo(() => {
    if (!activeFilter?.area && !activeFilter?.phaseIds) return advancedMethodPhases;

    return advancedMethodPhases.filter((phase) => {
      const matchesArea = activeFilter.area
        ? phase.relatedRoutes.some((route) => route.area === activeFilter.area)
        : false;
      const matchesPhase = activeFilter.phaseIds?.includes(phase.id) ?? false;

      return matchesArea || matchesPhase;
    });
  }, [activeFilter]);

  return (
    <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="fases">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fases avanzadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fases, criterios, entregables y conexiones operativas definidos desde configuración
            tipada.
          </p>
        </div>
        <Badge variant="success">{filteredPhases.length} fases visibles</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtros de fases avanzadas">
        {advancedMethodPhaseFilters.map((filter) => {
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

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {filteredPhases.map((phase, index) => (
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
};

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
