import React from 'react';
import { ExternalLink, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface MethodologyResource {
  name: string;
  description: string;
  type: string;
  linkText: string;
  usage: string;
}

interface FeaturedResource {
  name: string;
  description: string;
  icon: LucideIcon;
}

interface MethodologyResourcesPanelProps {
  resourceTabs: readonly string[];
  featuredResources: FeaturedResource[];
}

interface MethodologyResourcesTableProps {
  resources: MethodologyResource[];
  onEditResource: (resourceName: string) => void;
}

export const MethodologyResourcesPanel: React.FC<MethodologyResourcesPanelProps> = ({
  resourceTabs,
  featuredResources,
}) => (
  <Card id="recursos" className="border-border bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-lg font-semibold text-foreground">Recursos destacados</h2>
    <div className="mt-4 flex flex-wrap gap-2">
      {resourceTabs.map((tab, index) => (
        <button
          key={tab}
          type="button"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${index === 0 ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-surface-alt text-muted-foreground'}`}
        >
          {tab}
        </button>
      ))}
    </div>

    <div className="mt-4 space-y-3">
      {featuredResources.map((resource) => {
        const Icon = resource.icon;
        return (
          <a
            key={resource.name}
            href="#"
            className="flex items-start gap-3 rounded-xl border border-border bg-surface-alt p-3 hover:border-primary/30"
          >
            <span className="mt-0.5 rounded-lg bg-white p-2 text-primary shadow-sm">
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{resource.name}</p>
              <p className="text-xs text-muted-foreground">{resource.description}</p>
            </div>
            <ExternalLink size={14} className="mt-1 text-muted-foreground" />
          </a>
        );
      })}
    </div>

    <Button variant="secondary" className="mt-4 w-full justify-center">
      Ver todos los recursos
    </Button>
  </Card>
);

export const MethodologyResourcesTable: React.FC<MethodologyResourcesTableProps> = ({
  resources,
  onEditResource,
}) => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-xl font-semibold text-foreground">Recursos para profundizar</h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Documentación, enlaces y materiales de apoyo vinculados a la metodología.
    </p>

    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[980px] w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-alt text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3">Nombre</th>
            <th className="px-3 py-3">Descripción</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3">Enlace</th>
            <th className="px-3 py-3">Uso recomendado</th>
            <th className="px-3 py-3">Acción</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource.name} className="border-b border-border/70 align-top">
              <td className="px-3 py-3 font-medium text-foreground">{resource.name}</td>
              <td className="px-3 py-3 text-muted-foreground">{resource.description}</td>
              <td className="px-3 py-3 text-muted-foreground">{resource.type}</td>
              <td className="px-3 py-3">
                <a
                  href="#"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {resource.linkText}
                  <ExternalLink size={13} />
                </a>
              </td>
              <td className="px-3 py-3 text-muted-foreground">{resource.usage}</td>
              <td className="px-3 py-3">
                <Button
                  variant="ghost"
                  className="h-auto px-0 text-xs"
                  onClick={() => onEditResource(resource.name)}
                >
                  Editar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);
