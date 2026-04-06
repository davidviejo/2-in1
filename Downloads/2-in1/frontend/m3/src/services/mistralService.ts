import { Mistral } from '@mistralai/mistralai';
import { Task } from '../types';

// Exported for testing purposes
export const mistralConfig = {
  getEnv: () => import.meta.env,
};

// Initialize AI lazily to avoid crash if env var is missing during build/init
/**
 * Inicializa el cliente de Mistral AI de forma perezosa.
 * @returns {Mistral | null} Instancia del cliente de Mistral o null si falta la API Key.
 */
const getMistralClient = () => {
  const apiKey = mistralConfig.getEnv().VITE_MISTRAL_API_KEY;
  if (!apiKey) {
    console.warn('VITE_MISTRAL_API_KEY is missing. Mistral features will not work.');
    return null;
  }
  return new Mistral({ apiKey });
};

/**
 * Verifica si la integración con Mistral está configurada (API Key presente).
 */
export const isMistralConfigured = (): boolean => {
  return !!mistralConfig.getEnv().VITE_MISTRAL_API_KEY;
};

/**
 * Vitaminiza (mejora/amplía) una tarea específica utilizando Mistral AI.
 *
 * @param {Task} task - La tarea a analizar.
 * @param {string} vertical - El vertical del cliente (media, ecom, local).
 * @returns {Promise<string>} Consejos accionables y detallados para completar la tarea.
 */
export const enhanceTaskWithMistral = async (task: Task, vertical: string): Promise<string> => {
  const client = getMistralClient();
  if (!client) return 'Error: API Key de Mistral no configurada. Verifica VITE_MISTRAL_API_KEY.';

  const DEFAULT_MISTRAL_MODEL = 'mistral-tiny';
  const model = mistralConfig.getEnv().VITE_MISTRAL_MODEL || DEFAULT_MISTRAL_MODEL;

  const verticalMap: Record<string, string> = {
    media: 'Medios de Comunicación',
    ecom: 'E-commerce',
    local: 'Negocios Locales',
    national: 'Negocios Nacionales',
    international: 'Negocios Internacionales',
  };
  const verticalName = verticalMap[vertical] || vertical;

  const prompt = `Actúa como un Consultor SEO Senior especializado en ${verticalName}.

  Tu objetivo es "vitaminizar" (dar superpoderes) a la siguiente tarea para que el usuario sepa exactamente cómo ejecutarla con excelencia.

  Tarea: "${task.title}"
  Descripción original: "${task.description}"
  Categoría: ${task.category || 'General'}
  Impacto: ${task.impact}

  Instrucciones:
  1. Explica BREVEMENTE (1 frase) por qué esta tarea es crítica para un sitio de tipo ${vertical}.
  2. Proporciona una "Micro-Guía de Ejecución" paso a paso (máximo 4 pasos).
  3. Sugiere una "Pro Tip" o consejo avanzado que diferencie un trabajo normal de uno excelente.
  4. Si aplica, menciona qué herramienta (GSC, Screaming Frog, Ahrefs) usar.

  Responde en Español. Usa formato Markdown limpio (listas, negritas). Sé directo y accionable.`;

  try {
    const chatResponse = await client.chat.complete({
      model: model,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = chatResponse.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : 'No se generó respuesta.';
  } catch (error) {
    console.error('Mistral API Error:', error);
    return 'Error conectando con Mistral AI. Por favor intenta más tarde.';
  }
};
