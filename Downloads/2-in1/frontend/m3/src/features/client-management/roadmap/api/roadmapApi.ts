import { Task } from '@/types';
import { HttpClientError, createHttpClient } from '@/services/httpClient';
import { endpoints } from '@/services/endpoints';

export interface AIProviderConfig {
  provider: 'openai' | 'mistral' | 'gemini';
  apiKey?: string;
  model: string;
}

const httpClient = createHttpClient({ service: 'api' });

export const generateAIRoadmap = async (
  auditText: string,
  availableTasks: { id: string; title: string; category?: string }[],
  config: AIProviderConfig,
): Promise<Task[]> => {
  const { provider, model } = config;

  if (!auditText.trim()) return [];

  const systemTasksList = availableTasks
    .map((t) => `- ID: ${t.id} | Title: ${t.title} (${t.category || 'General'})`)
    .join('\n');

  const prompt = `
Actúa como un Estratega SEO Experto creando un roadmap personalizado.

AUDITORÍA DEL CLIENTE / NECESIDADES:
"""
${auditText}
"""

TAREAS DEL SISTEMA DISPONIBLES (Referencia estas por ID si aplica):
${systemTasksList}

INSTRUCCIONES:
1. Analiza cuidadosamente la Auditoría del Cliente.
2. Selecciona tareas relevantes de la lista de TAREAS DEL SISTEMA que aborden los puntos de la auditoría.
3. Crea NUEVAS TAREAS PERSONALIZADAS para necesidades mencionadas en la auditoría que NO estén cubiertas por las tareas del sistema.
4. Retorna un array JSON de objetos Task.

CRÍTICO: Todo el contenido de salida (títulos, descripciones) DEBE estar en ESPAÑOL.

Estructura JSON por tarea:
{
  "id": "Usa el ID del sistema si seleccionas una tarea existente, de lo contrario genera un string único como 'ai-custom-timestamp'",
  "title": "Título de la Tarea (En Español)",
  "description": "Descripción específica y accionable adaptada a la auditoría (En Español).",
  "impact": "High" | "Medium" | "Low",
  "category": "Technical" | "Content" | "Authority" | "UX",
  "isCustom": boolean (true si es nueva, false si es existente)
}

IMPORTANTE:
- Retorna SOLO el array JSON. Sin formato markdown, sin bloques de código.
- Asegúrate de que el JSON sea válido.
`;

  try {
    const response = await httpClient.post<{ tasks?: Task[] }>(endpoints.ai.roadmapGenerate(), {
      auditText,
      availableTasks,
      provider,
      model,
      prompt,
    });

    const tasks = Array.isArray(response.tasks) ? response.tasks : [];
    return tasks.map((t, index) => ({
      ...t,
      id: t.isCustom ? (t.id.startsWith('ai-') ? t.id : `ai-${Date.now()}-${index}`) : t.id,
      status: 'pending',
    }));
  } catch (error) {
    if (error instanceof HttpClientError) {
      throw new Error(error.message || 'Failed to generate roadmap via backend.');
    }
    console.error('AI Roadmap Generation Error:', error);
    throw error;
  }
};
