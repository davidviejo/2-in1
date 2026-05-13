export type IntelligenceStatus = 'new' | 'in_review' | 'in_progress' | 'completed' | 'discarded' | 'blocked';
export type IntelligencePriority = 'low' | 'medium' | 'high' | 'critical';

export interface IntelligenceBase {
  id: string;
  projectId: string;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
  status: IntelligenceStatus;
  source: string;
  confidence: number;
  priority: IntelligencePriority;
}

export interface OpportunityScore {
  impact: number;
  confidence: number;
  ease: number;
  businessValue: number;
  urgency: number;
  total: number;
}
export interface Opportunity extends IntelligenceBase { title: string; type: string; urlOrCluster: string; effort: number; score: OpportunityScore; hypothesis?: string; }
export interface SeoSignal extends IntelligenceBase { title: string; metric: string; delta: number; urlOrCluster: string; }
export interface IndexationRecord extends IntelligenceBase { url: string; indexable: boolean; metaRobots: string; robotsTxt: string; canonicalDeclared?: string; canonicalDetected?: string; sitemapIncluded: boolean; httpStatus: number; lastCheckedAt: string; probableCause: string; recommendation: string; suggestedAction: string; }
export interface CrawlRun extends IntelligenceBase { ranAt: string; totalUrls: number; new404: number; new3xx: number; newNoindex: number; }
export interface CrawlIssue extends IntelligenceBase { crawlRunId: string; issueType: string; url: string; details: string; }
export interface ContentGap extends IntelligenceBase { keyword: string; intent: string; volume: number; difficulty: number; competitor: string; competitorUrl: string; competitorPosition: number; ownPosition?: number; cluster: string; recommendation: string; }
export interface CannibalizationIssue extends IntelligenceBase { query: string; urls: string[]; winningUrlFluctuation: boolean; overlappedCluster: string; recommendation: string; }
export interface InternalLinkSuggestion extends IntelligenceBase { sourceUrl: string; targetUrl: string; anchorSuggestion: string; reason: string; }
export interface SerpAiVisibilityRecord extends IntelligenceBase { keyword: string; organicPosition?: number; serpFeatures: string[]; brandPresence: 'high'|'medium'|'low'; competitorsVisible: string[]; aiPresence?: boolean; citedSources?: string[]; dominantFormat: string; recommendedFormat: string; }
export interface SeoForecast extends IntelligenceBase { scenario: 'conservative'|'expected'|'aggressive'; cluster: string; incrementalTraffic: number; ctrGain: number; positionGain: number; confidenceLevel: number; risks: string[]; }
export interface ContentBrief extends IntelligenceBase { primaryKeyword: string; secondaryKeywords: string[]; cluster: string; searchIntent: string; uniqueValueMandatory: string; recommendedTitle: string; h1: string; h2h3Structure: string[]; faqs: string[]; metaTitle: string; metaDescription: string; cta: string; }
export interface ImpactLedgerEntry extends IntelligenceBase { action: string; urls: string[]; cluster: string; implementationDate: string; owner: string; hypothesis: string; mainMetric: string; secondaryMetrics: string[]; measurementWindows: Array<7|14|28|90>; beforeAfter: string; externalFactors: string; learning: string; nextAction: string; }
