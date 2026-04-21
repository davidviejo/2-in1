import { ClientVertical, GeoScope, ProjectType } from '../types';

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
    const normalized = projectType.trim().toUpperCase();
    if (VALID_PROJECT_TYPES.includes(normalized as ProjectType)) {
      return normalized as ProjectType;
    }
  }

  return getProjectTypeFromVertical(vertical || 'media');
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
