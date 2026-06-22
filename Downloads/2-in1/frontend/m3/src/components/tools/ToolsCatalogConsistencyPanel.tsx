import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  CatalogConsistencyLevel,
  CatalogMatchLevel,
  ToolsCatalogReconciliationResult,
} from '@/hooks/useToolsCatalogReconciliation';

const consistencyVariant: Record<
  CatalogConsistencyLevel,
  'success' | 'warning' | 'danger' | 'neutral'
> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
  degraded: 'neutral',
};

const matchVariant: Record<CatalogMatchLevel, 'success' | 'warning' | 'danger' | 'neutral'> = {
  matched: 'success',
  possibleMatch: 'warning',
  methodologyOnly: 'neutral',
  backendOnly: 'warning',
  launcherOnly: 'warning',
  issue: 'danger',
};

interface ToolsCatalogConsistencyPanelProps {
  reconciliation: ToolsCatalogReconciliationResult;
}

export const ToolsCatalogConsistencyPanel: React.FC<ToolsCatalogConsistencyPanelProps> = ({
  reconciliation,
}) => {
  const { summary } = reconciliation;
  const visibleItems = reconciliation.items.slice(0, 12);

  return (
    <Card className="border-border bg-surface p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="neutral">Read-only</Badge>
          <h2 className="mt-3 text-lg font-semibold text-foreground">Consistencia del catálogo</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Reconciliación entre catálogo metodológico, catálogo backend y launcher catalog. No
            instala, inicia, detiene ni abre herramientas.
          </p>
          {reconciliation.error ? (
            <p className="mt-2 text-xs text-warning">{reconciliation.error}</p>
          ) : null}
        </div>
        <Badge variant={consistencyVariant[summary.consistencyLevel]}>
          Consistencia {summary.consistencyLevel} · {summary.consistencyScore}%
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Metric label="Metodología" value={summary.methodologyTotal} variant="neutral" />
        <Metric label="Backend" value={summary.backendTotal} variant="neutral" />
        <Metric label="Launcher" value={summary.launcherTotal} variant="neutral" />
        <Metric label="Coincidencias" value={summary.matched} variant="success" />
        <Metric label="Solo metodología" value={summary.methodologyOnly} variant="warning" />
        <Metric label="Solo backend" value={summary.backendOnly} variant="warning" />
        <Metric label="Solo launcher" value={summary.launcherOnly} variant="warning" />
        <Metric label="Mismatches" value={summary.possibleMismatches} variant="danger" />
        <Metric label="Sin dry-run" value={summary.queueWithoutDryRun} variant="warning" />
        <Metric label="Revisión humana" value={summary.requiresHumanReview} variant="warning" />
        <Metric label="Read-only safe" value={summary.readOnlySafe} variant="success" />
        <Metric
          label="Divergencias críticas"
          value={summary.criticalDivergences}
          variant="danger"
        />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-3">Herramienta</th>
              <th className="px-3 py-3">Fuente</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Coincidencia</th>
              <th className="px-3 py-3">Problema</th>
              <th className="px-3 py-3">Recomendación</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr
                key={`${item.matchLevel}-${item.id}`}
                className="border-b border-border/70 align-top"
              >
                <td className="px-3 py-3 font-medium text-foreground">{item.name}</td>
                <td className="px-3 py-3 text-muted">{item.sources.join(' · ')}</td>
                <td className="px-3 py-3 text-muted">{item.status}</td>
                <td className="px-3 py-3">
                  <Badge variant={matchVariant[item.matchLevel]}>{item.matchLevel}</Badge>
                </td>
                <td className="px-3 py-3 text-muted">{item.issue}</td>
                <td className="px-3 py-3 text-muted">{item.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <p className="text-xs text-muted">{label}</p>
      <Badge variant={variant}>{value}</Badge>
    </div>
  </div>
);
