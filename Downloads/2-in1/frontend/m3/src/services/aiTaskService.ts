import { Task } from '../types';

export interface AIProviderConfig {
  provider: 'openai' | 'mistral' | 'gemini';
  apiKey: string;
  model: string;
}

export const enhanceTaskWithAI = async (
  task: Task,
  vertical: string,
  config: AIProviderConfig,
  userContext?: string,
): Promise<string> => {
  const { provider, apiKey, model } = config;

  if (!apiKey) return `Error: API Key para ${provider} no configurada.`;

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
    let responseText = '';

    if (provider === 'openai') {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful SEO assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });
      responseText = response.choices[0].message.content || '';
    } else if (provider === 'mistral') {
      const { Mistral } = await import('@mistralai/mistralai');
      const client = new Mistral({ apiKey });
      const response = await client.chat.complete({
        model: model,
        messages: [{ role: 'user', content: prompt }],
      });
      responseText = (response.choices?.[0]?.message?.content as string) || '';
    } else if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      responseText = response.text || '';
    }

    return responseText || 'No se generó respuesta.';
  } catch (error) {
    console.error(`AI Service Error (${provider}):`, error);
    return `Error conectando con ${provider}. Por favor intenta más tarde.`;
  }
};
