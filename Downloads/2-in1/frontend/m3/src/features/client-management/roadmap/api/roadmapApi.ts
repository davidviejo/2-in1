import { Mistral } from '@mistralai/mistralai';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { Task } from '@/types';

export interface AIProviderConfig {
  provider: 'openai' | 'mistral' | 'gemini';
  apiKey: string;
  model: string;
}

export const generateAIRoadmap = async (
  auditText: string,
  availableTasks: { id: string; title: string; category?: string }[],
  config: AIProviderConfig,
): Promise<Task[]> => {
  const { provider, apiKey, model } = config;

  if (!auditText.trim()) return [];
  if (!apiKey) throw new Error(`API Key for ${provider} is missing.`);

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
    let responseText = '';

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful SEO assistant that outputs strict JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });
      responseText = response.choices[0].message.content || '';
    } else if (provider === 'mistral') {
      const client = new Mistral({ apiKey });
      const response = await client.chat.complete({
        model: model,
        messages: [{ role: 'user', content: prompt }],
      });
      responseText = (response.choices?.[0]?.message?.content as string) || '';
    } else if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      responseText = response.text || '';
    }

    const cleanJson = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let tasks: Task[] = [];
    try {
      tasks = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw Response:', responseText);
      throw new Error('Failed to parse AI response as JSON. Please try again.');
    }

    return tasks.map((t, index) => ({
      ...t,
      id: t.isCustom ? (t.id.startsWith('ai-') ? t.id : `ai-${Date.now()}-${index}`) : t.id,
      status: 'pending',
    }));
  } catch (error) {
    console.error('AI Roadmap Generation Error:', error);
    throw error;
  }
};
