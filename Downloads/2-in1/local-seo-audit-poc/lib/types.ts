export type AuditInput = {
  businessName: string;
  website?: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  location: string;
  radiusKm?: number;
  category?: string;
  sector?: string;
};

export type Listing = {
  sourceId: string;
  businessName: string;
  primaryCategory: string;
  secondaryCategories: string[];
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  workHours: string;
  attributes: string[];
  lat: number;
  lng: number;
  source: "dataforseo_v3" | "google_places_new";
};

export type CompetitorClass = "directo" | "parcial" | "irrelevante";

export type ScoringBlock = {
  key: string;
  label: string;
  score: number;
  benchmark: number;
  gap: number;
};

export type ActionPlanItem = {
  action: string;
  impact: "alto" | "medio" | "bajo";
  difficulty: "alta" | "media" | "baja";
  priority: "P1" | "P2" | "P3";
  confidence: number;
  evidence: string;
};

export type AuditOutput = {
  summary: {
    status: string;
    topProblems: string[];
    topOpportunities: string[];
    globalPriority: string;
  };
  competitors: Array<{
    listing: Listing;
    classification: CompetitorClass;
    rationale: string;
  }>;
  scoring: ScoringBlock[];
  findings: {
    observedFacts: string[];
    calculatedComparisons: string[];
    reasonedInferences: string[];
  };
  actionPlan: {
    quickWins: ActionPlanItem[];
    midTerm: ActionPlanItem[];
    strategic: ActionPlanItem[];
  };
  technicalReport: string;
  commercialReport: string;
};
