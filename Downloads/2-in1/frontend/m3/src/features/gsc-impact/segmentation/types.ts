export interface ProjectCustomCluster {
  name: string;
  paths: string[];
}

export interface ProjectTemplateRule {
  template: string;
  pattern: string;
}

export interface ProjectPathRule {
  segment: string;
  prefix: string;
}

export interface ProjectRegexRule {
  segment: string;
  pattern: string;
  flags: string;
}

export interface ProjectExclusionRule {
  kind: string;
  value: string;
}

export interface ProjectSegmentationConfig {
  customClusters: ProjectCustomCluster[];
  templateRules: ProjectTemplateRule[];
  pathRules: ProjectPathRule[];
  regexRules: ProjectRegexRule[];
  brandedTerms: string[];
  exclusions: ProjectExclusionRule[];
  manualMappings: Record<string, string>;
}
