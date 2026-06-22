import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  AdvancedMethodSignalStatus,
  useAdvancedMethodSignals,
} from '@/hooks/useAdvancedMethodSignals';

const statusBadge: Record<
  AdvancedMethodSignalStatus,
  { variant: 'success' | 'warning' | 'neutral'; tone: string }
> = {
  available: { variant: 'success', tone: 'border-success/30 bg-success/5' },
  empty: { variant: 'warning', tone: 'border-warning/30 bg-warning/5' },
  unavailable: { variant: 'neutral', tone: 'border-border bg-surface-alt' },
  not_detectable: { variant: 'neutral', tone: 'border-border bg-surface-alt' },
};

export const AdvancedMethodRealContext: React.FC = () => {
  const { clientName, hasActiveClient, signals, summary } = useAdvancedMethodSignals();

  return (
    <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="contexto-real">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="neutral">Read-only</Badge>
          <h2 className="mt-3 text-xl font-semibold text-foreground">Contexto real del proyecto</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Señales calculadas a partir de datos ya expuestos por la app. Metodología solo
            contextualiza: la ejecución sigue ocurriendo en Roadmap, Kanban, GSC Impact, Checklist,
            Tools Hub o Tareas realizadas.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-alt p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Proyecto activo
          </p>
          <p className="mt-1 font-semibold text-foreground">{clientName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasActiveClient ? 'Lectura disponible desde ProjectContext.' : 'Sin contexto activo.'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryPill label="Disponibles" value={summary.available} variant="success" />
        <SummaryPill label="Vacías" value={summary.empty} variant="warning" />
        <SummaryPill label="No disponibles" value={summary.unavailable} variant="neutral" />
        <SummaryPill label="No detectables" value={summary.notDetectable} variant="neutral" />
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {signals.map((signal) => (
          <article
            key={signal.id}
            className={`rounded-xl border p-4 ${statusBadge[signal.status].tone}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{signal.title}</h3>
                  <Badge variant="neutral">{signal.area}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.description}</p>
              </div>
              <Badge variant={statusBadge[signal.status].variant}>{signal.statusLabel}</Badge>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-2xl font-semibold text-foreground">{signal.value}</p>
                {signal.detail ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.detail}</p>
                ) : null}
              </div>
              {signal.route ? (
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  to={signal.route.path}
                >
                  {signal.route.label}
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
};

interface SummaryPillProps {
  label: string;
  value: number;
  variant: 'success' | 'warning' | 'neutral';
}

const SummaryPill: React.FC<SummaryPillProps> = ({ label, value, variant }) => (
  <div className="rounded-xl border border-border bg-surface-alt p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Badge variant={variant}>{value}</Badge>
    </div>
  </div>
);
