export const exportDatasetValues = [
  'summary_kpi_pack',
  'timeseries',
  'prompts_performance',
  'prompts_table',
  'responses_table',
  'citations_table',
  'competitors_comparison',
  'report_pack'
] as const;

export type ExportDataset = (typeof exportDatasetValues)[number];

export const exportFormatValues = ['csv', 'xlsx'] as const;

export type ExportFileFormat = (typeof exportFormatValues)[number];

export type ExportRequestFilters = {
  from?: string;
  to?: string;
  q?: string;
  country?: string;
  language?: string;
  active?: 'all' | 'active' | 'inactive';
  intentClassification?: string;
  tagIds?: string;
  granularity?: 'day' | 'week';
  provider?: string;
  surface?: string;
  analysisMode?: string;
  modelLabel?: string;
  captureMethod?: string;
  includeNarrativeInsights?: boolean;
};

export type ExportColumn = {
  key: string;
  label: string;
};

export type ExportTable = {
  dataset: ExportDataset;
  columns: ExportColumn[];
  rows: Record<string, string | number | boolean | null>[];
  suggestedFilename: string;
  sectionName?: string;
};

export type NarrativeInsightDraft = {
  area: 'strongest_prompts' | 'source_opportunities' | 'competitor_pressure' | 'model_differences';
  bullet: string;
  metrics: Record<string, string | number | null>;
};

export type ReportExportPack = {
  dataset: 'report_pack';
  suggestedFilename: string;
  sections: ExportTable[];
  narrativeInsights: NarrativeInsightDraft[];
};

export type ExportArtifact = ExportTable | ReportExportPack;

export function isReportExportPack(value: ExportArtifact): value is ReportExportPack {
  return value.dataset === 'report_pack';
}
