export enum NewsPriority {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  DISCARD = 'DISCARD',
}

export enum ClusterCategory {
  TURISMO = 'Turismo',
  EMPRESA = 'Empresa',
  INNOVACION = 'Innovación',
  EVENTOS = 'Eventos',
  MOVILIDAD = 'Movilidad',
  ECONOMIA = 'Economía',
  OTROS = 'Otros',
}

export interface AppSettings {
  searchQueries: string[];
  targetSources: string[];
}

export interface TrendItem {
  keyword: string;
  volume: number;
  growth: string;
  status: 'breakout' | 'rising' | 'stable';
}

export interface DashboardStats {
  sourcesScanned: number;
  itemsFound: number;
  highPriority: number;
  duplicatesRemoved: number;
}

export interface ScoreBreakdown {
  recency: number;
  coverage: number;
  authority: number;
  visual: number;
  position: number;
  total: number;
}

export interface NewsArticle {
  article_id: string;
  title: string;
  url: string;
  source_name: string;
  published_at: string;
  thumbnail_url?: string;
  position: number;
  keyword: string;
  snippet?: string;
}

export interface NewsCluster {
  cluster_id: string;
  title: string;
  articles: NewsArticle[];
  coverage_count: number;
  latest_published_at: string;
  top_source: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  ai_analysis?: {
    suggestedTitle: string;
    summary: string;
    priority: NewsPriority;
    category: ClusterCategory;
    reasoning: string;
  };
}
