import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  advancedMethodNextSteps,
  MethodImplementationStatusState,
} from '@/config/seoAdvancedMethod';

const statusBadge: Record<
  MethodImplementationStatusState,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  completed: { label: 'Completado', variant: 'success' },
  in_progress: { label: 'En curso', variant: 'warning' },
  pending: { label: 'Futuro', variant: 'neutral' },
};

export const AdvancedMethodNextSteps: React.FC = () => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="siguientes-pasos">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Siguientes pasos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Roadmap recomendado de implantación: lo completado documenta y orienta; las fases futuras
          conectarán datos, scoring, dry-run y reporting con control humano.
        </p>
      </div>
      <Badge variant="warning">Plan incremental</Badge>
    </div>

    <div className="mt-5 space-y-3">
      {advancedMethodNextSteps.map((step) => (
        <article key={step.phase} className="rounded-xl border border-border bg-surface-alt p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {step.phase}
              </p>
              <h3 className="mt-1 font-semibold text-foreground">{step.title}</h3>
            </div>
            <Badge variant={statusBadge[step.state].variant}>{statusBadge[step.state].label}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
        </article>
      ))}
    </div>
  </Card>
);
