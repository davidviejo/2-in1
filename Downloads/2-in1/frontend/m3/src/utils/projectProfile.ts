import {
  Client,
  ClientVertical,
  ProjectGeoScope,
  ProjectInitialConfiguration,
  ProjectType,
} from '../types';

export interface ClientCreationOptions {
  sector?: string;
  geoScope?: ProjectGeoScope;
  primaryCountry?: string;
  primaryLanguage?: string;
  brandTerms?: string[];
  useGenericConfiguration?: boolean;
}

interface ProjectPreset extends Omit<ProjectInitialConfiguration, 'useGeneric'> {}

const PROJECT_TYPE_TO_VERTICAL: Record<ProjectType, ClientVertical> = {
  MEDIA: 'media',
  ECOM: 'ecom',
  LOCAL: 'local',
  NATIONAL: 'national',
  INTERNATIONAL: 'international',
};

const VERTICAL_TO_PROJECT_TYPE: Record<ClientVertical, ProjectType> = {
  media: 'MEDIA',
  ecom: 'ECOM',
  local: 'LOCAL',
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
};

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  MEDIA: 'Media',
  ECOM: 'Ecom',
  LOCAL: 'Local',
  NATIONAL: 'National',
  INTERNATIONAL: 'International',
};

const GEO_SCOPE_LABELS: Record<ProjectGeoScope, string> = {
  local: 'Local',
  national: 'Nacional',
  international: 'Internacional',
  generic: 'Genérico',
};

const GEO_SCOPE_BY_TYPE: Record<ProjectType, ProjectGeoScope> = {
  MEDIA: 'national',
  ECOM: 'national',
  LOCAL: 'local',
  NATIONAL: 'national',
  INTERNATIONAL: 'international',
};

const PROJECT_PRESETS: Record<ProjectType | 'GENERIC', ProjectPreset> = {
  GENERIC: {
    presetKey: 'GENERIC',
    suggestedModules: ['Dashboard Ejecutivo', 'Quick Wins', 'Roadmap Base'],
    priorities: ['Validación técnica', 'Alineación de contenidos'],
    activeInsightRules: ['caidas_trafico', 'oportunidades_sin_clicks'],
    scoreWeights: { technical: 30, content: 30, authority: 20, conversion: 20 },
  },
  MEDIA: {
    presetKey: 'MEDIA',
    suggestedModules: ['Cobertura temática', 'Clusters editoriales', 'Breaking news'],
    priorities: ['Frescura de contenidos', 'Autoridad topical', 'CTR en Discover'],
    activeInsightRules: ['canibalizacion_query', 'caida_discover', 'brecha_serp_snippets'],
    scoreWeights: { visibility: 35, freshness: 25, authority: 20, technical: 20 },
  },
  ECOM: {
    presetKey: 'ECOM',
    suggestedModules: ['Categorías', 'Fichas de producto', 'SEO transaccional'],
    priorities: ['Arquitectura ecommerce', 'Indexación de catálogo', 'Margen por URL'],
    activeInsightRules: ['paginas_sin_stock_rankeadas', 'queries_transaccionales_sin_url', 'caida_categorias'],
    scoreWeights: { conversion: 35, technical: 25, content: 20, visibility: 20 },
  },
  LOCAL: {
    presetKey: 'LOCAL',
    suggestedModules: ['Google Business Profile', 'Landings locales', 'Reseñas'],
    priorities: ['Visibilidad por ciudad', 'Reputación', 'Cobertura NAP'],
    activeInsightRules: ['consultas_geolocalizadas', 'fichas_sin_resenas', 'paginas_locales_sin_ctr'],
    scoreWeights: { localVisibility: 40, reputation: 20, content: 20, technical: 20 },
  },
  NATIONAL: {
    presetKey: 'NATIONAL',
    suggestedModules: ['SEO corporativo', 'Arquitectura por servicio', 'Roadmap de autoridad'],
    priorities: ['Cobertura país', 'Competencia orgánica', 'Consolidación de marca'],
    activeInsightRules: ['queries_brand_vs_nonbrand', 'brechas_categoria', 'caida_paginas_pilar'],
    scoreWeights: { visibility: 30, authority: 30, technical: 20, content: 20 },
  },
  INTERNATIONAL: {
    presetKey: 'INTERNATIONAL',
    suggestedModules: ['Hreflang', 'Mercados', 'Localización de contenido'],
    priorities: ['Cobertura multi-país', 'Canibalización internacional', 'Escalado de templates'],
    activeInsightRules: ['hreflang_inconsistente', 'mercado_sin_contenido', 'caida_por_pais'],
    scoreWeights: { international: 35, technical: 25, content: 20, authority: 20 },
  },
};

