import { GSCRow } from '../types';

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
export type SeoInsightStatus = 'actionable' | 'watch' | 'investigate' | 'ok';

export interface SeoInsightEvidence {
  label: string;
  value: string;
  context?: string;
}

export interface SeoInsight {
  id: string;
  title: string;
  summary: string;
  reason: string;
  evidence: SeoInsightEvidence[];
  priority: SeoInsightPriority;
  severity: SeoInsightSeverity;
  opportunity: number;
  action: string;
  status: SeoInsightStatus;
  visualContext: {
    icon: string;
    tone: string;
    categoryLabel: string;
  };
  category: SeoInsightCategory;
  score: number;
  affectedCount: number;
  confidence: number;
  businessValue: number;
  implementationEase: number;
  relatedRows: GSCRow[];
  metrics: {
    potentialTraffic?: number;
  };
}

export interface SeoInsightSummary {
  category: SeoInsightCategory;
  label: string;
  description: string;
  count: number;
  topPriority: SeoInsightPriority;
  insights: SeoInsight[];
}

export interface SeoInsightEngineInput {
  currentRows: GSCRow[];
  previousRows?: GSCRow[];
}
