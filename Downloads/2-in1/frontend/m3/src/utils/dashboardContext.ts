import { GeoScope, ProjectType } from '../types';
import { SeoInsight } from '../types/seoInsights';

export interface DashboardContextProfile {
  focusAreas: string[];
  opportunitiesHint: string;
  risksHint: string;
  quickWinsHint: string;
  nextActionHint: string;
  sectorExamples: string;
}

const BASE_PROFILE_BY_PROJECT_TYPE: Record<ProjectType, Omit<DashboardContextProfile, 'sectorExamples'>> = {
  MEDIA: {
    focusAreas: ['cobertura temática', 'CTR editorial', 'top consultas', 'clusters', 'discoverabilidad'],
    opportunitiesHint: 'Prioriza oportunidades editoriales por cluster y consultas en crecimiento.',
    risksHint: 'Vigila caídas de CTR en headlines/snippets y pérdida de cobertura en temas clave.',
    quickWinsHint: 'Ajusta snippets, enlazado interno editorial y refresh de piezas con tracción.',
    nextActionHint: 'Crea una tarea de mejora editorial conectando query, URL y cluster.',
  },
  ECOM: {
    focusAreas: ['categorías PLP/PDP', 'queries transaccionales', 'CTR comercial', 'no-brand', 'cobertura indexable'],
    opportunitiesHint: 'Prioriza categorías y fichas con intención comercial y alto volumen.',
    risksHint: 'Revisa pérdida de visibilidad no-brand y páginas comerciales con bajo CTR.',
    quickWinsHint: 'Optimiza PLPs/PDPs de alto potencial, titles y fragmentos enriquecidos.',
    nextActionHint: 'Convierte el insight en quick win comercial por intención y plantilla.',
  },
  LOCAL: {
    focusAreas: ['servicio + ciudad', 'branded local', 'consultas geolocalizadas', 'presencia local'],
    opportunitiesHint: 'Prioriza oportunidades en combinaciones servicio + ubicación.',
    risksHint: 'Detecta caídas en consultas locales y páginas de ubicación críticas.',
    quickWinsHint: 'Refuerza páginas locales, interlinking por zona y señales de reputación.',
    nextActionHint: 'Lanza acción enfocada en cobertura local para servicio y ciudad prioritaria.',
  },
  NATIONAL: {
    focusAreas: ['cobertura de servicios/categorías', 'no-brand', 'clusters de intención'],
    opportunitiesHint: 'Escala hubs por intención para capturar demanda nacional no-brand.',
    risksHint: 'Controla canibalización entre URLs y brechas de cobertura por intención.',
    quickWinsHint: 'Consolida hubs temáticos y enlazado entre páginas de intención similar.',
    nextActionHint: 'Prioriza la brecha de cobertura nacional con mayor impacto de negocio.',
  },
  INTERNATIONAL: {
    focusAreas: ['comparativa por property/country/lang', 'estabilidad multi-site', 'plantillas', 'escalabilidad'],
    opportunitiesHint: 'Prioriza mercados/idiomas con mayor gap de visibilidad recuperable.',
    risksHint: 'Vigila inestabilidad entre propiedades, idiomas y templates críticos.',
    quickWinsHint: 'Replica plantillas ganadoras y corrige desviaciones entre países.',
    nextActionHint: 'Coordina acción multi-mercado con traza de propiedad e idioma.',
  },
};

const GENERIC_SECTOR_EXAMPLES = 'Sector no configurado: aplica lectura genérica y valida la taxonomía del cliente.';

const SECTOR_CONTEXT_EXAMPLES: Array<{ match: string[]; example: string }> = [
  {
    match: ['salud', 'estetica', 'estética', 'clinica', 'clínica', 'belleza'],
    example: 'En salud/estética prioriza tratamientos, ciudades, reputación e intención clínica.',
  },
  {
    match: ['legal', 'abogado', 'juridico', 'jurídico'],
    example: 'En legal prioriza servicios, especialidad, ciudad y señales de confianza.',
  },
  {
    match: ['turismo', 'hotel', 'viaje'],
    example: 'En turismo prioriza destino, temática de viaje y estacionalidad de la demanda.',
  },
];

const normalize = (value?: string) => (value || '').trim().toLowerCase();

const resolveSectorExample = (sector?: string): string => {
  const normalized = normalize(sector);
  if (!normalized || normalized === 'otro' || normalized === 'generico' || normalized === 'genérico') {
    return GENERIC_SECTOR_EXAMPLES;
  }

  const match = SECTOR_CONTEXT_EXAMPLES.find((entry) => entry.match.some((term) => normalized.includes(term)));
  if (match) {
    return match.example;
  }

  return `Sector ${sector}: adapta la lectura con la terminología y conversión específica del cliente.`;
};

const projectTypeSignals: Record<ProjectType, string[]> = {
  MEDIA: ['media', 'editorial', 'discover', 'content', 'cluster', 'headline'],
  ECOM: ['ecom', 'categoria', 'category', 'plp', 'pdp', 'transaccional', 'commercial'],
  LOCAL: ['local', 'ciudad', 'ubicacion', 'near me', 'map', 'geo'],
  NATIONAL: ['national', 'nacional', 'hub', 'intencion', 'intent'],
  INTERNATIONAL: ['international', 'internacional', 'country', 'idioma', 'hreflang', 'lang', 'market'],
};

export const getDashboardContextProfile = (
  projectType: ProjectType,
  sector?: string,
): DashboardContextProfile => ({
  ...BASE_PROFILE_BY_PROJECT_TYPE[projectType],
  sectorExamples: resolveSectorExample(sector),
});

export const rankInsightsByProjectContext = (
  insights: SeoInsight[],
  projectType: ProjectType,
  analysisProjectTypes: ProjectType[],
  sector?: string,
): SeoInsight[] => {
  const normalizedSector = normalize(sector);

  return [...insights].sort((a, b) => {
    const scoreInsight = (insight: SeoInsight) => {
      let score = insight.score || 0;

      if (insight.projectType === projectType) {
        score += 80;
      }
      if (insight.applicableProjectTypes?.includes(projectType)) {
        score += 70;
      }

      const contextPool = [insight.title, insight.summary, insight.reason, insight.suggestedAction, insight.ruleKey]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchingSignals = projectTypeSignals[projectType].filter((signal) => contextPool.includes(signal)).length;
      score += matchingSignals * 10;

      if (normalizedSector && normalizedSector !== 'otro') {
        if ((insight.sector || '').toLowerCase().includes(normalizedSector)) {
          score += 35;
        }
        if (contextPool.includes(normalizedSector)) {
          score += 20;
        }
      }

      const crossTypeMatch = analysisProjectTypes.some(
        (analysisType) => analysisType !== projectType && insight.applicableProjectTypes?.includes(analysisType),
      );

      if (crossTypeMatch) {
        score += 12;
      }

      return score;
    };

    return scoreInsight(b) - scoreInsight(a);
  });
};

export const formatProjectContextLabel = (projectType: ProjectType, sector: string, geoScope: GeoScope): string =>
  `${projectType} · ${sector} · ${geoScope}`;
