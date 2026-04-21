import { ProjectType } from '../types';

export type OpportunityFamily = 'quick_win' | 'anomaly';

export interface GscOpportunityThresholds {
  quickWinPositionMin: number;
  quickWinPositionMax: number;
  quickWinMinImpressions: number;
  lowCtrMinImpressions: number;
  lowCtrDeltaFromExpected: number;
  impressionsGrowthNoClicksMinGrowthRatio: number;
  impressionsGrowthNoClicksMinImpressions: number;
  urlCoverageMinQueries: number;
  urlCoverageMinImpressions: number;
  urlCoverageMaxCtr: number;
  abruptClicksDropMinRatio: number;
  abruptCtrDropMinRatio: number;
  topLossMinPositionShift: number;
  propertyDropMinRatio: number;
  dominantUrlSwitchMinImpressions: number;
  dominantUrlSwitchMinShareChange: number;
}

export const BASE_GSC_OPPORTUNITY_THRESHOLDS: GscOpportunityThresholds = {
  quickWinPositionMin: 4,
  quickWinPositionMax: 10,
  quickWinMinImpressions: 120,
  lowCtrMinImpressions: 140,
  lowCtrDeltaFromExpected: 0.018,
  impressionsGrowthNoClicksMinGrowthRatio: 0.2,
  impressionsGrowthNoClicksMinImpressions: 100,
  urlCoverageMinQueries: 4,
  urlCoverageMinImpressions: 300,
  urlCoverageMaxCtr: 0.03,
  abruptClicksDropMinRatio: 0.3,
  abruptCtrDropMinRatio: 0.25,
  topLossMinPositionShift: 1.6,
  propertyDropMinRatio: 0.18,
  dominantUrlSwitchMinImpressions: 100,
  dominantUrlSwitchMinShareChange: 0.25,
};

const PROJECT_TYPE_OVERRIDES: Partial<Record<ProjectType, Partial<GscOpportunityThresholds>>> = {
  LOCAL: {
    quickWinMinImpressions: 80,
    dominantUrlSwitchMinImpressions: 70,
    propertyDropMinRatio: 0.15,
  },
  ECOM: {
    lowCtrDeltaFromExpected: 0.015,
    impressionsGrowthNoClicksMinGrowthRatio: 0.15,
    urlCoverageMinQueries: 5,
  },
  MEDIA: {
    impressionsGrowthNoClicksMinGrowthRatio: 0.25,
    urlCoverageMinImpressions: 350,
  },
  INTERNATIONAL: {
    quickWinMinImpressions: 180,
    dominantUrlSwitchMinImpressions: 160,
  },
};

const SECTOR_OVERRIDES: Record<string, Partial<GscOpportunityThresholds>> = {
  turismo: {
    impressionsGrowthNoClicksMinGrowthRatio: 0.15,
    abruptClicksDropMinRatio: 0.25,
  },
  salud: {
    lowCtrDeltaFromExpected: 0.012,
    abruptCtrDropMinRatio: 0.2,
  },
  legal: {
    quickWinMinImpressions: 90,
    propertyDropMinRatio: 0.14,
  },
  ecommerce: {
    lowCtrDeltaFromExpected: 0.014,
    urlCoverageMinQueries: 5,
  },
};

const normalizeSector = (sector?: string) => (sector || 'generico').trim().toLowerCase();

export const resolveGscOpportunityThresholds = (
  projectType: ProjectType,
  sector?: string,
): GscOpportunityThresholds => {
  const projectOverrides = PROJECT_TYPE_OVERRIDES[projectType] || {};
  const normalizedSector = normalizeSector(sector);
  const sectorOverride =
    Object.entries(SECTOR_OVERRIDES).find(([key]) => normalizedSector.includes(key))?.[1] || {};

  return {
    ...BASE_GSC_OPPORTUNITY_THRESHOLDS,
    ...projectOverrides,
    ...sectorOverride,
  };
};

export const expectedCtrForPosition = (position: number): number => {
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.18;
  if (position <= 3) return 0.12;
  if (position <= 5) return 0.085;
  if (position <= 8) return 0.055;
  if (position <= 10) return 0.04;
  return 0.022;
};
