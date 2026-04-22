import {
  ClientVertical,
  GeoScope,
  ProjectInitialConfigPreset,
  ProjectScoreWeights,
  ProjectType,
} from '../types';
import { buildContextualRoadmap } from '@/config/projectContextualRoadmap';

export const PROJECT_TYPE_BY_VERTICAL: Record<ClientVertical, ProjectType> = {
  media: 'MEDIA',
  ecom: 'ECOM',
  local: 'LOCAL',
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
};

export const VERTICAL_BY_PROJECT_TYPE: Record<ProjectType, ClientVertical> = {
  MEDIA: 'media',
  ECOM: 'ecom',
  LOCAL: 'local',
  NATIONAL: 'national',
  INTERNATIONAL: 'international',
};

export const DEFAULT_SECTOR_OPTIONS = [
  'Salud',
  'Legal',
  'Turismo',
  'Restauración',
  'Inmobiliaria',
  'Educación',
  'SaaS / Tecnología',
  'Marketing / Agencia',
  'Ecommerce Generalista',
  'Belleza / Estética',
  'Automoción',
  'Finanzas',
  'Industrial',
  'Medios / Editorial',
  'Otro',
] as const;

const VALID_PROJECT_TYPES: ProjectType[] = ['MEDIA', 'ECOM', 'LOCAL', 'NATIONAL', 'INTERNATIONAL'];
const VALID_GEO_SCOPES: GeoScope[] = ['local', 'national', 'international', 'global'];
const PROJECT_TYPE_ALIASES: Record<string, ProjectType> = {
  media: 'MEDIA',
  ecom: 'ECOM',
  ecommerce: 'ECOM',
  local: 'LOCAL',
  national: 'NATIONAL',
  internacional: 'INTERNATIONAL',
  international: 'INTERNATIONAL',
  global: 'INTERNATIONAL',
};

export const getProjectTypeFromVertical = (vertical: ClientVertical): ProjectType =>
  PROJECT_TYPE_BY_VERTICAL[vertical] || 'MEDIA';

export const getVerticalFromProjectType = (projectType: ProjectType): ClientVertical =>
  VERTICAL_BY_PROJECT_TYPE[projectType] || 'media';

export const inferGeoScopeFromProjectType = (projectType: ProjectType): GeoScope => {
  if (projectType === 'LOCAL') return 'local';
  if (projectType === 'NATIONAL') return 'national';
  if (projectType === 'INTERNATIONAL') return 'international';
  return 'global';
};

export const normalizeProjectType = (projectType: unknown, vertical?: ClientVertical): ProjectType => {
  if (typeof projectType === 'string') {
    const raw = projectType.trim();
    const normalized = raw.toUpperCase();
    if (VALID_PROJECT_TYPES.includes(normalized as ProjectType)) {
      return normalized as ProjectType;
    }

    const aliasMatch = PROJECT_TYPE_ALIASES[raw.toLowerCase()];
    if (aliasMatch) {
      return aliasMatch;
    }
  }

  return getProjectTypeFromVertical(vertical || 'media');
};

export const normalizeAnalysisProjectTypes = (
  value: unknown,
  fallbackProjectType: ProjectType,
): ProjectType[] => {
  if (!Array.isArray(value)) {
    return [fallbackProjectType];
  }

  const normalized = value
    .map((item) => normalizeProjectType(item, getVerticalFromProjectType(fallbackProjectType)))
    .filter((projectType, index, array) => array.indexOf(projectType) === index);

  if (normalized.length === 0) {
    return [fallbackProjectType];
  }

  return normalized.includes(fallbackProjectType)
    ? normalized
    : [fallbackProjectType, ...normalized];
};

export const normalizeGeoScope = (geoScope: unknown, projectType: ProjectType): GeoScope => {
  if (typeof geoScope === 'string') {
    const normalized = geoScope.trim().toLowerCase();
    if (VALID_GEO_SCOPES.includes(normalized as GeoScope)) {
      return normalized as GeoScope;
    }
  }

  return inferGeoScopeFromProjectType(projectType);
};

export const normalizeSector = (sector: unknown): string => {
  if (typeof sector !== 'string') {
    return 'Otro';
  }

  const normalized = sector.trim();
  return normalized.length > 0 ? normalized : 'Otro';
};

