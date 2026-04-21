import { ProjectType } from '../types';

export type SeoInsightCategory =
  | 'opportunity'
  | 'risk'
  | 'performance'
  | 'coverage'
  | 'content'
  | 'linking'
  | 'ctr'
  | 'position';

export type SeoInsightSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SeoInsightPriority = 'low' | 'medium' | 'high';
export type SeoInsightLifecycleStatus =
  | 'new'
  | 'triaged'
  | 'planned'
  | 'in_progress'
  | 'done'
  | 'ignored'
  | 'postponed'
  | 'actionable'
  | 'watch'
  | 'investigate'
  | 'ok';

export type SeoInsightSourceType = 'query' | 'url' | 'property' | 'cluster';
export type SeoInsightBrandType = 'brand' | 'non-brand' | 'mixed';

export interface SeoInsightMetricEvidence {
  label: string;
  value: string;
  context?: string;
  metricKey?: string;
}

export interface SeoInsightDateRange {
  startDate: string;
  endDate: string;
}

export interface SeoInsightRowSupport {
  query: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoInsight {
  id: string;
  sourceType?: SeoInsightSourceType;
  sourceId?: string;
  propertyId?: string;
  category: SeoInsightCategory;
  ruleKey?: string;
  title: string;
  description?: string;
  priority: SeoInsightPriority;
  severity: SeoInsightSeverity;
  score: number;
  opportunity: number;
  confidence: number;
  effort?: number;
  moduleId?: number;
  suggestedAction?: string;
  status: SeoInsightLifecycleStatus;
  periodCurrent?: SeoInsightDateRange;
  periodPrevious?: SeoInsightDateRange;
  evidence: SeoInsightMetricEvidence[];
  metricsSupport?: SeoInsightRowSupport[];
  brandType?: SeoInsightBrandType;
  projectType?: ProjectType;
  sector?: string;
  geoScope?: string;
  firstDetectedAt?: number;
  updatedAt?: number;
  createdAt?: number;

  // Backward compatibility for existing UI
  summary: string;
  reason: string;
  action: string;
  visualContext: {
    icon: string;
    tone: string;
    categoryLabel: string;
  };
  affectedCount: number;
  businessValue: number;
  implementationEase: number;
  impact: number;
  urgency: number;
  ease: number;
  relatedRows: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    query?: string;
    url?: string;
    page?: string;
  }>;
  metrics: {
    potentialTraffic?: number;
  };
}

export interface SeoInsightSummary {
  category: SeoInsightCategory;
  label: string;
  description?: string;
  count: number;
  topPriority: SeoInsightPriority;
  insights: SeoInsight[];
}

export interface SeoInsightEngineInput {
  currentRows: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  previousRows?: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  propertyId?: string;
  periodCurrent?: SeoInsightDateRange;
  periodPrevious?: SeoInsightDateRange;
  brandTerms?: string[];
  projectType?: ProjectType;
  sector?: string;
  geoScope?: string;
}
