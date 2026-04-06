import { ChecklistKey, ChecklistStatus, SeoPage } from '../types/seoChecklist';
import { PendingCheckDescriptor } from './seoChecklistAiValidation';

export type HeuristicDecision = 'si_ia' | 'error_claro_ia' | 'no_decidir';

export interface HeuristicResult {
  decision: HeuristicDecision;
  reason: string;
  evidence: string[];
}

export interface HeuristicCheckResolution {
  key: ChecklistKey;
  status: ChecklistStatus;
  notes: string;
  reason: string;
  evidence: string[];
}

export interface ChecklistHeuristicsRun {
  resolvedByHeuristics: HeuristicCheckResolution[];
  pendingForAI: PendingCheckDescriptor[];
}

const asRecord = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, any>;
};

const firstNumber = (record: Record<string, any>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const firstString = (record: Record<string, any>, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

export const evaluateSnippetsHeuristic = (check: PendingCheckDescriptor): HeuristicResult => {
  const autoData = asRecord(check.autoData);
  const title = firstString(autoData, ['title', 'metaTitle', 'seoTitle']);
  const description = firstString(autoData, ['metaDescription', 'description', 'seoDescription']);

  if (!title || !description) {
    return {
      decision: 'error_claro_ia',
      reason: 'Falta title o meta description en los datos automáticos.',
      evidence: [`title:${title ? 'ok' : 'missing'}`, `metaDescription:${description ? 'ok' : 'missing'}`],
    };
  }

  const titleLength = title.length;
  const descriptionLength = description.length;
  const titleOk = titleLength >= 30 && titleLength <= 65;
  const descriptionOk = descriptionLength >= 70 && descriptionLength <= 180;

  if (titleOk && descriptionOk) {
    return {
      decision: 'si_ia',
      reason: 'Title y meta description tienen longitudes recomendadas.',
      evidence: [`title_length:${titleLength}`, `meta_description_length:${descriptionLength}`],
    };
  }

  return {
    decision: 'no_decidir',
    reason: 'Existen snippets, pero están fuera de rango recomendado.',
    evidence: [`title_length:${titleLength}`, `meta_description_length:${descriptionLength}`],
  };
};

export const evaluateImagenesHeuristic = (check: PendingCheckDescriptor): HeuristicResult => {
  const autoData = asRecord(check.autoData);
  const imagesCount = firstNumber(autoData, ['imagesChecked', 'imagesCount', 'totalImages']);
  const missingAlt = firstNumber(autoData, ['missingAlt', 'imagesWithoutAlt', 'withoutAlt']);
  const oversizedImages = firstNumber(autoData, ['oversizedImages', 'unoptimizedImages']);

  if (typeof imagesCount !== 'number') {
    return {
      decision: 'no_decidir',
      reason: 'No hay volumen de imágenes suficiente para decidir automáticamente.',
      evidence: ['imagesCount:unknown'],
    };
  }

  if (imagesCount > 0 && ((missingAlt || 0) > 0 || (oversizedImages || 0) > 0)) {
    return {
      decision: 'error_claro_ia',
      reason: 'Se detectaron imágenes con alt ausente o sin optimización.',
      evidence: [
        `imagesCount:${imagesCount}`,
        `missingAlt:${missingAlt || 0}`,
        `oversizedImages:${oversizedImages || 0}`,
      ],
    };
  }

  if (imagesCount > 0 && (missingAlt || 0) === 0 && (oversizedImages || 0) === 0) {
    return {
      decision: 'si_ia',
      reason: 'Las imágenes revisadas tienen señales básicas correctas.',
      evidence: [`imagesCount:${imagesCount}`, 'missingAlt:0', 'oversizedImages:0'],
    };
  }

  return {
    decision: 'no_decidir',
    reason: 'No hay evidencia suficiente para validar imágenes.',
    evidence: [`imagesCount:${imagesCount}`],
  };
};

const inferIsBlog = (page: SeoPage): boolean => {
  const normalizedType = (page.pageType || '').toLowerCase();
  const normalizedUrl = (page.url || '').toLowerCase();
  return normalizedType.includes('blog') || normalizedType.includes('post') || normalizedUrl.includes('/blog/');
};

export const evaluateEstructuraHeuristic = (
  check: PendingCheckDescriptor,
  page: SeoPage,
): HeuristicResult => {
  const autoData = asRecord(check.autoData);
  const h1Count = firstNumber(autoData, ['h1Count', 'h1']);
  const h2Count = firstNumber(autoData, ['h2Count', 'h2']);
  const isBlog = inferIsBlog(page);

  if (typeof h1Count !== 'number') {
    return {
      decision: 'no_decidir',
      reason: 'Sin datos de encabezados para validar estructura.',
      evidence: [`blog_inferred:${isBlog}`, 'h1Count:unknown'],
    };
  }

  if (h1Count !== 1) {
    return {
      decision: 'error_claro_ia',
      reason: 'La estructura debe tener exactamente un H1.',
      evidence: [`blog_inferred:${isBlog}`, `h1Count:${h1Count}`, `h2Count:${h2Count ?? 0}`],
    };
  }

  if (isBlog && typeof h2Count === 'number' && h2Count < 2) {
    return {
      decision: 'no_decidir',
      reason: 'Post de blog con pocos H2; requiere revisión editorial.',
      evidence: [`blog_inferred:true`, `h1Count:${h1Count}`, `h2Count:${h2Count}`],
    };
  }

  return {
    decision: 'si_ia',
    reason: 'La jerarquía base de encabezados es consistente.',
    evidence: [`blog_inferred:${isBlog}`, `h1Count:${h1Count}`, `h2Count:${h2Count ?? 0}`],
  };
};

export const evaluateDatosEstructuradosHeuristic = (check: PendingCheckDescriptor): HeuristicResult => {
  const autoData = asRecord(check.autoData);
  const schemaCount = firstNumber(autoData, ['schemaCount', 'schemasCount']);
  const schemasParsed = Array.isArray(autoData.schemasParsed) ? autoData.schemasParsed.length : undefined;
  const parseErrors = Array.isArray(autoData.parseErrors) ? autoData.parseErrors.length : 0;
  const effectiveSchemaCount = schemaCount ?? schemasParsed;

  if (parseErrors > 0) {
    return {
      decision: 'error_claro_ia',
      reason: 'Se detectaron errores de parsing en datos estructurados.',
      evidence: [`parseErrors:${parseErrors}`, `schemaCount:${effectiveSchemaCount ?? 0}`],
    };
  }

  if ((effectiveSchemaCount || 0) > 0) {
    return {
      decision: 'si_ia',
      reason: 'Hay schema válido detectado sin errores de parsing.',
      evidence: [`schemaCount:${effectiveSchemaCount}`, `parseErrors:${parseErrors}`],
    };
  }

  return {
    decision: 'no_decidir',
    reason: 'No hay schema suficiente para validar automáticamente.',
    evidence: [`schemaCount:${effectiveSchemaCount ?? 0}`],
  };
};

export const evaluateGeolocalizacionHeuristic = (check: PendingCheckDescriptor): HeuristicResult => {
  const autoData = asRecord(check.autoData);
  const hreflangTags = Array.isArray(autoData.hreflangTags) ? autoData.hreflangTags.length : 0;
  const htmlLang = firstString(autoData, ['htmlLang']);
  const ogLocale = firstString(autoData, ['ogLocale']);
  const localBusiness = Boolean(autoData.localBusiness);

  if (htmlLang && (hreflangTags > 0 || ogLocale || localBusiness)) {
    return {
      decision: 'si_ia',
      reason: 'Se detectan señales geográficas básicas consistentes.',
      evidence: [
        `htmlLang:${htmlLang}`,
        `hreflangTags:${hreflangTags}`,
        `ogLocale:${ogLocale || 'none'}`,
        `localBusiness:${localBusiness}`,
      ],
    };
  }

  return {
    decision: 'no_decidir',
    reason: 'Señales de geolocalización incompletas para una decisión automática.',
    evidence: [
      `htmlLang:${htmlLang || 'missing'}`,
      `hreflangTags:${hreflangTags}`,
      `ogLocale:${ogLocale || 'missing'}`,
      `localBusiness:${localBusiness}`,
    ],
  };
};

const mapHeuristicToStatus = (decision: HeuristicDecision): ChecklistStatus | null => {
  if (decision === 'si_ia') return 'SI_IA';
  if (decision === 'error_claro_ia') return 'ERROR_CLARO_IA';
  return null;
};

export const runChecklistHeuristics = (
  page: SeoPage,
  pendingChecks: PendingCheckDescriptor[],
): ChecklistHeuristicsRun => {
  const resolvedByHeuristics: HeuristicCheckResolution[] = [];
  const pendingForAI: PendingCheckDescriptor[] = [];

  pendingChecks.forEach((check) => {
    let result: HeuristicResult | null = null;

    if (check.key === 'SNIPPETS') result = evaluateSnippetsHeuristic(check);
    if (check.key === 'IMAGENES') result = evaluateImagenesHeuristic(check);
    if (check.key === 'ESTRUCTURA') result = evaluateEstructuraHeuristic(check, page);
    if (check.key === 'DATOS_ESTRUCTURADOS') result = evaluateDatosEstructuradosHeuristic(check);
    if (check.key === 'GEOLOCALIZACION') result = evaluateGeolocalizacionHeuristic(check);

    if (!result) {
      pendingForAI.push(check);
      return;
    }

    const status = mapHeuristicToStatus(result.decision);
    if (!status) {
      pendingForAI.push(check);
      return;
    }

    resolvedByHeuristics.push({
      key: check.key,
      status,
      notes: `${result.reason} [heurística]`,
      reason: result.reason,
      evidence: result.evidence,
    });
  });

  return { resolvedByHeuristics, pendingForAI };
};
