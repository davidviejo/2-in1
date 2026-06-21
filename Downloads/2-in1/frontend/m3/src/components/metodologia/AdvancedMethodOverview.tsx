import React from 'react';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { advancedMethodOverview } from '@/config/seoAdvancedMethod';

export const AdvancedMethodOverview: React.FC = () => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="overview">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-4xl space-y-3">
        <Badge variant="primary">Framework transversal</Badge>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{advancedMethodOverview.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
            {advancedMethodOverview.subtitle}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {advancedMethodOverview.principles.map((principle) => (
            <div
              key={principle}
              className="rounded-xl border border-border bg-surface-alt p-3 text-sm text-muted-foreground"
            >
              {principle}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface-alt p-4 lg:max-w-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity size={16} className="text-primary" />
          Centro de control metodológico
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Esta fase solo documenta y conecta áreas existentes. No ejecuta automatizaciones, no crea
          endpoints y no duplica tareas, roadmap, Kanban, Gantt, Tools Hub ni Intelligence.
        </p>
      </div>
    </div>
  </Card>
);
