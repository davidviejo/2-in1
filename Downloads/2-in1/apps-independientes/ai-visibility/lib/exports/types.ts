export const exportDatasetValues = [
  'summary_kpi_pack',
  'prompts_table',
  'responses_table',
  'citations_table',
  'competitors_comparison'
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
};
