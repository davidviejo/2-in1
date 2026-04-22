import { GeoScope, ModuleData, ProjectScoreContext, ProjectType } from '@/types';

export interface ScoreWeightConfig {
  moduleWeights: Partial<Record<number, number>>;
}

const BASE_MODULE_WEIGHTS: Record<number, number> = {
  1: 12,
  2: 12,
  3: 12,
  4: 10,
  5: 10,
  6: 10,
  7: 10,
  8: 12,
  9: 12,
};

const PROJECT_TYPE_OVERRIDES: Record<ProjectType, ScoreWeightConfig> = {
  LOCAL: { moduleWeights: { 4: 8, 5: 16, 7: 14, 8: 14 } },
  MEDIA: { moduleWeights: { 2: 14, 3: 16, 7: 12, 8: 10 } },
  ECOM: { moduleWeights: { 1: 14, 2: 10, 6: 14, 8: 16 } },
  NATIONAL: { moduleWeights: { 1: 12, 2: 13, 3: 13, 8: 14 } },
  INTERNATIONAL: { moduleWeights: { 1: 14, 2: 12, 4: 13, 9: 14 } },
};

const GEO_SCOPE_OVERRIDES: Partial<Record<GeoScope, ScoreWeightConfig>> = {
  local: { moduleWeights: { 5: 15, 7: 12 } },
  national: { moduleWeights: { 2: 13, 4: 12 } },
  international: { moduleWeights: { 4: 14, 9: 14 } },
};

const SECTOR_OVERRIDES: Record<string, ScoreWeightConfig> = {
  'medios / editorial': { moduleWeights: { 2: 16, 3: 14, 7: 13 } },
  'ecommerce generalista': { moduleWeights: { 1: 15, 6: 14, 8: 16 } },
  turismo: { moduleWeights: { 3: 14, 5: 14, 8: 13 } },
  legal: { moduleWeights: { 3: 14, 4: 12, 5: 13 } },
  salud: { moduleWeights: { 3: 14, 5: 13, 7: 12 } },
};

const normalizeWeights = (weights: Partial<Record<number, number>>): Record<number, number> => {
  const total = Object.values(weights).reduce((acc, value) => acc + Math.max(0, Number(value) || 0), 0);
  if (total <= 0) {
    return { ...BASE_MODULE_WEIGHTS };
  }

  const normalizedEntries = Object.entries(weights).map(([moduleId, value]) => {
    const normalized = Math.max(0, Number(value) || 0);
    return [Number(moduleId), Math.round((normalized / total) * 100)] as const;
  });

  const normalized = normalizedEntries.reduce<Record<number, number>>((acc, [moduleId, value]) => {
    acc[moduleId] = value;
    return acc;
  }, {});

  const diff = 100 - Object.values(normalized).reduce((acc, value) => acc + value, 0);
  if (diff !== 0) {
    const firstModule = Number(Object.keys(normalized)[0]);
    normalized[firstModule] = Math.max(0, (normalized[firstModule] || 0) + diff);
  }

  return normalized;
};

const resolveSectorOverride = (sector: string): ScoreWeightConfig | null => {
  const key = sector.trim().toLowerCase();
  return SECTOR_OVERRIDES[key] || null;
};

export const computeProjectScoreContext = (input: {
  modules: ModuleData[];
  projectType: ProjectType;
  sector?: string;
  geoScope: GeoScope;
}): ProjectScoreContext => {
  const sector = input.sector?.trim() || 'Generico';
  const projectTypeOverride = PROJECT_TYPE_OVERRIDES[input.projectType] || null;
  const geoScopeOverride = GEO_SCOPE_OVERRIDES[input.geoScope] || null;
  const sectorOverride = resolveSectorOverride(sector);

  const stagedWeights: Record<number, { value: number; source: 'base' | 'projectType' | 'sector' | 'geoScope' }> =
    Object.entries(BASE_MODULE_WEIGHTS).reduce((acc, [moduleId, value]) => {
      acc[Number(moduleId)] = { value, source: 'base' };
      return acc;
    }, {} as Record<number, { value: number; source: 'base' | 'projectType' | 'sector' | 'geoScope' }>);

  const applyOverride = (
    override: ScoreWeightConfig | null,
    source: 'projectType' | 'geoScope' | 'sector',
  ) => {
    if (!override) return;
    Object.entries(override.moduleWeights).forEach(([moduleId, value]) => {
      stagedWeights[Number(moduleId)] = {
        value: Number(value) || 0,
        source,
      };
    });
  };

  applyOverride(projectTypeOverride, 'projectType');
  applyOverride(geoScopeOverride, 'geoScope');
  applyOverride(sectorOverride, 'sector');

  const normalizedWeights = normalizeWeights(
    Object.entries(stagedWeights).reduce<Partial<Record<number, number>>>((acc, [moduleId, value]) => {
      acc[Number(moduleId)] = value.value;
      return acc;
    }, {}),
  );

  const moduleMaturity = input.modules.reduce<Record<number, number>>((acc, module) => {
    const total = module.tasks.length;
    const completed = module.tasks.filter((task) => task.status === 'completed').length;
    acc[module.id] = total === 0 ? 0 : Math.round((completed / total) * 100);
    return acc;
  }, {});

  const weightedScore = input.modules.reduce((acc, module) => {
    const moduleWeight = normalizedWeights[module.id] || 0;
    const moduleScore = moduleMaturity[module.id] || 0;
    return acc + (moduleScore * moduleWeight) / 100;
  }, 0);

  const appliedWeights = Object.entries(normalizedWeights)
    .map(([moduleId, weight]) => ({
      moduleId: Number(moduleId),
      weight,
      source: stagedWeights[Number(moduleId)]?.source || 'base',
    }))
    .sort((a, b) => b.weight - a.weight);

  return {
    projectType: input.projectType,
    sector,
    geoScope: input.geoScope,
    timestamp: Date.now(),
    score: Math.round(weightedScore),
    fallbackUsed: !sectorOverride,
    appliedWeights,
    criticalModuleIds: appliedWeights.slice(0, 3).map((item) => item.moduleId),
    moduleMaturity,
  };
};
