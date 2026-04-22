export type ImpactLevel = 'High' | 'Medium' | 'Low';
export type TaskStatus = string;

export interface KanbanColumn {
  id: string;
  title: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  impact: ImpactLevel;
  status: TaskStatus;
  category?: string; // e.g., "Technical", "Content", "Off-page"
  isCustom?: boolean;
  isInCustomRoadmap?: boolean;
  userNotes?: string;
  communicated?: boolean;
  externalLink?: string;
  assignee?: string;
  dueDate?: string;
  flow?: InsightFlowTrace;
  insightSourceMeta?: InsightSourceMeta;
  templateMeta?: TaskTemplateMeta;
  impactLink?: TaskImpactLink;
  impactPostWindowDays?: number;
}

export type TaskTemplateOrigin = 'generic' | 'project_type' | 'sector' | 'client_custom';

export interface TaskTemplateMeta {
  templateId: string;
  templateLabel: string;
  origin: TaskTemplateOrigin;
  projectType: ProjectType;
  sector?: string;
  moduleId: number;
  priority: 'High' | 'Medium' | 'Low';
  generatedAt: number;
}

export interface InsightSourceMeta {
  insightId: string;
  sourceType: string;
  sourceLabel: string;
  moduleId?: number;
  metricsSnapshot: Record<string, number | string | undefined>;
  periodContext?: {
    current?: string;
    previous?: string;
  };
  property?: string;
  query?: string;
  url?: string;
  timestamp: number;
}

export interface InsightFlowEvidence {
  label: string;
  value: string;
  context?: string;
}

export interface InsightFlowTrace {
  finding: string;
  insight: {
    id: string;
    title: string;
    summary: string;
    reason: string;
  };
  opportunityOrRisk: 'opportunity' | 'risk';
  recommendedAction: string;
  evidence: InsightFlowEvidence[];
  impact: {
    score: number;
    confidence: number;
    opportunity: number;
    businessValue?: number;
  };
  source: {
    tool: string;
    query?: string;
    url?: string;
  };
  phase?: 'phase1';
}

export interface CompletedTask {
  id: string;
  taskId?: string; // Reference to original task if exists
  title: string;
  description?: string;
  completedAt: number;
  source: 'manual' | 'module';
  moduleId?: number;
  beforeAfter?: TaskBeforeAfterAnalysis;
}

export interface TaskImpactLink {
  query?: string;
  url?: string;
  property?: string;
  module?: string;
}

export interface TaskImpactSnapshot {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  periodStart: string;
  periodEnd: string;
  capturedAt: number;
}

export type TaskImpactValidationStatus =
  | 'improvement'
  | 'neutral'
  | 'worse'
  | 'insufficient_window'
  | 'pending_baseline';

export interface TaskImpactTrace {
  source: 'gsc';
  property: string;
  query?: string;
  url?: string;
  module?: string;
  projectType?: ProjectType;
  sector?: string;
  geoScope?: GeoScope;
  timestamp: number;
}

export interface TaskBeforeAfterAnalysis {
  link: TaskImpactLink;
  postWindowDays: number;
  minimumValidationDays: number;
  baseline?: TaskImpactSnapshot;
  postAction?: TaskImpactSnapshot;
  status: TaskImpactValidationStatus;
  insight: string;
  lastEvaluatedAt?: number;
  trace: TaskImpactTrace;
}

export interface ModuleData {
  id: number;
  title: string;
  subtitle: string;
  levelRange: string; // e.g., "0-20"
  description: string;
  iconName: string;
  tasks: Task[];
  isCustom?: boolean;
}

export interface AppState {
  globalScore: number;
  modules: ModuleData[];
}

export type ClientVertical = 'media' | 'ecom' | 'local' | 'national' | 'international';
export type ProjectType = 'MEDIA' | 'ECOM' | 'LOCAL' | 'NATIONAL' | 'INTERNATIONAL';
export type GeoScope = 'local' | 'national' | 'international' | 'global';
export type ProjectPriority = 'growth' | 'traffic' | 'conversions' | 'authority' | 'local-presence';
export type InsightRuleKey =
  | 'brand-protection'
  | 'content-gap'
  | 'category-opportunity'
  | 'local-pack'
  | 'seasonality-watch'
  | 'international-expansion';

export interface ProjectScoreWeights {
  visibility: number;
  technical: number;
  content: number;
  authority: number;
  conversion: number;
}

