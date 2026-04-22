import { ProjectType, TaskTemplateMeta } from '@/types';

interface TemplateTaskSeed {
  moduleId: number;
  taskId: string;
  priority: 'High' | 'Medium' | 'Low';
}

interface ProjectRoadmapTemplate {
  templateId: string;
  label: string;
  projectType: ProjectType;
  suggestedModuleIds: number[];
  tasks: TemplateTaskSeed[];
  moduleWeights: Record<number, number>;
}

interface SectorOverride {
  templateId: string;
  label: string;
  sectors: string[];
  tasks: TemplateTaskSeed[];
  moduleWeights?: Partial<Record<number, number>>;
}

export interface ContextualTaskSuggestion {
  moduleId: number;
  taskId: string;
  meta: TaskTemplateMeta;
}

const TYPE_BASE_TEMPLATES: Record<ProjectType, ProjectRoadmapTemplate> = {
  MEDIA: {
    templateId: 'base-media',
    label: 'Sugerido por tipología: MEDIA',
    projectType: 'MEDIA',
    suggestedModuleIds: [2, 3, 4, 7, 8],
    moduleWeights: { 1: 10, 2: 17, 3: 18, 4: 13, 5: 10, 6: 10, 7: 12, 8: 10, 9: 0 },
    tasks: [
      { moduleId: 2, taskId: 'm2-1', priority: 'High' },
      { moduleId: 2, taskId: 'm2-4', priority: 'High' },
      { moduleId: 3, taskId: 'm3-1', priority: 'High' },
      { moduleId: 3, taskId: 'm3-5', priority: 'High' },
      { moduleId: 4, taskId: 'm4-1', priority: 'Medium' },
      { moduleId: 7, taskId: 'm7-1', priority: 'Medium' },
    ],
  },
  ECOM: {
    templateId: 'base-ecom',
    label: 'Sugerido por tipología: ECOM',
    projectType: 'ECOM',
    suggestedModuleIds: [1, 2, 4, 6, 8],
    moduleWeights: { 1: 16, 2: 14, 3: 14, 4: 12, 5: 8, 6: 14, 7: 8, 8: 14, 9: 0 },
    tasks: [
      { moduleId: 1, taskId: 'm1-5', priority: 'High' },
      { moduleId: 2, taskId: 'm2-2', priority: 'High' },
      { moduleId: 3, taskId: 'm3-5', priority: 'Medium' },
      { moduleId: 4, taskId: 'm4-2', priority: 'Medium' },
      { moduleId: 6, taskId: 'm6-2', priority: 'High' },
      { moduleId: 8, taskId: 'm8-2', priority: 'High' },
    ],
  },
  LOCAL: {
    templateId: 'base-local',
    label: 'Sugerido por tipología: LOCAL',
    projectType: 'LOCAL',
    suggestedModuleIds: [1, 3, 5, 6, 8],
    moduleWeights: { 1: 14, 2: 9, 3: 15, 4: 9, 5: 15, 6: 12, 7: 12, 8: 14, 9: 0 },
    tasks: [
      { moduleId: 1, taskId: 'm1-1', priority: 'High' },
      { moduleId: 3, taskId: 'm3-2', priority: 'High' },
      { moduleId: 5, taskId: 'm5-1', priority: 'High' },
      { moduleId: 6, taskId: 'm6-1', priority: 'Medium' },
      { moduleId: 8, taskId: 'm8-1', priority: 'High' },
    ],
  },
  NATIONAL: {
    templateId: 'base-national',
    label: 'Sugerido por tipología: NATIONAL',
    projectType: 'NATIONAL',
    suggestedModuleIds: [1, 2, 3, 6, 8],
    moduleWeights: { 1: 14, 2: 15, 3: 14, 4: 11, 5: 11, 6: 12, 7: 9, 8: 14, 9: 0 },
    tasks: [
      { moduleId: 1, taskId: 'm1-6', priority: 'High' },
      { moduleId: 2, taskId: 'm2-2', priority: 'High' },
      { moduleId: 3, taskId: 'm3-7', priority: 'Medium' },
      { moduleId: 6, taskId: 'm6-1', priority: 'Medium' },
      { moduleId: 8, taskId: 'm8-3', priority: 'High' },
    ],
  },
  INTERNATIONAL: {
    templateId: 'base-international',
    label: 'Sugerido por tipología: INTERNATIONAL',
    projectType: 'INTERNATIONAL',
    suggestedModuleIds: [1, 2, 4, 6, 8],
    moduleWeights: { 1: 14, 2: 14, 3: 11, 4: 13, 5: 10, 6: 13, 7: 10, 8: 15, 9: 0 },
    tasks: [
      { moduleId: 1, taskId: 'm1-7', priority: 'High' },
      { moduleId: 2, taskId: 'm2-4', priority: 'Medium' },
      { moduleId: 4, taskId: 'm4-3', priority: 'High' },
      { moduleId: 6, taskId: 'm6-2', priority: 'Medium' },
      { moduleId: 8, taskId: 'm8-4', priority: 'High' },
    ],
  },
};

