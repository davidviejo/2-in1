import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { advancedMethodCtas } from '@/config/seoAdvancedMethod';

export const AdvancedMethodCtaPanel: React.FC = () => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Accionabilidad transversal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Metodología orienta y estructura; Intelligence analiza, Estrategia prioriza, Acciones
          ejecuta y Tools Hub gobierna herramientas.
        </p>
      </div>
      <Badge variant="success">Rutas existentes</Badge>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {advancedMethodCtas.map((cta) => (
        <article key={cta.path} className="rounded-xl border border-border bg-surface-alt p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-foreground">{cta.label}</h3>
            <Badge variant="neutral">{cta.area}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{cta.description}</p>
          <Link
            className="mt-4 inline-flex h-9 items-center justify-center rounded-brand-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-ring"
            to={cta.path}
          >
            Abrir área
          </Link>
        </article>
      ))}
    </div>
  </Card>
);
