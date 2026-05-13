export type CannibalizationIssueType =
  | 'query_overlap'
  | 'cluster_overlap'
  | 'intent_overlap'
  | 'url_fluctuation'
  | 'ranking_split'
  | 'duplicate_content'
  | 'similar_title_h1'
  | 'wrong_url_ranking'
  | 'internal_anchor_conflict'
  | 'canonical_conflict'
  | 'content_gap_overlap'
  | 'serp_switching';

export type CannibalizationRecommendationType =
  | 'merge_content'
  | 'differentiate_intent'
  | 'canonicalize'
  | 'redirect'
  | 'improve_internal_linking'
  | 'change_target_keyword'
  | 'update_title_h1'
  | 'create_hub_page'
  | 'split_content'
  | 'no_action'
  | 'investigate';

export type CannibalizationStatus =
  | 'new' | 'reviewed' | 'dismissed' | 'no_action' | 'opportunity_created' | 'sent_to_task'
  | 'sent_to_roadmap' | 'brief_generated' | 'in_progress' | 'resolved' | 'measuring_impact';

export interface CannibalizedUrl { url: string; title?: string; h1?: string; cluster?: string; primaryKeyword?: string; clicks?: number; impressions?: number; ctr?: number; position?: number; canonical?: string; isWinning?: boolean; }

export interface CannibalizationIssue {
  id: string; projectId: string; type: CannibalizationIssueType; title: string; query?: string; cluster?: string;
  affectedUrls: CannibalizedUrl[]; winningUrl?: string; recommendedPrimaryUrl?: string; urlCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low'; recommendationType: CannibalizationRecommendationType; score: number;
  scoreBreakdown: { trafficRiskScore: number; overlapStrengthScore: number; businessValueScore: number; fixEaseScore: number; confidenceScore: number; urgencyScore: number; };
  recommendation: string; reason: string; evidence: string[]; status: CannibalizationStatus;
  sourceModule: 'gsc' | 'checklist' | 'cluster' | 'content_gap' | 'manual'; dataMode: 'real' | 'partial' | 'mock';
  confidence: number; detectedAt: string; updatedAt: string; notes?: string;
}

export interface CannibalizationFilters { search: string; statuses: CannibalizationStatus[]; severities: Array<CannibalizationIssue['severity']>; minScore: number; }
