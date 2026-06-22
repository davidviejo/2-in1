import React from 'react';
import { LucideIcon, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface KpiCard {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
}

interface MethodologyHeaderProps {
  kpiCards: readonly KpiCard[];
  onAddResource: () => void;
  onEditFirstResource: () => void;
}

const commandChips = ['Solo lectura', 'Dry-run', 'Revisión humana', 'Ejecución real desactivada'];

export const MethodologyHeader: React.FC<MethodologyHeaderProps> = ({
  kpiCards,
  onAddResource,
  onEditFirstResource,
}) => (
  <header
    id="estructura"
    className="overflow-hidden rounded-brand-lg border border-border bg-foreground shadow-card"
  >
    <div className="relative p-5 sm:p-7 lg:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr),minmax(320px,0.7fr)]">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary" className="bg-surface text-primary">
              Método SEO Avanzado 2026
            </Badge>
            <Badge variant="neutral" className="bg-surface-alt text-foreground">
              Cabina metodológica
            </Badge>
          </div>

          <div className="space-y-3">
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-background md:text-5xl">
              Control metodológico para priorizar, simular y gobernar con seguridad.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-background/75 md:text-base">
              Centro premium para documentar el método, leer señales reales, revisar requisitos y
              preparar futuros workflows sin tocar backend, tareas, roadmap ni herramientas reales.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {commandChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-background/85"
              >
                <ShieldCheck size={14} />
                {chip}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onAddResource}>+ Añadir recurso</Button>
            <Button variant="secondary" onClick={onEditFirstResource}>
              Editar primer recurso
            </Button>
          </div>
        </div>

        <div className="rounded-brand-lg border border-background/10 bg-background/10 p-4 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-background">Estado de cabina</p>
              <p className="text-xs text-background/65">Densidad controlada · seguridad visible</p>
            </div>
            <Sparkles className="text-primary" size={20} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {kpiCards.map(({ title, subtitle, icon: Icon }) => (
              <div
                key={title}
                className="rounded-brand-md border border-background/10 bg-surface p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                  </div>
                  <span className="rounded-xl bg-primary-soft p-2 text-primary">
                    <Icon size={18} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </header>
);
