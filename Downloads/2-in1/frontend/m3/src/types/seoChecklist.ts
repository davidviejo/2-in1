export type ChecklistStatus = 'SI' | 'SI_IA' | 'NO' | 'PARCIAL' | 'ERROR_CLARO_IA' | 'NA';
export type ChecklistPointType = 'MANUAL' | 'AUTO' | 'MIXED';

export const CHECKLIST_STATUS_OPTIONS: ChecklistStatus[] = [
  'SI',
  'SI_IA',
  'NO',
  'PARCIAL',
  'ERROR_CLARO_IA',
  'NA',
];

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  SI: 'Si',
  SI_IA: 'Si (IA)',
  NO: 'No',
  PARCIAL: 'Parcial',
  ERROR_CLARO_IA: 'Error claro (IA)',
  NA: 'N/A',
};

const LEGACY_CHECKLIST_STATUS_ALIASES: Record<string, ChecklistStatus> = {
  SI: 'SI',
  'SI (IA)': 'SI_IA',
  SI_IA: 'SI_IA',
  NO: 'NO',
  PARCIAL: 'PARCIAL',
  'ERROR CLARO (IA)': 'ERROR_CLARO_IA',
  'ERROR_CLARO (IA)': 'ERROR_CLARO_IA',
  ERROR_CLARO_IA: 'ERROR_CLARO_IA',
  NA: 'NA',
  'N/A': 'NA',
};

export const normalizeChecklistStatus = (value?: string): ChecklistStatus => {
  if (!value) return 'NA';
  return LEGACY_CHECKLIST_STATUS_ALIASES[value.toUpperCase()] || 'NA';
};

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  status_manual: ChecklistStatus;
  notes_manual: string;
  evaluationMeta?: {
    evaluatedBy: string;
    provider?: string;
    model?: string;
    evaluatedAt: number;
    reason: string;
  };
  autoData?: any; // JSON Object
  recommendation?: string;
  suggested_status?: ChecklistStatus;
}

export type ChecklistKey =
  | 'CLUSTER'
  | 'GEOLOCALIZACION'
  | 'DATOS_ESTRUCTURADOS'
  | 'CONTENIDOS'
  | 'SNIPPETS'
  | 'IMAGENES'
  | 'ENLAZADO_INTERNO'
  | 'ESTRUCTURA'
  | 'UX'
  | 'WPO'
  | 'ENLACE'
  | 'OPORTUNIDADES'
  | 'SEMANTICA'
  | 'GEO_IMAGENES'
  | 'CTA';

export interface SeoPageGscMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position?: number;
  queryCount?: number;
  source?: 'page' | 'query';
  updatedAt?: number;
}

export interface SeoPage {
  id: string;
  url: string;
  kwPrincipal: string;
  originalKwPrincipal?: string;
  isBrandKeyword?: boolean;
  pageType: string;
  geoTarget?: string;
  cluster?: string;
  gscMetrics?: SeoPageGscMetrics;
  checklist: Record<ChecklistKey, ChecklistItem>;
  lastAnalyzedAt?: number;
  competitors?: string[];
  advancedBlockedReason?: string;
  engineMeta?: {
    requestedProvider: string;
    usedProvider: string;
    fallbackChain: string[];
    providerFailureReasons?: Record<string, string>;
  };
}

export interface Capabilities {
  serpProviders: Record<string, boolean>;
  costModel: Record<string, { estimatedCostPerQuery: number }>;
  limits: {
    maxKeywordsPerUrl: number;
    maxCompetitorsPerKeyword: number;
    maxUrlsPerBatch?: number;
  };
}

export interface SeoChecklistSettings {
  brandTerms?: string[];
  allowKwPrincipalUpdate?: boolean;
  serp: {
    enabled: boolean;
    provider: 'serpapi' | 'dataforseo' | 'internal';
    maxKeywordsPerUrl: number;
    maxCompetitorsPerKeyword: number;
    dataforseoLogin?: string;
    dataforseoPassword?: string;
    useGlobalDataforseo?: boolean;
    dataforseoDetail?: 'regular' | 'advanced';
    dataforseoExecutionMode?: 'live' | 'standard' | 'priority';
  };
  budgets: {
    maxUrlsPerBatch: number;
    dailyBudget: number;
    maxEstimatedCostPerBatch: number;
  };
  competitorsMode: 'autoFromSerp' | 'off';
}

