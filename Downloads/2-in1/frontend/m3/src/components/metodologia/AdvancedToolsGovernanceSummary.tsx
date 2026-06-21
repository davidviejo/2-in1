import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useToolsCatalogSignals } from '@/hooks/useToolsCatalogSignals';

export const AdvancedToolsGovernanceSummary: React.FC = () => {
  const signals = useToolsCatalogSignals();

  return (
    <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="neutral">Read-only</Badge>
          <h2 className="mt-3 text-xl font-semibold text-foreground">Gobernanza de herramientas</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Resumen del catálogo compartido de herramientas. Metodología lee gobierno, riesgo y
            readiness; Tools Hub mantiene la operación y cualquier runtime.
          </p>
        </div>
        <Link
          className="inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
          to="/app/tools-hub"
        >
          Abrir Tools Hub
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total" value={signals.total} variant="neutral" />
        <Metric
          label="P1 / P2 / P3"
          value={`${signals.byPriority.P1}/${signals.byPriority.P2}/${signals.byPriority.P3}`}
          variant="success"
        />
        <Metric label="Listas para dry-run" value={signals.readyForDryRun} variant="warning" />
        <Metric label="Revisión humana" value={signals.requiresHumanReview} variant="warning" />
        <Metric
          label="Candidatas/planificadas"
          value={signals.candidateOrPlanned}
          variant="neutral"
        />
        <Metric label="Legacy" value={signals.byStatus.legacy} variant="warning" />
        <Metric label="Migradas" value={signals.byStatus.migrated} variant="success" />
        <Metric label="Beta" value={signals.byStatus.beta} variant="primary" />
      </div>
    </Card>
  );
};

interface MetricProps {
  label: string;
  value: number | string;
  variant: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
}

const Metric: React.FC<MetricProps> = ({ label, value, variant }) => (
  <div className="rounded-xl border border-border bg-surface-alt p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Badge variant={variant}>{value}</Badge>
    </div>
  </div>
);