const cleanText = (value: string | undefined, fallback = ''): string => {
  if (!value) return fallback;
  const normalized = value.trim();
  return normalized || fallback;
};

export const toProjectType = (vertical: ClientVertical): ProjectType => VERTICAL_TO_PROJECT_TYPE[vertical];

export const toClientVertical = (projectType: ProjectType): ClientVertical =>
  PROJECT_TYPE_TO_VERTICAL[projectType];

export const getProjectTypeLabel = (projectType: ProjectType): string => PROJECT_TYPE_LABELS[projectType];

export const getGeoScopeLabel = (geoScope?: ProjectGeoScope): string => {
  if (!geoScope) return GEO_SCOPE_LABELS.generic;
  return GEO_SCOPE_LABELS[geoScope] || GEO_SCOPE_LABELS.generic;
};

export const getProjectPreset = (
  projectType: ProjectType,
  options?: { useGeneric?: boolean },
): ProjectInitialConfiguration => {
  const useGeneric = Boolean(options?.useGeneric);
  const selected = useGeneric ? PROJECT_PRESETS.GENERIC : PROJECT_PRESETS[projectType];
  return {
    ...selected,
    scoreWeights: { ...selected.scoreWeights },
    useGeneric,
  };
};

export const getDefaultCreationOptions = (projectType: ProjectType): ClientCreationOptions => ({
  sector: 'Genérico',
  geoScope: GEO_SCOPE_BY_TYPE[projectType],
  primaryCountry: projectType === 'INTERNATIONAL' ? 'US' : 'ES',
  primaryLanguage: 'es',
  brandTerms: [],
});

export const normalizeClientProfile = (client: Client): Client => {
  const projectType = client.projectType || toProjectType(client.vertical);
  const defaultOptions = getDefaultCreationOptions(projectType);
  const safeBrandTerms = Array.isArray(client.brandTerms)
    ? client.brandTerms
        .map((term) => (typeof term === 'string' ? term.trim() : ''))
        .filter((term) => Boolean(term))
    : defaultOptions.brandTerms || [];

  return {
    ...client,
    vertical: client.vertical || toClientVertical(projectType),
    projectType,
    sector: cleanText(client.sector, defaultOptions.sector),
    geoScope: client.geoScope || defaultOptions.geoScope,
    primaryCountry: cleanText(client.primaryCountry, defaultOptions.primaryCountry),
    primaryLanguage: cleanText(client.primaryLanguage, defaultOptions.primaryLanguage),
    brandTerms: [...safeBrandTerms],
    initialConfiguration: client.initialConfiguration || getProjectPreset(projectType),
    profileUpdatedAt: typeof client.profileUpdatedAt === 'number' ? client.profileUpdatedAt : client.createdAt,
  };
};

export const buildClientProfileFromCreation = (
  client: Client,
  options?: ClientCreationOptions,
): Client => {
  const normalized = normalizeClientProfile({
    ...client,
    ...options,
  });

  return {
    ...normalized,
    initialConfiguration: getProjectPreset(normalized.projectType || toProjectType(normalized.vertical), {
      useGeneric: options?.useGenericConfiguration,
    }),
    profileUpdatedAt: Date.now(),
  };
};
