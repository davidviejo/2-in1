import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  advancedMethodStatusItems,
  MethodImplementationStatusState,
} from '@/config/seoAdvancedMethod';

const statusBadge: Record<
  MethodImplementationStatusState,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  completed: { label: 'Completado', variant: 'success' },
  in_progress: { label: 'En curso', variant: 'warning' },
  pending: { label: 'Pendiente', variant: 'neutral' },
};

export const AdvancedMethodStatus: React.FC = () => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Estado del Método SEO Avanzado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado de implantación del framework dentro de la app. No representa el progreso SEO real
          de ningún cliente.
        </p>
      </div>
      <Badge variant="neutral">Framework interno</Badge>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {advancedMethodStatusItems.map((item) => (
        <article key={item.label} className="rounded-xl border border-border bg-surface-alt p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-foreground">{item.label}</h3>
            <Badge variant={statusBadge[item.state].variant}>{statusBadge[item.state].label}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
        </article>
      ))}
    </div>
  </Card>
);