export interface AnalysisConfigPayload {
  mode: 'basic' | 'advanced';
  serp: SeoChecklistSettings['serp'] & { confirmed: boolean };
  budgets: {
    maxEstimatedCostPerBatch: number;
    dailyBudget: number;
  };
}

export interface ChecklistPointDef {
  key: ChecklistKey;
  label: string;
  type: ChecklistPointType;
  learning: string;
}

export const CHECKLIST_POINTS: ChecklistPointDef[] = [
  {
    key: 'CLUSTER',
    label: '1. Cluster',
    type: 'MANUAL',
    learning:
      'El cluster define la agrupación temática a la que pertenece la URL. Verifica que la página esté correctamente categorizada dentro de la arquitectura del sitio para potenciar la autoridad temática.',
  },
  {
    key: 'GEOLOCALIZACION',
    label: '2. Geolocalización',
    type: 'AUTO',
    learning:
      'Revisión de etiquetas hreflang y configuración regional para asegurar que el contenido se muestra al público objetivo correcto.',
  },
  {
    key: 'DATOS_ESTRUCTURADOS',
    label: '3. Datos estructurados',
    type: 'AUTO',
    learning:
      'Validación de Schema.org para mejorar la comprensión del contenido por parte de los motores de búsqueda y potenciar los fragmentos enriquecidos.',
  },
  {
    key: 'CONTENIDOS',
    label: '4. Contenidos',
    type: 'MANUAL',
    learning:
      'Análisis de la calidad, originalidad y relevancia del contenido. Debe satisfacer la intención de búsqueda del usuario.',
  },
  {
    key: 'SNIPPETS',
    label: '5. Snippets',
    type: 'MIXED',
    learning:
      'Optimización de Title y Meta Description para mejorar el CTR en los resultados de búsqueda.',
  },
  {
    key: 'IMAGENES',
    label: '6. Imágenes',
    type: 'AUTO',
    learning:
      'Verificación de atributos ALT, tamaño de archivo y formatos modernos (WebP) para mejorar la accesibilidad y velocidad.',
  },
  {
    key: 'ENLAZADO_INTERNO',
    label: '7. Enlazado interno',
    type: 'MIXED',
    learning:
      'Evaluación de la estructura de enlaces internos para distribuir el Link Juice y facilitar la navegación del usuario y los crawlers.',
  },
  {
    key: 'ESTRUCTURA',
    label: '8. Estructura',
    type: 'MANUAL',
    learning:
      'Revisión de la jerarquía de encabezados (H1, H2, H3...) para asegurar una lectura lógica y semántica.',
  },
  {
    key: 'UX',
    label: '9. UX',
    type: 'MANUAL',
    learning:
      'Experiencia de usuario: facilidad de uso, legibilidad y ausencia de elementos intrusivos.',
  },
  {
    key: 'WPO',
    label: '10. WPO',
    type: 'AUTO',
    learning:
      'Web Performance Optimization: Tiempos de carga y Core Web Vitals (LCP, FID/INP, CLS).',
  },
  {
    key: 'ENLACE',
    label: '11. Enlace',
    type: 'MANUAL',
    learning: 'Análisis del perfil de enlaces externos (backlinks) que apuntan a esta URL.',
  },
  {
    key: 'OPORTUNIDADES',
    label: '12. Oportunidades VS KWs Objetivo',
    type: 'MANUAL',
    learning:
      'Identificación de keywords secundarias o variaciones semánticas que se pueden atacar para ganar más tráfico.',
  },
  {
    key: 'SEMANTICA',
    label: '13. Semántica',
    type: 'MANUAL',
    learning:
      'Uso de vocabulario relacionado y entidades para enriquecer el contexto del contenido.',
  },
  {
    key: 'GEO_IMAGENES',
    label: '14. Geolocalización de imágenes',
    type: 'AUTO',
    learning: 'Verificación de metadatos de ubicación en imágenes si es relevante para SEO local.',
  },
  {
    key: 'CTA',
    label: '15. Llamada a la acción',
    type: 'MANUAL',
    learning:
      'Presencia y efectividad de los Call to Action para convertir el tráfico en objetivos.',
  },
];
