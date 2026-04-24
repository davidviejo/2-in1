export interface DashboardGscFetchPlan {
  analysisRowLimit: number;
  analysisMaxRows: number;
  analysisDateChunkSizeDays: number;
  evolutionRowLimit: number;
  evolutionMaxRows: number;
  evolutionDateChunkSizeDays: number;
}

export interface DashboardGscFetchPlanOverrides {
  analysisMaxRows?: number;
  evolutionMaxRows?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ROW_LIMIT = 25000;

const daysBetweenInclusive = (startDate: string, endDate: string): number => {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.max(1, Math.floor((end - start) / DAY_MS) + 1);
};

const pickChunkSizeDays = (rangeDays: number): number => {
  if (rangeDays <= 35) return 1;
  if (rangeDays <= 93) return 3;
  if (rangeDays <= 186) return 7;
  if (rangeDays <= 365) return 14;
  return 28;
};

const pickAnalysisMaxRows = (rangeDays: number): number => {
  if (rangeDays <= 35) return 160_000;
  if (rangeDays <= 93) return 180_000;
  if (rangeDays <= 186) return 220_000;
  return 260_000;
};

const pickEvolutionMaxRows = (rangeDays: number): number => {
  if (rangeDays <= 35) return 120_000;
  if (rangeDays <= 93) return 160_000;
  if (rangeDays <= 186) return 220_000;
  return 280_000;
};

export const buildDashboardGscFetchPlan = (
  startDate: string,
  endDate: string,
  overrides?: DashboardGscFetchPlanOverrides,
): DashboardGscFetchPlan => {
  const rangeDays = daysBetweenInclusive(startDate, endDate);
  const chunkSizeDays = pickChunkSizeDays(rangeDays);

  return {
    analysisRowLimit: DEFAULT_ROW_LIMIT,
    analysisMaxRows: overrides?.analysisMaxRows || pickAnalysisMaxRows(rangeDays),
    analysisDateChunkSizeDays: chunkSizeDays,
    evolutionRowLimit: DEFAULT_ROW_LIMIT,
    evolutionMaxRows: overrides?.evolutionMaxRows || pickEvolutionMaxRows(rangeDays),
    evolutionDateChunkSizeDays: Math.max(chunkSizeDays, 7),
  };
};
