import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  sharedToolsCatalog,
  ToolCatalogArea,
  ToolCatalogLevel,
  ToolCatalogPriority,
  ToolCatalogStatus,
} from '@/config/toolsCatalog';

interface ToolRadarFilter {
  id: string;
  label: string;
  priority?: ToolCatalogPriority;
  area?: ToolCatalogArea;
  status?: ToolCatalogStatus;
}

const levelBadgeVariant: Record<ToolCatalogLevel, 'success' | 'warning' | 'danger'> = {
  high: 'danger',
  medium: 'warning',
  low: 'success',
};

const levelLabel: Record<ToolCatalogLevel, string> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const statusBadgeVariant: Record<
  ToolCatalogStatus,
  'success' | 'warning' | 'danger' | 'neutral' | 'primary'
> = {
  legacy: 'warning',
  migrated: 'success',
  beta: 'primary',
  candidate: 'neutral',
  planned: 'neutral',
  unavailable: 'danger',
};

const toolRadarFilters: ToolRadarFilter[] = [
  { id: 'all', label: 'Todas' },
  { id: 'p1', label: 'P1', priority: 'P1' },
  { id: 'p2', label: 'P2', priority: 'P2' },
  { id: 'p3', label: 'P3', priority: 'P3' },
  { id: 'intelligence', label: 'Intelligence', area: 'intelligence' },
  { id: 'strategy', label: 'Estrategia', area: 'strategy' },
  { id: 'actions', label: 'Acciones', area: 'actions' },
  { id: 'tools', label: 'Tools Hub', area: 'tools' },
  { id: 'automation', label: 'Workflow', area: 'automation' },
  { id: 'migrated', label: 'Migradas', status: 'migrated' },
  { id: 'beta', label: 'Beta', status: 'beta' },
  { id: 'candidate', label: 'Candidatas', status: 'candidate' },
  { id: 'planned', label: 'Planificadas', status: 'planned' },
  { id: 'legacy', label: 'Legacy', status: 'legacy' },
];

export const AdvancedToolRadar: React.FC = () => {
  const [activeFilterId, setActiveFilterId] = useState('all');

  const activeFilter =
    toolRadarFilters.find((filter) => filter.id === activeFilterId) ?? toolRadarFilters[0];

  const filteredTools = useMemo(() => {
    if (!activeFilter.priority && !activeFilter.area && !activeFilter.status)
      return sharedToolsCatalog;

    return sharedToolsCatalog.filter((tool) => {
      const matchesPriority = activeFilter.priority
        ? tool.priority === activeFilter.priority
        : false;
      const matchesArea = activeFilter.area ? tool.area === activeFilter.area : false;
      const matchesStatus = activeFilter.status ? tool.status === activeFilter.status : false;

      return matchesPriority || matchesArea || matchesStatus;
    });
  }, [activeFilter]);

  return (
    <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="herramientas">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Radar de herramientas avanzadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo compartido read-only para distinguir herramientas existentes, beta, migradas,
            legacy, candidatas y planificadas sin ejecutar ninguna herramienta.
          </p>
        </div>
        <Badge variant="warning">{filteredTools.length} herramientas visibles</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtros del radar de herramientas">
        {toolRadarFilters.map((filter) => {
          const isActive = filter.id === activeFilterId;

          return (
            <button
              key={filter.id}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-ring ${
                isActive
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border bg-surface-alt text-foreground hover:border-primary hover:text-primary'
              }`}
              onClick={() => setActiveFilterId(filter.id)}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-[1280px] w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-3">Herramienta</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Impacto</th>
              <th className="px-3 py-3">Dificultad</th>
              <th className="px-3 py-3">Riesgo</th>
              <th className="px-3 py-3">Prioridad</th>
              <th className="px-3 py-3">Gobierno</th>
              <th className="px-3 py-3">Dónde vive</th>
            </tr>
          </thead>
          <tbody>
            {filteredTools.map((tool) => (
              <tr key={tool.id} className="border-b border-border/70 align-top">
                <td className="px-3 py-3">
                  <p className="font-medium text-foreground">{tool.name}</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                    {tool.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Dependencias: {tool.dependencies.join(' · ')}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={statusBadgeVariant[tool.status]}>{tool.status}</Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={levelBadgeVariant[tool.seoImpact]}>
                    {levelLabel[tool.seoImpact]}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={levelBadgeVariant[tool.technicalDifficulty]}>
                    {levelLabel[tool.technicalDifficulty]}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={levelBadgeVariant[tool.risk]}>{levelLabel[tool.risk]}</Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge
                    variant={
                      tool.priority === 'P1'
                        ? 'success'
                        : tool.priority === 'P2'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {tool.priority}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  <p>Dry-run: {tool.supportsDryRun ? 'sí' : 'no'}</p>
                  <p>Cola futura: {tool.canRunInQueue ? 'sí' : 'no'}</p>
                  <p>Revisión humana: {tool.requiresHumanReview ? 'sí' : 'no'}</p>
                  <p>Read-only safe: {tool.isReadOnlySafe ? 'sí' : 'no'}</p>
                </td>
                <td className="px-3 py-3 text-foreground">
                  <p>{tool.ownerArea}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tool.recommendedRoute}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
