import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { futureSeoQueueWorkflow } from '@/config/seoAdvancedMethod';

export const SeoQueueConcept: React.FC = () => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="cola-seo">
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
      <div>
        <Badge variant="warning">Fase futura</Badge>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          Automatización semiasistida / Cola SEO
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
          Esta sección deja preparada la dirección de producto: en fases posteriores podrá ejecutar
          acciones secuenciales, acciones paralelas seguras, dry-run, logs, errores, reintentos,
          pausas, revisión humana y envío de resultados a tareas, roadmap o entregables. En esta
          fase sigue sin ejecutar nada.
        </p>
      </div>
      <Link to="/app/kanban">
        <Button variant="secondary">Ver ejecución actual</Button>
      </Link>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr),360px]">
      <div className="rounded-xl border border-border bg-surface-alt p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">
            {futureSeoQueueWorkflow.title}
          </h3>
          <Badge variant="neutral">{futureSeoQueueWorkflow.statusLabel}</Badge>
        </div>
        <ol className="mt-4 grid gap-2 md:grid-cols-2">
          {futureSeoQueueWorkflow.steps.map((step, index) => (
            <li
              key={step}
              className="rounded-lg border border-border bg-white p-3 text-sm text-muted-foreground"
            >
              <span className="mr-2 font-semibold text-primary">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-surface-alt p-4">
        <h3 className="text-base font-semibold text-foreground">Guardrails previstos</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>• Modo dry-run antes de cualquier ejecución real.</li>
          <li>• Confirmación humana para acciones sensibles.</li>
          <li>• Logs y trazabilidad por paso.</li>
          <li>• Reintentos y pausas controladas.</li>
          <li>• Integración con Kanban, roadmap y entregables existentes.</li>
        </ul>
      </div>
    </div>
  </Card>
);
