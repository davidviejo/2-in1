import { applyProjectOverrides } from './configAdapter';
import {
  BaseSegmentationResult,
  computeBaseSegmentation,
  QuerySegmentFilter,
  SegmentationFilters,
  SegmentationInput,
} from './coreEngine';
import { ProjectSegmentationConfig } from './types';

export type SegmentationPipelineInput = SegmentationInput & {
  mode: 'query' | 'url';
};

export type SegmentationPipelineOptions = {
  filters: SegmentationFilters;
  projectConfig: ProjectSegmentationConfig;
};

export type SegmentationPipelineResult = BaseSegmentationResult & {
  customSegment: string | null;
  cluster: string | null;
  excluded: boolean;
  included: boolean;
};

export type ImpactRowLike = {
  key: string;
  label: string;
  preImpressions: number;
  rolloutImpressions: number;
  postImpressions: number;
};

export type QueryFilterInput = {
  segmentFilter: QuerySegmentFilter;
  brandTerms: string[];
  minImpressions: number;
};

export type UrlFilterInput = {
  minImpressions: number;
  pathPrefix: string;
  selectedTemplate: string;
  templateRules: SegmentationFilters['templateRules'];
  templateManualMap: SegmentationFilters['templateManualMap'];
};

const getMaxImpressions = (row: ImpactRowLike): number =>
  Math.max(row.preImpressions, row.rolloutImpressions, row.postImpressions);

const includeByMode = (
  mode: SegmentationPipelineInput['mode'],
  result: BaseSegmentationResult & { template: string; excluded: boolean },
  filters: SegmentationFilters,
): boolean => {
  if (result.excluded || !result.meetsMinImpressions) return false;

  if (mode === 'query') {
    return result.queryMatchesSegment;
  }

  return result.matchesPathPrefix && (filters.selectedTemplate === 'all' || result.template === filters.selectedTemplate);
};

export const runSegmentationPipeline = (
  input: SegmentationPipelineInput,
  options: SegmentationPipelineOptions,
): SegmentationPipelineResult => {
  const base = computeBaseSegmentation(input, options.filters);
  const withOverrides = applyProjectOverrides(base, options.projectConfig);

  return {
    ...withOverrides,
    included: includeByMode(input.mode, withOverrides, options.filters),
  };
};

export const filterQueryImpactRows = <TRow extends ImpactRowLike>(
  rows: TRow[],
  input: QueryFilterInput,
  projectConfig: ProjectSegmentationConfig,
): TRow[] => {
  const filters: SegmentationFilters = {
    segmentFilter: input.segmentFilter,
    brandTerms: input.brandTerms,
    minImpressions: input.minImpressions,
    pathPrefix: '',
    selectedTemplate: 'all',
    templateRules: [],
    templateManualMap: {},
  };

  return rows.filter((row) =>
    runSegmentationPipeline(
      {
        mode: 'query',
        query: row.label,
        maxImpressions: getMaxImpressions(row),
      },
      { filters, projectConfig },
    ).included,
  );
};

export const mapAndFilterUrlImpactRows = <TRow extends ImpactRowLike>(
  rows: TRow[],
  input: UrlFilterInput,
  projectConfig: ProjectSegmentationConfig,
): Array<TRow & { template: string }> => {
  const filters: SegmentationFilters = {
    segmentFilter: 'all',
    brandTerms: [],
    minImpressions: input.minImpressions,
    pathPrefix: input.pathPrefix,
    selectedTemplate: input.selectedTemplate,
    templateRules: input.templateRules,
    templateManualMap: input.templateManualMap,
  };

  const output: Array<TRow & { template: string }> = [];

  rows.forEach((row) => {
    const result = runSegmentationPipeline(
      {
        mode: 'url',
        url: row.key,
        query: row.label,
        maxImpressions: getMaxImpressions(row),
      },
      { filters, projectConfig },
    );

    if (!result.included) return;
    output.push({
      ...row,
      template: result.template,
    });
  });

  return output;
};

export const collectAvailableTemplates = (
  rows: ImpactRowLike[],
  input: Pick<UrlFilterInput, 'templateRules' | 'templateManualMap'>,
  projectConfig: ProjectSegmentationConfig,
): string[] => {
  const filters: SegmentationFilters = {
    segmentFilter: 'all',
    brandTerms: [],
    minImpressions: 0,
    pathPrefix: '',
    selectedTemplate: 'all',
    templateRules: input.templateRules,
    templateManualMap: input.templateManualMap,
  };

  const values = new Set(
    rows.map((row) =>
      runSegmentationPipeline(
        {
          mode: 'url',
          url: row.key,
          query: row.label,
          maxImpressions: getMaxImpressions(row),
        },
        { filters, projectConfig },
      ).template,
    ),
  );

  return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b));
};
