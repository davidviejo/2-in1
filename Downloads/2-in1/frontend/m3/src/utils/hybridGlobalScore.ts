import { ModuleData } from '@/types';
import { SeoInsight } from '@/types/seoInsights';

interface ScoreWeights {
  structural: number;
  performance: number;
}

interface StructuralWeights {
  tasksCompletion: number;
  modulesCoverage: number;
  roadmapProgress: number;
  checklistCompleteness: number;
}

interface PerformanceWeights {
  clicksEvolution: number;
  ctrEvolution: number;
  positionStability: number;
  quickWinsCapitalized: number;
  risksControl: number;
  nonBrandPerformance: number;
}

export interface HybridGlobalScoreConfig {
  scoreWeights: ScoreWeights;
  structuralWeights: StructuralWeights;
  performanceWeights: PerformanceWeights;
}

export interface HybridScoreInput {
  modules: ModuleData[];
  structuralScore: number;
  performance: {
    current: { clicks: number; ctr: number; position: number };
    previous: { clicks: number; ctr: number; position: number };
  };
  nonBrand: {
    currentClicks: number;
    previousClicks: number;
  };
  insights: SeoInsight[];
  propertyId?: string;
  periodCurrent?: string;
  periodPrevious?: string;
  timestamp?: number;
}

export interface ScoreDriver {
  key: string;
  label: string;
  score: number;
  impact: 'up' | 'down' | 'neutral';
  detail: string;
}

export interface HybridGlobalScoreResult {
  globalScore: number;
  structuralSubscore: number;
  performanceSubscore: number;
  variationVsPrevious: number;
  fallbackUsed: boolean;
  driversUp: ScoreDriver[];
  driversDown: ScoreDriver[];
  trace: {
    propertyId: string;
    periodCurrent: string;
    periodPrevious: string;
    timestamp: number;
    module: 'dashboard';
  };
}

