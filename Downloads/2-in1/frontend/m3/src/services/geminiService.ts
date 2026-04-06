import { HttpClientError, createHttpClient } from './httpClient';
import { endpoints } from './endpoints';

const httpClient = createHttpClient({ service: 'api' });

/**
 * Genera un análisis SEO proxyando a través del backend para ocultar la API Key.
 *
 * @param {string} content - El contenido o texto a analizar.
 * @param {'headline' | 'audit' | 'schema' | 'calendar' | 'competitor' | 'tone' | 'roadmap'} type - El tipo de análisis a realizar.
 * @param {string} [vertical] - El vertical del cliente ('media', 'ecom', 'local') para personalizar el roadmap.
 * @returns {Promise<string>} El resultado del análisis generado por la IA o un mensaje de error.
 */
export const generateSEOAnalysis = async (
  content: string,
  type: 'headline' | 'audit' | 'schema' | 'calendar' | 'competitor' | 'tone' | 'roadmap',
  vertical?: string,
): Promise<string> => {
  try {
    const data = await httpClient.post<{ result?: string }>(endpoints.ai.seoAnalysis(), {
      content,
      type,
      vertical,
    });

    return data.result || 'No se generó análisis.';
  } catch (error) {
    console.error('Backend Gemini API Proxy Error:', error);
    if (error instanceof HttpClientError) {
      return `Error: ${error.message || 'Problema de conexión con el backend.'}`;
    }
    return 'Error generando análisis. Por favor intenta más tarde.';
  }
};

/**
 * Evalúa un titular para SEO y CTR proxyando a través del backend.
 *
 * @param {string} headline - El titular a evaluar.
 * @param {string} keywords - Las palabras clave objetivo.
 * @returns {Promise<string>} Evaluación del titular con puntuación y sugerencias.
 */
export const evaluateHeadlineChallenge = async (
  headline: string,
  keywords: string,
): Promise<string> => {
  try {
    const data = await httpClient.post<{ result?: string }>(endpoints.ai.headlineChallenge(), {
      headline,
      keywords,
    });

    return data.result || 'PUNTUACION: 0\nFEEDBACK: Error en la respuesta.\nMEJOR_VERSION: N/A';
  } catch (error) {
    console.error('Backend Gemini API Proxy Error:', error);
    if (error instanceof HttpClientError) {
      return `PUNTUACION: 0\nFEEDBACK: ${error.message || 'Error del servidor.'}\nMEJOR_VERSION: N/A`;
    }
    return 'PUNTUACION: 0\nFEEDBACK: Error de conexión.\nMEJOR_VERSION: Intenta de nuevo.';
  }
};
