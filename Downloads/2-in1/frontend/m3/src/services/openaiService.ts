import { HttpClientError } from './httpClient';
import { SettingsRepository } from './settingsRepository';
import { openaiApi, SeoAnalysisType } from './openaiApi';

const mapHttpError = (error: unknown, fallback: string): string => {
  if (error instanceof HttpClientError) {
    if (error.status === 401 || error.status === 403) {
      return 'Error: sesión expirada o sin permisos. Inicia sesión de nuevo.';
    }
    if (error.status === 424) {
      return 'Error: OpenAI no configurado en servidor. Ve a Ajustes (⚙️).';
    }
    return `Error conectando con OpenAI: ${error.message}`;
  }

  return `${fallback}: ${error instanceof Error ? error.message : String(error)}`;
};

export const isOpenAIConfigured = (): boolean => {
  const cached = SettingsRepository.getSettings().openaiApiKey;
  return Boolean(cached && cached.trim().length > 0);
};

export const enhanceTaskWithOpenAI = async (task: any, vertical: string): Promise<string> => {
  try {
    const response = await openaiApi.enhanceTask({
      task: {
        title: task?.title,
        description: task?.description,
        category: task?.category,
        impact: task?.impact,
      },
      vertical,
    });
    return response.result || 'No se generó respuesta.';
  } catch (error) {
    return mapHttpError(error, 'Error generando vitaminización');
  }
};

export const generateSEOAnalysisWithOpenAI = async (
  content: string,
  type: SeoAnalysisType,
  vertical?: string,
): Promise<string> => {
  try {
    const response = await openaiApi.seoAnalysis({ content, type, vertical });
    return response.result || 'No se generó análisis.';
  } catch (error) {
    return mapHttpError(error, 'Error generando análisis con OpenAI');
  }
};