export const normalizeSubSector = (subSector: unknown): string | undefined => {
  if (typeof subSector !== 'string') {
    return undefined;
  }

  const normalized = subSector.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const getProjectTypeLabel = (projectType: ProjectType): string => projectType;

const DEFAULT_SCORE_WEIGHTS: ProjectScoreWeights = {
  visibility: 25,
  technical: 20,
  content: 20,
  authority: 20,
  conversion: 15,
};

const PROJECT_PRESET_BY_TYPE: Record<ProjectType, Omit<ProjectInitialConfigPreset, 'useGenericConfig'>> = {
  MEDIA: {
    suggestedModuleIds: [1, 2, 4, 7, 9],
    priorities: ['traffic', 'authority', 'growth'],
    insightRules: ['brand-protection', 'content-gap', 'seasonality-watch'],
    scoreWeights: {
      visibility: 30,
      technical: 20,
      content: 30,
      authority: 15,
      conversion: 5,
    },
  },
  ECOM: {
    suggestedModuleIds: [1, 2, 3, 6, 8],
    priorities: ['conversions', 'growth', 'traffic'],
    insightRules: ['category-opportunity', 'brand-protection', 'content-gap'],
    scoreWeights: {
      visibility: 20,
      technical: 15,
      content: 20,
      authority: 15,
      conversion: 30,
    },
  },
  LOCAL: {
    suggestedModuleIds: [1, 3, 5, 7, 8],
    priorities: ['local-presence', 'conversions', 'traffic'],
    insightRules: ['local-pack', 'brand-protection', 'content-gap'],
    scoreWeights: {
      visibility: 20,
      technical: 20,
      content: 20,
      authority: 10,
      conversion: 30,
    },
  },
  NATIONAL: {
    suggestedModuleIds: [1, 2, 3, 4, 8],
    priorities: ['growth', 'traffic', 'conversions'],
    insightRules: ['brand-protection', 'content-gap', 'category-opportunity'],
    scoreWeights: {
      visibility: 25,
      technical: 20,
      content: 20,
      authority: 15,
      conversion: 20,
    },
  },
  INTERNATIONAL: {
    suggestedModuleIds: [1, 2, 4, 6, 9],
    priorities: ['growth', 'authority', 'traffic'],
    insightRules: ['international-expansion', 'brand-protection', 'content-gap'],
    scoreWeights: {
      visibility: 25,
      technical: 20,
      content: 20,
      authority: 25,
      conversion: 10,
    },
  },
};

export const DEFAULT_COUNTRY_OPTIONS = [
  'España',
  'México',
  'Argentina',
  'Colombia',
  'Chile',
  'Estados Unidos',
  'Global',
] as const;

export const DEFAULT_LANGUAGE_OPTIONS = ['es', 'en', 'pt', 'fr', 'de', 'it'] as const;

export const normalizeCountry = (country: unknown, geoScope: GeoScope): string => {
  if (typeof country !== 'string') {
    return geoScope === 'global' || geoScope === 'international' ? 'Global' : 'España';
  }
  const normalized = country.trim();
  if (!normalized) {
    return geoScope === 'global' || geoScope === 'international' ? 'Global' : 'España';
  }
  return normalized;
};

export const normalizePrimaryLanguage = (primaryLanguage: unknown): string => {
  if (typeof primaryLanguage !== 'string') {
    return 'es';
  }
  const normalized = primaryLanguage.trim().toLowerCase();
  return normalized || 'es';
};

export const normalizeBrandTerms = (brandTerms: unknown): string[] => {
  if (!Array.isArray(brandTerms)) {
    return [];
  }

  const cleaned = brandTerms
    .filter((term): term is string => typeof term === 'string')
    .map((term) => term.trim())
    .filter((term) => term.length > 0);

  return Array.from(new Set(cleaned));
};

export const getDefaultInitialConfigPreset = (
  projectType: ProjectType,
  sector?: string,
): ProjectInitialConfigPreset => {
  const contextual = buildContextualRoadmap({ projectType, sector });
  const base = PROJECT_PRESET_BY_TYPE[projectType];
  return {
    ...base,
    suggestedModuleIds:
      contextual.suggestedModuleIds.length > 0 ? contextual.suggestedModuleIds : base.suggestedModuleIds,
    scoreWeights:
      Object.keys(contextual.moduleWeights).length > 0
        ? {
            visibility: contextual.moduleWeights[2] || base.scoreWeights.visibility,
            technical: contextual.moduleWeights[1] || base.scoreWeights.technical,
            content: contextual.moduleWeights[3] || base.scoreWeights.content,
            authority: contextual.moduleWeights[5] || base.scoreWeights.authority,
            conversion: contextual.moduleWeights[8] || base.scoreWeights.conversion,
          }
        : base.scoreWeights,
    useGenericConfig: false,
  };
};

export const getGenericInitialConfigPreset = (): ProjectInitialConfigPreset => ({
  suggestedModuleIds: [1, 2, 3, 4, 5],
  priorities: ['growth', 'traffic'],
  insightRules: ['brand-protection', 'content-gap'],
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
  useGenericConfig: true,
});

export const normalizeInitialConfigPreset = (
  preset: unknown,
  projectType: ProjectType,
): ProjectInitialConfigPreset => {
  if (!preset || typeof preset !== 'object') {
    return getDefaultInitialConfigPreset(projectType);
  }

  const raw = preset as Partial<ProjectInitialConfigPreset>;
  const base = raw.useGenericConfig ? getGenericInitialConfigPreset() : getDefaultInitialConfigPreset(projectType);

  return {
    useGenericConfig: Boolean(raw.useGenericConfig),
    suggestedModuleIds:
      Array.isArray(raw.suggestedModuleIds) && raw.suggestedModuleIds.length > 0
        ? raw.suggestedModuleIds.filter((id): id is number => typeof id === 'number')
        : base.suggestedModuleIds,
    priorities:
      Array.isArray(raw.priorities) && raw.priorities.length > 0
        ? raw.priorities.filter((priority): priority is ProjectInitialConfigPreset['priorities'][number] =>
            ['growth', 'traffic', 'conversions', 'authority', 'local-presence'].includes(priority),
          )
        : base.priorities,
    insightRules:
      Array.isArray(raw.insightRules) && raw.insightRules.length > 0
        ? raw.insightRules.filter((rule): rule is ProjectInitialConfigPreset['insightRules'][number] =>
            [
              'brand-protection',
              'content-gap',
              'category-opportunity',
              'local-pack',
              'seasonality-watch',
              'international-expansion',
            ].includes(rule),
          )
        : base.insightRules,
    scoreWeights: {
      visibility: raw.scoreWeights?.visibility ?? base.scoreWeights.visibility,
      technical: raw.scoreWeights?.technical ?? base.scoreWeights.technical,
      content: raw.scoreWeights?.content ?? base.scoreWeights.content,
      authority: raw.scoreWeights?.authority ?? base.scoreWeights.authority,
      conversion: raw.scoreWeights?.conversion ?? base.scoreWeights.conversion,
    },
  };
};
