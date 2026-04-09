export type GscImpactWindowName = 'preUpdate' | 'rollout' | 'postUpdate';

export interface DateRange {
  start: string;
  end: string;
}

export interface GscImpactWindowSchema {
  preUpdate: DateRange;
  rollout: DateRange;
  postUpdate: DateRange;
}

export interface AggregatedMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface EntityTemporalMetrics {
  preUpdate?: AggregatedMetrics;
  rollout?: AggregatedMetrics;
  postUpdate?: AggregatedMetrics;
}

export interface GscImpactDatasets {
  byUrl: Record<string, EntityTemporalMetrics>;
  byQuery: Record<string, EntityTemporalMetrics>;
}

export interface DeltaBundle {
  deltaAbs: {
    clicks: number;
    impressions: number;
    ctr: number;
  };
  deltaPct: {
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
  };
  /**
   * Positive value means improvement (better ranking), because lower GSC position is better.
   */
  deltaPosition: number;
  available: boolean;
}

export interface EntityDeltaSet {
  preToRollout: DeltaBundle;
  rolloutToPost: DeltaBundle;
  preToPost: DeltaBundle;
}

export interface ImpactScoreWeights {
  clicksPct: number;
  impressionsPct: number;
  ctrPct: number;
  position: number;
}

export interface ImpactFilters {
  minImpactScore?: number;
  minImpressions?: number;
  textSearch?: string;
  includePartials?: boolean;
  baseWindowForImpressions?: GscImpactWindowName;
}

export interface RankingOptions {
  weights?: Partial<ImpactScoreWeights>;
  scoreWindow?: keyof EntityDeltaSet;
  topN?: number;
  filters?: ImpactFilters;
}

export interface WindowValidationResult {
  valid: boolean;
  errors: string[];
}

export interface EntityImpactResult {
  entity: string;
  windows: EntityTemporalMetrics;
  deltas: EntityDeltaSet;
  impactScore: number;
  hasPartialData: boolean;
}

export interface RankingResult {
  all: EntityImpactResult[];
  winners: EntityImpactResult[];
  losers: EntityImpactResult[];
}

export interface GscImpactEngineResult {
  windowValidation: WindowValidationResult;
  rankingByUrl: RankingResult;
  rankingByQuery: RankingResult;
}

const DEFAULT_WEIGHTS: ImpactScoreWeights = {
  clicksPct: 0.4,
  impressionsPct: 0.2,
  ctrPct: 0.25,
  position: 0.15,
};

const DEFAULT_FILTERS: Required<ImpactFilters> = {
  minImpactScore: Number.NEGATIVE_INFINITY,
  minImpressions: 0,
  textSearch: '',
  includePartials: true,
  baseWindowForImpressions: 'preUpdate',
};

const parseRange = (range: DateRange) => ({
  start: new Date(range.start).getTime(),
  end: new Date(range.end).getTime(),
});

const safePctDelta = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return (current - previous) / Math.abs(previous);
};

const buildDelta = (from?: AggregatedMetrics, to?: AggregatedMetrics): DeltaBundle => {
  if (!from || !to) {
    return {
      deltaAbs: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
      },
      deltaPct: {
        clicks: null,
        impressions: null,
        ctr: null,
      },
      deltaPosition: 0,
      available: false,
    };
  }

  return {
    deltaAbs: {
      clicks: to.clicks - from.clicks,
      impressions: to.impressions - from.impressions,
      ctr: to.ctr - from.ctr,
    },
    deltaPct: {
      clicks: safePctDelta(to.clicks, from.clicks),
      impressions: safePctDelta(to.impressions, from.impressions),
      ctr: safePctDelta(to.ctr, from.ctr),
    },
    deltaPosition: from.position - to.position,
    available: true,
  };
};

const normalizePositionGain = (delta: DeltaBundle, baseline?: AggregatedMetrics): number | null => {
  if (!delta.available || !baseline) {
    return null;
  }

  if (baseline.position === 0) {
    return delta.deltaPosition === 0 ? 0 : null;
  }

  return delta.deltaPosition / Math.abs(baseline.position);
};

