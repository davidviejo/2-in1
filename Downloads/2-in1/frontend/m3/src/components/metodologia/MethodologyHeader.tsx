import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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

export const MethodologyHeader: React.FC<MethodologyHeaderProps> = ({
  kpiCards,
  onAddResource,
  onEditFirstResource,
}) => (
  <header id="estructura" className="space-y-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
          Aplicación de la metodología
        </h1>
        <p className="max-w-4xl text-sm text-muted-foreground md:text-base">
          Explica de forma clara cómo se aplica la metodología, de inicio a fin, y centraliza los
          recursos de apoyo para profundizar en cada etapa.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onAddResource}>+ Añadir recurso</Button>
        <Button variant="secondary" onClick={onEditFirstResource}>
          Editar primer recurso
        </Button>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpiCards.map(({ title, subtitle, icon: Icon, accent }) => (
        <Card key={title} className="border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <span className={`rounded-xl p-2 ${accent}`}>
              <Icon size={18} />
            </span>
          </div>
        </Card>
      ))}
    </div>
  </header>
);
