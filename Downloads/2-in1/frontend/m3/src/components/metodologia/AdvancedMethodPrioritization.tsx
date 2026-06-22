import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  AdvancedMethodConfidence,
  AdvancedMethodPriorityLevel,
  AdvancedMethodReadiness,
  AdvancedMethodRecommendationCategory,
  useAdvancedMethodPrioritization,
} from '@/hooks/useAdvancedMethodPrioritization';

interface PrioritizationFilter {
  id: string;
  label: string;
  predicate: (
    recommendation: ReturnType<typeof useAdvancedMethodPrioritization>['recommendations'][number],
  ) => boolean;
}

const levelVariant: Record<AdvancedMethodPriorityLevel, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

const readinessVariant: Record<AdvancedMethodReadiness, 'success' | 'warning' | 'danger'> = {
  ready: 'success',
  partial: 'warning',
  blocked: 'danger',
};

const confidenceVariant: Record<AdvancedMethodConfidence, 'success' | 'warning' | 'neutral'> = {
  high: 'success',
  medium: 'warning',
  low: 'neutral',
};

const categoryLabel: Record<AdvancedMethodRecommendationCategory, string> = {
  intelligence: 'Intelligence',
  strategy: 'Estrategia',
  actions: 'Acciones',
  tools: 'Tools Hub',
  validation: 'Validación',
  reporting: 'Reporting',
};

const levelLabel: Record<AdvancedMethodPriorityLevel, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};

const readinessLabel: Record<AdvancedMethodReadiness, string> = {
  ready: 'Lista',
  partial: 'Parcial',
  blocked: 'Bloqueada',
};

const confidenceLabel: Record<AdvancedMethodConfidence, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const filters: PrioritizationFilter[] = [
  { id: 'all', label: 'Todas', predicate: () => true },
  { id: 'ready', label: 'Listas para revisar', predicate: (item) => item.readiness === 'ready' },
  { id: 'partial', label: 'Parciales', predicate: (item) => item.readiness === 'partial' },
  { id: 'blocked', label: 'Bloqueadas', predicate: (item) => item.readiness === 'blocked' },
  { id: 'high-impact', label: 'Alto impacto', predicate: (item) => item.impact === 'high' },
  { id: 'low-effort', label: 'Bajo esfuerzo', predicate: (item) => item.effort === 'low' },
  {
    id: 'intelligence',
    label: 'Intelligence',
    predicate: (item) => item.category === 'intelligence',
  },
  { id: 'strategy', label: 'Estrategia', predicate: (item) => item.category === 'strategy' },
  { id: 'actions', label: 'Acciones', predicate: (item) => item.category === 'actions' },
  { id: 'validation', label: 'Validación', predicate: (item) => item.category === 'validation' },
  { id: 'tools', label: 'Tools Hub', predicate: (item) => item.category === 'tools' },
];

export const AdvancedMethodPrioritization: React.FC = () => {
  const { recommendations, summary } = useAdvancedMethodPrioritization();
  const [activeFilterId, setActiveFilterId] = useState('all');

  const activeFilter = filters.find((filter) => filter.id === activeFilterId) ?? filters[0];
  const filteredRecommendations = useMemo(
    () => recommendations.filter(activeFilter.predicate),
    [activeFilter, recommendations],
  );

  return (
    <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="priorizacion">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="neutral">Read-only</Badge>
          <h2 className="mt-3 text-xl font-semibold text-foreground">
            Priorización impacto/esfuerzo
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Recomendaciones metodológicas calculadas con señales ya disponibles. No crean tareas, no
            modifican roadmap y no ejecutan herramientas.
          </p>
        </div>
        <div className="grid min-w-[260px] grid-cols-2 gap-2 text-sm">
          <SummaryPill label="Total" value={summary.total} variant="neutral" />
          <SummaryPill label="Listas" value={summary.ready} variant="success" />
          <SummaryPill label="Parciales" value={summary.partial} variant="warning" />
          <SummaryPill label="Bloqueadas" value={summary.blocked} variant="danger" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Filtros de priorización">
        {filters.map((filter) => {
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
        {filteredRecommendations.map((recommendation) => (
          <article
            key={recommendation.id}
            className="rounded-xl border border-border bg-surface-alt p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{recommendation.title}</h3>
                  <Badge variant="neutral">{categoryLabel[recommendation.category]}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {recommendation.description}
                </p>
              </div>
              <Badge variant={readinessVariant[recommendation.readiness]}>
                {readinessLabel[recommendation.readiness]}
              </Badge>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <MetricBadge
                label="Impacto"
                value={levelLabel[recommendation.impact]}
                variant={levelVariant[recommendation.impact]}
              />
              <MetricBadge
                label="Esfuerzo"
                value={levelLabel[recommendation.effort]}
                variant={levelVariant[recommendation.effort]}
              />
              <MetricBadge
                label="Confianza"
                value={confidenceLabel[recommendation.confidence]}
                variant={confidenceVariant[recommendation.confidence]}
              />
            </div>

            <div className="mt-4 rounded-lg border border-border bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Por qué se recomienda
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {recommendation.reason}
              </p>
            </div>

            {recommendation.missingSignals.length > 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Señales faltantes
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recommendation.missingSignals.map((signal) => (
                    <Badge key={signal} variant="warning">
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <Link
              className="mt-4 inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              to={recommendation.recommendedRoute}
            >
              {recommendation.recommendedCtaLabel}
            </Link>
          </article>
        ))}
      </div>
    </Card>
  );
};

interface SummaryPillProps {
  label: string;
  value: number;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
}

const SummaryPill: React.FC<SummaryPillProps> = ({ label, value, variant }) => (
  <div className="rounded-xl border border-border bg-surface-alt p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Badge variant={variant}>{value}</Badge>
    </div>
  </div>
);

interface MetricBadgeProps {
  label: string;
  value: string;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
}

const MetricBadge: React.FC<MetricBadgeProps> = ({ label, value, variant }) => (
  <div className="rounded-lg border border-border bg-white p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    <Badge className="mt-2" variant={variant}>
      {value}
    </Badge>
  </div>
);