const computeImpactScore = (
  deltas: EntityDeltaSet,
  windows: EntityTemporalMetrics,
  selectedWindow: keyof EntityDeltaSet,
  weights: ImpactScoreWeights,
): number => {
  const target = deltas[selectedWindow];
  const baselineWindow: GscImpactWindowName =
    selectedWindow === 'rolloutToPost' ? 'rollout' : 'preUpdate';

  const weightedValues: Array<{ value: number | null; weight: number }> = [
    { value: target.deltaPct.clicks, weight: weights.clicksPct },
    { value: target.deltaPct.impressions, weight: weights.impressionsPct },
    { value: target.deltaPct.ctr, weight: weights.ctrPct },
    {
      value: normalizePositionGain(target, windows[baselineWindow]),
      weight: weights.position,
    },
  ];

  const validValues = weightedValues.filter(
    (entry): entry is { value: number; weight: number } => entry.value !== null,
  );

  if (validValues.length === 0) {
    return 0;
  }

  const totalWeight = validValues.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) {
    return 0;
  }

  const rawScore = validValues.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;
  return Number((rawScore * 100).toFixed(2));
};

export const validateWindowSchema = (schema: GscImpactWindowSchema): WindowValidationResult => {
  const errors: string[] = [];
  const ranges = {
    preUpdate: parseRange(schema.preUpdate),
    rollout: parseRange(schema.rollout),
    postUpdate: parseRange(schema.postUpdate),
  };

  (Object.entries(ranges) as Array<[GscImpactWindowName, { start: number; end: number }]>).forEach(
    ([windowName, range]) => {
      if (Number.isNaN(range.start) || Number.isNaN(range.end)) {
        errors.push(`Window ${windowName} has invalid date format.`);
        return;
      }

      if (range.start > range.end) {
        errors.push(`Window ${windowName} is empty: start must be before or equal to end.`);
      }
    },
  );

  const overlapChecks: Array<[GscImpactWindowName, GscImpactWindowName]> = [
    ['preUpdate', 'rollout'],
    ['rollout', 'postUpdate'],
    ['preUpdate', 'postUpdate'],
  ];

  overlapChecks.forEach(([left, right]) => {
    const a = ranges[left];
    const b = ranges[right];
    const hasOverlap = a.start <= b.end && b.start <= a.end;

    if (hasOverlap) {
      errors.push(`Windows ${left} and ${right} overlap.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

const rankEntities = (
  dataset: Record<string, EntityTemporalMetrics>,
  options: Required<Omit<RankingOptions, 'weights'>> & { weights: ImpactScoreWeights },
): RankingResult => {
  const filters = {
    ...DEFAULT_FILTERS,
    ...(options.filters || {}),
  };

  const impacts = Object.entries(dataset)
    .map(([entity, windows]) => {
      const deltas: EntityDeltaSet = {
        preToRollout: buildDelta(windows.preUpdate, windows.rollout),
        rolloutToPost: buildDelta(windows.rollout, windows.postUpdate),
        preToPost: buildDelta(windows.preUpdate, windows.postUpdate),
      };

      const hasPartialData = !windows.preUpdate || !windows.rollout || !windows.postUpdate;
      const impactScore = computeImpactScore(deltas, windows, options.scoreWindow, options.weights);

      return {
        entity,
        windows,
        deltas,
        impactScore,
        hasPartialData,
      } satisfies EntityImpactResult;
    })
    .filter((result) => {
      if (!filters.includePartials && result.hasPartialData) {
        return false;
      }

      const impressions = result.windows[filters.baseWindowForImpressions]?.impressions ?? 0;
      if (impressions < filters.minImpressions) {
        return false;
      }

      if (result.impactScore < filters.minImpactScore) {
        return false;
      }

      if (filters.textSearch) {
        return result.entity.toLowerCase().includes(filters.textSearch.toLowerCase());
      }

      return true;
    })
    .sort((a, b) => b.impactScore - a.impactScore);

  return {
    all: impacts,
    winners: impacts.filter((item) => item.impactScore > 0).slice(0, options.topN),
    losers: [...impacts]
      .filter((item) => item.impactScore < 0)
      .sort((a, b) => a.impactScore - b.impactScore)
      .slice(0, options.topN),
  };
};

export const analyzeGscImpact = (
  datasets: GscImpactDatasets,
  windowSchema: GscImpactWindowSchema,
  options: RankingOptions = {},
): GscImpactEngineResult => {
  const windowValidation = validateWindowSchema(windowSchema);
  const mergedOptions = {
    scoreWindow: options.scoreWindow ?? 'preToPost',
    topN: options.topN ?? 10,
    filters: options.filters ?? {},
    weights: {
      ...DEFAULT_WEIGHTS,
      ...(options.weights ?? {}),
    },
  } satisfies Required<Omit<RankingOptions, 'weights'>> & { weights: ImpactScoreWeights };

  return {
    windowValidation,
    rankingByUrl: rankEntities(datasets.byUrl, mergedOptions),
    rankingByQuery: rankEntities(datasets.byQuery, mergedOptions),
  };
};
