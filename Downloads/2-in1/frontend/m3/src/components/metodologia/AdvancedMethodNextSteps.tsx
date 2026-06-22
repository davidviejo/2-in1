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
  <Card className="overflow-hidden border-border bg-white p-0 shadow-sm" id="siguientes-pasos">
    <div className="border-b border-border bg-foreground p-5 sm:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="primary" className="bg-surface text-primary">
            Timeline de implantación
          </Badge>
          <h2 className="mt-3 text-xl font-semibold text-background">Siguientes pasos</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-background/70">
            Secuencia de madurez del método: documentación, señales, simulación, gobierno y futuras
            capacidades con revisión humana.
          </p>
        </div>
        <Badge variant="warning">Plan incremental</Badge>
      </div>
    </div>

    <div className="p-5 sm:p-6">
      <div className="relative space-y-0 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
        {advancedMethodNextSteps.map((step, index) => (
          <article
            key={step.phase}
            className="relative grid gap-3 pb-5 pl-10 last:pb-0 md:grid-cols-[180px,minmax(0,1fr),120px]"
          >
            <span className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-foreground">
              {index + 1}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {step.phase}
              </p>
              <Badge className="mt-2" variant={statusBadge[step.state].variant}>
                {statusBadge[step.state].label}
              </Badge>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </Card>
);
