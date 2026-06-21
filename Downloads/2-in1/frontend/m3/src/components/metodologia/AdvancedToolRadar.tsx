import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  advancedToolCandidates,
  advancedToolRadarFilters,
  AdvancedMethodLevel,
} from '@/config/seoAdvancedMethod';

const levelBadgeVariant: Record<AdvancedMethodLevel, 'success' | 'warning' | 'danger'> = {
  Alto: 'danger',
  Medio: 'warning',
  Bajo: 'success',
};

export const AdvancedToolRadar: React.FC = () => {
  const [activeFilterId, setActiveFilterId] = useState('all');

  const activeFilter =
    advancedToolRadarFilters.find((filter) => filter.id === activeFilterId) ??
    advancedToolRadarFilters[0];

  const filteredTools = useMemo(() => {
    if (!activeFilter?.priority && !activeFilter?.area) return advancedToolCandidates;

    return advancedToolCandidates.filter((tool) => {
      const matchesPriority = activeFilter.priority
        ? tool.suggestedPriority === activeFilter.priority
        : false;
      const matchesArea = activeFilter.area ? tool.shouldLiveIn === activeFilter.area : false;

      return matchesPriority || matchesArea;
    });
  }, [activeFilter]);

  return (
    <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="herramientas">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Radar de herramientas avanzadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Inventario candidato para futuras fases. Es visual y configurado en frontend; no
            implementa ejecución real.
          </p>
        </div>
        <Badge variant="warning">{filteredTools.length} candidatas visibles</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtros del radar de herramientas">
        {advancedToolRadarFilters.map((filter) => {
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
        <table className="min-w-[1180px] w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-3">Herramienta</th>
              <th className="px-3 py-3">Impacto</th>
              <th className="px-3 py-3">Dificultad</th>
              <th className="px-3 py-3">Dependencias</th>
              <th className="px-3 py-3">Riesgo</th>
              <th className="px-3 py-3">Reutilización</th>
              <th className="px-3 py-3">Prioridad</th>
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
                </td>
                <td className="px-3 py-3">
                  <Badge variant={levelBadgeVariant[tool.seoImpact]}>{tool.seoImpact}</Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={levelBadgeVariant[tool.technicalDifficulty]}>
                    {tool.technicalDifficulty}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{tool.dependencies.join(' · ')}</td>
                <td className="px-3 py-3">
                  <Badge variant={levelBadgeVariant[tool.risk]}>{tool.risk}</Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={levelBadgeVariant[tool.existingCodeReuse]}>
                    {tool.existingCodeReuse}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge
                    variant={
                      tool.suggestedPriority === 'P1'
                        ? 'success'
                        : tool.suggestedPriority === 'P2'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {tool.suggestedPriority}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-foreground">{tool.shouldLiveIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