const DEFAULT_CONFIG: HybridGlobalScoreConfig = {
  scoreWeights: {
    structural: 0.6,
    performance: 0.4,
  },
  structuralWeights: {
    tasksCompletion: 0.35,
    modulesCoverage: 0.2,
    roadmapProgress: 0.25,
    checklistCompleteness: 0.2,
  },
  performanceWeights: {
    clicksEvolution: 0.22,
    ctrEvolution: 0.16,
    positionStability: 0.16,
    quickWinsCapitalized: 0.16,
    risksControl: 0.16,
    nonBrandPerformance: 0.14,
  },
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const normalizeDelta = (value: number, minDelta: number, maxDelta: number) => {
  if (maxDelta <= minDelta) return 50;
  const normalized = ((value - minDelta) / (maxDelta - minDelta)) * 100;
  return clamp(normalized);
};

const getRatio = (num: number, den: number) => (den > 0 ? num / den : 0);

const computeStructuralSubscore = (modules: ModuleData[], structuralScore: number, config: StructuralWeights) => {
  const totalTasks = modules.reduce((acc, module) => acc + module.tasks.length, 0);
  const completedTasks = modules.reduce(
    (acc, module) => acc + module.tasks.filter((task) => task.status === 'completed').length,
    0,
  );
  const modulesWorked = modules.filter((module) => module.tasks.some((task) => task.status === 'completed')).length;

  const roadmapTasks = modules.flatMap((module) => module.tasks.filter((task) => task.isInCustomRoadmap));
  const roadmapCompleted = roadmapTasks.filter((task) => task.status === 'completed').length;

  const tasksCompletionScore = getRatio(completedTasks, totalTasks) * 100;
  const modulesCoverageScore = getRatio(modulesWorked, modules.length) * 100;
  const roadmapProgressScore = roadmapTasks.length > 0 ? getRatio(roadmapCompleted, roadmapTasks.length) * 100 : tasksCompletionScore;
  const checklistCompletenessScore = structuralScore;

  return clamp(
    tasksCompletionScore * config.tasksCompletion +
      modulesCoverageScore * config.modulesCoverage +
      roadmapProgressScore * config.roadmapProgress +
      checklistCompletenessScore * config.checklistCompleteness,
  );
};

const deltaPct = (current: number, previous: number) => {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

export const computeHybridGlobalScore = (
  input: HybridScoreInput,
  config: HybridGlobalScoreConfig = DEFAULT_CONFIG,
): HybridGlobalScoreResult => {
  const structuralSubscore = computeStructuralSubscore(input.modules, input.structuralScore, config.structuralWeights);

  const quickWins = input.insights.filter((insight) => insight.findingFamily === 'quick_win');
  const quickWinsCapitalized = quickWins.filter((insight) => insight.status === 'done').length;
  const riskInsights = input.insights.filter((insight) => insight.category === 'risk');
  const openRisks = riskInsights.filter((insight) => !['done', 'ok', 'ignored'].includes(insight.status)).length;

  const clicksDelta = deltaPct(input.performance.current.clicks, input.performance.previous.clicks);
  const ctrDelta = input.performance.current.ctr - input.performance.previous.ctr;
  const positionDelta = input.performance.current.position - input.performance.previous.position;
  const nonBrandDelta = deltaPct(input.nonBrand.currentClicks, input.nonBrand.previousClicks);

  const hasPerformanceData = input.performance.current.clicks > 0 || input.performance.current.ctr > 0;

  const clicksEvolutionScore = normalizeDelta(clicksDelta, -40, 40);
  const ctrEvolutionScore = normalizeDelta(ctrDelta, -3, 3);
  const positionStabilityScore = clamp(100 - Math.abs(positionDelta) * 18 + (positionDelta < 0 ? 8 : 0));
  const quickWinsCapitalizedScore =
    quickWins.length > 0 ? clamp(getRatio(quickWinsCapitalized, quickWins.length) * 100) : 50;
  const risksControlScore = riskInsights.length > 0 ? clamp((1 - getRatio(openRisks, riskInsights.length)) * 100) : 65;
  const nonBrandPerformanceScore = normalizeDelta(nonBrandDelta, -35, 35);

  const performanceSubscoreRaw =
    clicksEvolutionScore * config.performanceWeights.clicksEvolution +
    ctrEvolutionScore * config.performanceWeights.ctrEvolution +
    positionStabilityScore * config.performanceWeights.positionStability +
    quickWinsCapitalizedScore * config.performanceWeights.quickWinsCapitalized +
    risksControlScore * config.performanceWeights.risksControl +
    nonBrandPerformanceScore * config.performanceWeights.nonBrandPerformance;

  const performanceSubscore = hasPerformanceData
    ? clamp(performanceSubscoreRaw)
    : clamp(structuralSubscore * 0.7 + 15);

  const effectiveWeights = hasPerformanceData
    ? config.scoreWeights
    : { structural: 0.85, performance: 0.15 };

  const globalScore = clamp(
    structuralSubscore * effectiveWeights.structural + performanceSubscore * effectiveWeights.performance,
  );

  const previousPerformanceSubscore = clamp(
    50 * config.performanceWeights.clicksEvolution +
      50 * config.performanceWeights.ctrEvolution +
      92 * config.performanceWeights.positionStability +
      quickWinsCapitalizedScore * config.performanceWeights.quickWinsCapitalized +
      risksControlScore * config.performanceWeights.risksControl +
      50 * config.performanceWeights.nonBrandPerformance,
  );

  const previousGlobal = clamp(
    structuralSubscore * effectiveWeights.structural + previousPerformanceSubscore * effectiveWeights.performance,
  );

  const drivers: ScoreDriver[] = [
    {
      key: 'clicks',
      label: 'Evolución de clics',
      score: clicksEvolutionScore,
      impact: clicksDelta > 1 ? 'up' : clicksDelta < -1 ? 'down' : 'neutral',
      detail: `Δ ${clicksDelta.toFixed(1)}% vs periodo anterior.`,
    },
    {
      key: 'ctr',
      label: 'Evolución de CTR',
      score: ctrEvolutionScore,
      impact: ctrDelta > 0.1 ? 'up' : ctrDelta < -0.1 ? 'down' : 'neutral',
      detail: `Δ ${ctrDelta >= 0 ? '+' : ''}${ctrDelta.toFixed(2)} pp.`,
    },
    {
      key: 'position',
      label: 'Estabilidad de posiciones',
      score: positionStabilityScore,
      impact: positionDelta < -0.15 ? 'up' : positionDelta > 0.2 ? 'down' : 'neutral',
      detail: `Posición media ${input.performance.current.position.toFixed(2)} (${positionDelta >= 0 ? '+' : ''}${positionDelta.toFixed(2)}).`,
    },
    {
      key: 'quick_wins',
      label: 'Quick wins capitalizados',
      score: quickWinsCapitalizedScore,
      impact: quickWinsCapitalizedScore >= 60 ? 'up' : 'down',
      detail: `${quickWinsCapitalized}/${quickWins.length || 0} quick wins cerrados.`,
    },
    {
      key: 'risks',
      label: 'Riesgos abiertos',
      score: risksControlScore,
      impact: risksControlScore >= 60 ? 'up' : 'down',
      detail: `${openRisks} riesgos abiertos de ${riskInsights.length || 0}.`,
    },
    {
      key: 'non_brand',
      label: 'Rendimiento non-brand',
      score: nonBrandPerformanceScore,
      impact: nonBrandDelta > 0.5 ? 'up' : nonBrandDelta < -0.5 ? 'down' : 'neutral',
      detail: `Δ ${nonBrandDelta.toFixed(1)}% en clics non-brand.`,
    },
  ];

  return {
    globalScore: Math.round(globalScore),
    structuralSubscore: Math.round(structuralSubscore),
    performanceSubscore: Math.round(performanceSubscore),
    variationVsPrevious: Number((globalScore - previousGlobal).toFixed(1)),
    fallbackUsed: !hasPerformanceData,
    driversUp: drivers.filter((driver) => driver.impact === 'up').sort((a, b) => b.score - a.score),
    driversDown: drivers.filter((driver) => driver.impact === 'down').sort((a, b) => a.score - b.score),
    trace: {
      propertyId: input.propertyId || 'Sin propiedad',
      periodCurrent: input.periodCurrent || 'No definido',
      periodPrevious: input.periodPrevious || 'No definido',
      timestamp: input.timestamp || Date.now(),
      module: 'dashboard',
    },
  };
};
