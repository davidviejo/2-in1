import { SeoInsightCategory } from '../types/seoInsights';

export const INSIGHT_CATEGORY_META: Record<
  SeoInsightCategory,
  { label: string; description: string }
> = {
  opportunity: { label: 'Oportunidad', description: 'Dónde reforzar para crecer.' },
  risk: { label: 'Fallo / Riesgo', description: 'Dónde puede existir deterioro o conflicto.' },
  performance: { label: 'Rendimiento', description: 'Cómo está respondiendo la captación.' },
  coverage: { label: 'Cobertura', description: 'Señales técnicas o de indexabilidad.' },
  content: { label: 'Contenido', description: 'Dónde ampliar o ajustar el contenido.' },
  linking: { label: 'Enlazado', description: 'Relaciones internas y soporte contextual.' },
  ctr: { label: 'CTR', description: 'Discrepancias entre impresiones, posición y clics.' },
  position: { label: 'Posición', description: 'Visibilidad y proximidad a mejoras de ranking.' },
};

export const SEO_INSIGHT_THRESHOLDS = {
  quickWins: { positionMin: 4, positionMax: 10, minImpressions: 120, targetCtr: 0.1 },
  strikingDistance: { positionMin: 11, positionMax: 20, minImpressions: 120, targetCtr: 0.05 },
  lowCtr: { maxPosition: 8, minImpressions: 150, maxCtr: 0.02, targetCtr: 0.04 },
  zeroClicks: { minImpressions: 250 },
  featuredSnippets: {
    positionMin: 2,
    positionMax: 8,
    minImpressions: 80,
    questionPrefixes: ['qué', 'que', 'cómo', 'como', 'cuándo', 'cuando', 'dónde', 'donde', 'por qué', 'quién', 'cual', 'cuál'],
  },
  stagnantTraffic: {
    minImpressions: 350,
    positionMin: 5,
    positionMax: 20,
    maxCtr: 0.03,
    maxRelativeDelta: 0.15,
    maxPositionDelta: 1.5,
  },
  decline: { minImpressions: 150, minRelativeClickDrop: 0.25, minPositionLoss: 1 },
  improvement: { minImpressions: 150, minRelativeClickGrowth: 0.2, minPositionGain: 1 },
  cannibalization: { minImpressionsPerUrl: 80, maxPositionGap: 4 },
  internalRedirects: { minPageImpressions: 120 },
  contentExpansion: { minImpressions: 300, minQueries: 3, positionMin: 6, positionMax: 18 },
};

export const SEO_INSIGHT_PRIORITY_WEIGHTS = {
  businessValue: 0.25,
  impact: 0.3,
  urgency: 0.2,
  confidence: 0.15,
  implementationEase: 0.1,
};

export const SEO_INSIGHT_CATALOG: Record<string, { icon: string; tone: string }> = {
  quickWins: { icon: 'Zap', tone: 'amber' },
  strikingDistance: { icon: 'Target', tone: 'emerald' },
  lowCtr: { icon: 'MousePointerClick', tone: 'rose' },
  zeroClicks: { icon: 'EyeOff', tone: 'slate' },
  featuredSnippets: { icon: 'Sparkles', tone: 'purple' },
  stagnantTraffic: { icon: 'BarChart2', tone: 'orange' },
  decliningPages: { icon: 'AlertTriangle', tone: 'red' },
  improvingPages: { icon: 'TrendingUp', tone: 'green' },
  cannibalization: { icon: 'Split', tone: 'violet' },
  internalRedirects: { icon: 'Repeat', tone: 'red' },
  contentExpansion: { icon: 'FileText', tone: 'blue' },
};