export interface AppliedModuleScoreWeight {
  moduleId: number;
  weight: number;
  source: 'base' | 'projectType' | 'sector' | 'geoScope';
}

export interface ProjectScoreContext {
  projectType: ProjectType;
  sector: string;
  geoScope: GeoScope;
  timestamp: number;
  score: number;
  fallbackUsed: boolean;
  appliedWeights: AppliedModuleScoreWeight[];
  criticalModuleIds: number[];
  moduleMaturity: Record<number, number>;
}

export interface ProjectInitialConfigPreset {
  useGenericConfig?: boolean;
  suggestedModuleIds: number[];
  priorities: ProjectPriority[];
  insightRules: InsightRuleKey[];
  scoreWeights: ProjectScoreWeights;
}

export interface Note {
  id: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
}

export interface IAVisibilityPromptConfig {
  tone: string;
  objective: string;
  language: string;
  location: string;
  devices: string[];
  competitors: string[];
  prompts: string[];
}

export interface IAVisibilityCompetitorMention {
  competitor: string;
  mentions: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface IAVisibilitySentimentSummary {
  positive: number;
  neutral: number;
  negative: number;
}

export interface IAVisibilityRunResult {
  id: string;
  createdAt: number;
  prompt: string;
  answer: string;
  source?: string;
  competitorMentions: IAVisibilityCompetitorMention[];
  sentimentSummary: IAVisibilitySentimentSummary;
}

export interface IAVisibilityState {
  config: IAVisibilityPromptConfig;
  history: IAVisibilityRunResult[];
}

export const createDefaultIAVisibilityState = (): IAVisibilityState => ({
  config: {
    tone: 'neutral',
    objective: '',
    language: 'es',
    location: '',
    devices: [],
    competitors: [],
    prompts: [],
  },
  history: [],
});

export interface Client {
  id: string;
  name: string;
  vertical: ClientVertical;
  projectType?: ProjectType;
  analysisProjectTypes?: ProjectType[];
  sector?: string;
  geoScope?: GeoScope;
  country?: string;
  primaryLanguage?: string;
  brandTerms?: string[];
  initialConfigPreset?: ProjectInitialConfigPreset;
  subSector?: string;
  modules: ModuleData[];
  createdAt: number;
  notes?: Note[];
  completedTasksLog?: CompletedTask[];
  customRoadmapOrder?: string[];
  aiRoadmap?: Task[];
  kanbanColumns?: KanbanColumn[];
  iaVisibility?: IAVisibilityState;
  templateVersion?: string;
  roadmapTemplateMode?: 'contextual' | 'generic';
  moduleWeights?: Partial<Record<number, number>>;
}

export interface NewClientInput {
  name: string;
  vertical: ClientVertical;
  sector?: string;
  subSector?: string;
  geoScope?: GeoScope;
  projectType?: ProjectType;
  analysisProjectTypes?: ProjectType[];
  country?: string;
  primaryLanguage?: string;
  brandTerms?: string[];
  initialConfigPreset?: ProjectInitialConfigPreset;
}

export interface GeminiResponse {
  text: string;
  error?: string;
}

export interface ChallengeResult {
  score: number;
  feedback: string;
  timeSpent: number;
}

// GSC Types
export interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

export interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCResponse {
  rows?: GSCRow[];
}

export type GSCSearchType = 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews';
export type GSCDimension = 'date' | 'query' | 'page' | 'country' | 'device' | 'searchAppearance';
export type GSCDimensionFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'includingRegex'
  | 'excludingRegex';

export interface GSCDimensionFilter {
  dimension: GSCDimension;
  operator: GSCDimensionFilterOperator;
  expression: string;
}

export interface GSCDimensionFilterGroup {
  groupType?: 'and' | 'or';
  filters: GSCDimensionFilter[];
}

export type GSCTruncatedReason =
  | 'max_pages_reached'
  | 'max_rows_reached'
  | 'safety_stop'
  | 'api_error';

export interface GSCExtractionMetadata {
  isPartial: boolean;
  pagesFetched: number;
  rowsFetched: number;
  truncatedReason?: GSCTruncatedReason;
}

export interface GSCPagedSearchAnalyticsResponse extends GSCResponse {
  metadata: GSCExtractionMetadata;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

// Global definition for Google Identity
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: any) => void;
          }) => any;
        };
      };
    };
  }
}