const SECTOR_OVERRIDES: SectorOverride[] = [
  {
    templateId: 'sector-saas',
    label: 'Sugerido por sector: SaaS / Tecnología',
    sectors: ['saas / tecnología', 'saas', 'software', 'tecnología'],
    tasks: [
      { moduleId: 4, taskId: 'm4-2', priority: 'High' },
      { moduleId: 3, taskId: 'm3-6', priority: 'Medium' },
    ],
    moduleWeights: { 4: 16, 3: 16 },
  },
  {
    templateId: 'sector-turismo',
    label: 'Sugerido por sector: Turismo',
    sectors: ['turismo', 'hoteles', 'travel'],
    tasks: [
      { moduleId: 3, taskId: 'm3-4', priority: 'Medium' },
      { moduleId: 8, taskId: 'm8-1', priority: 'High' },
    ],
    moduleWeights: { 8: 18 },
  },
  {
    templateId: 'sector-salud',
    label: 'Sugerido por sector: Salud',
    sectors: ['salud', 'health', 'clínica'],
    tasks: [
      { moduleId: 5, taskId: 'm5-2', priority: 'High' },
      { moduleId: 5, taskId: 'm5-3', priority: 'High' },
    ],
    moduleWeights: { 5: 18 },
  },
  {
    templateId: 'sector-ecommerce',
    label: 'Sugerido por sector: Ecommerce',
    sectors: ['ecommerce generalista', 'ecommerce', 'retail'],
    tasks: [
      { moduleId: 2, taskId: 'm2-2', priority: 'High' },
      { moduleId: 6, taskId: 'm6-2', priority: 'High' },
    ],
    moduleWeights: { 2: 16, 6: 16 },
  },
];

const normalizeSector = (sector?: string): string => (sector || '').trim().toLowerCase();

const findSectorOverride = (sector?: string): SectorOverride | undefined => {
  const normalized = normalizeSector(sector);
  if (!normalized) {
    return undefined;
  }

  return SECTOR_OVERRIDES.find((override) =>
    override.sectors.some((candidate) => normalized.includes(candidate)),
  );
};

const clampTo100 = (weights: Record<number, number>): Record<number, number> => {
  const normalizedEntries = Object.entries(weights).map(([module, value]) => [Number(module), Math.max(0, value)] as const);
  const total = normalizedEntries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) {
    return weights;
  }

  return normalizedEntries.reduce<Record<number, number>>((acc, [module, value]) => {
    acc[module] = Math.round((value / total) * 100);
    return acc;
  }, {});
};

export const buildContextualRoadmap = (params: {
  projectType: ProjectType;
  sector?: string;
  useGenericConfig?: boolean;
  createdAt?: number;
}): {
  suggestedModuleIds: number[];
  moduleWeights: Record<number, number>;
  suggestions: ContextualTaskSuggestion[];
  roadmapTemplateMode: 'contextual' | 'generic';
} => {
  const { projectType, sector, useGenericConfig = false, createdAt = Date.now() } = params;

  const base = TYPE_BASE_TEMPLATES[projectType] || TYPE_BASE_TEMPLATES.MEDIA;
  const sectorOverride = findSectorOverride(sector);

  if (useGenericConfig) {
    return {
      suggestedModuleIds: [1, 2, 3, 4, 5],
      moduleWeights: { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 },
      suggestions: [],
      roadmapTemplateMode: 'generic',
    };
  }

  const seeded = new Map<string, ContextualTaskSuggestion>();
  base.tasks.forEach((task) => {
    const key = `${task.moduleId}:${task.taskId}`;
    seeded.set(key, {
      moduleId: task.moduleId,
      taskId: task.taskId,
      meta: {
        templateId: base.templateId,
        templateLabel: base.label,
        origin: 'project_type',
        projectType,
        sector,
        moduleId: task.moduleId,
        priority: task.priority,
        generatedAt: createdAt,
      },
    });
  });

  if (sectorOverride) {
    sectorOverride.tasks.forEach((task) => {
      const key = `${task.moduleId}:${task.taskId}`;
      seeded.set(key, {
        moduleId: task.moduleId,
        taskId: task.taskId,
        meta: {
          templateId: sectorOverride.templateId,
          templateLabel: sectorOverride.label,
          origin: 'sector',
          projectType,
          sector,
          moduleId: task.moduleId,
          priority: task.priority,
          generatedAt: createdAt,
        },
      });
    });
  }

  const mergedWeights = {
    ...base.moduleWeights,
    ...(sectorOverride?.moduleWeights || {}),
  };

  return {
    suggestedModuleIds: Array.from(new Set([...base.suggestedModuleIds, ...(sectorOverride?.tasks.map((task) => task.moduleId) || [])])),
    moduleWeights: clampTo100(mergedWeights),
    suggestions: Array.from(seeded.values()),
    roadmapTemplateMode: 'contextual',
  };
};
