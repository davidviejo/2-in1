import { Task } from '../types';
import { HttpClientError, createHttpClient } from './httpClient';
import { endpoints } from './endpoints';

export interface AIProviderConfig {
  provider: 'openai' | 'mistral' | 'gemini';
  apiKey?: string;
  model: string;
}

const httpClient = createHttpClient({ service: 'api' });

export const enhanceTaskWithAI = async (
  task: Task,
  vertical: string,
  config: AIProviderConfig,
  userContext?: string,
): Promise<string> => {
  const { provider, model } = config;

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
  ${userContext ? `\nContexto adicional/Instrucciones del usuario: "${userContext}"` : ''}

  Instrucciones:
  1. Explica BREVEMENTE (1 frase) por qué esta tarea es crítica para un sitio de tipo ${vertical}.
  2. Proporciona una "Micro-Guía de Ejecución" paso a paso (máximo 4 pasos).
  3. Sugiere una "Pro Tip" o consejo avanzado que diferencie un trabajo normal de uno excelente.
  4. Si aplica, menciona qué herramienta (GSC, Screaming Frog, Ahrefs) usar.

  Responde en Español. Usa formato Markdown limpio (listas, negritas). Sé directo y accionable.`;

  try {
    const response = await httpClient.post<{ result?: string }>(endpoints.ai.taskEnhance(), {
      task,
      vertical,
      userContext,
      provider,
      model,
      prompt,
    });
    return response.result || 'No se generó respuesta.';
  } catch (error) {
    if (error instanceof HttpClientError) {
      return `Error: ${error.message || `Error conectando con ${provider}`}.`;
    }
    console.error(`AI Service Error (${provider}):`, error);
    return `Error conectando con ${provider}. Por favor intenta más tarde.`;
  }
};
