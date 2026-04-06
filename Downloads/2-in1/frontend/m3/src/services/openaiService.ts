import OpenAI from 'openai';
import { SettingsRepository } from './settingsRepository';

/**
 * Inicializa el cliente de OpenAI de forma perezosa.
 */
const getOpenAIClient = () => {
  const apiKey = SettingsRepository.getApiKey('openai');
  if (!apiKey) {
    console.warn('OpenAI API Key is missing.');
    return null;
  }
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true }); // Client-side usage
};

export const isOpenAIConfigured = (): boolean => {
  return !!SettingsRepository.getApiKey('openai');
};

/**
 * Vitaminiza (mejora/amplía) una tarea específica utilizando OpenAI (ChatGPT).
 */
export const enhanceTaskWithOpenAI = async (task: any, vertical: string): Promise<string> => {
  const client = getOpenAIClient();
  if (!client)
    return 'Error: API Key de OpenAI no configurada. Ve a Ajustes (⚙️) para configurarla.';

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
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo', // Cost-effective default
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || 'No se generó respuesta.';
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return `Error conectando con OpenAI: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Genera un análisis SEO utilizando OpenAI (para compatibilidad con herramientas de análisis).
 */
export const generateSEOAnalysisWithOpenAI = async (
  content: string,
  type: 'headline' | 'audit' | 'schema' | 'calendar' | 'competitor' | 'tone' | 'roadmap',
  vertical?: string,
): Promise<string> => {
  const client = getOpenAIClient();
  if (!client)
    return 'Error: API Key de OpenAI no configurada. Ve a Ajustes (⚙️) para configurarla.';

  // STRICT Anti-Hallucination Instruction
  const systemInstruction =
    'CRITICAL INSTRUCTION: You are an SEO Expert Tool. Do NOT invent, simulate, or hallucinate data, metrics, traffic numbers, or statistics. If the user input does not contain enough information to perform a specific analysis (e.g. they provide a URL but you cannot crawl it), explicitly state what information is missing and provide theoretical advice based ONLY on the visible text provided. Base your analysis STRICTLY on the provided input text and general SEO best practices.';

  let prompt = '';
  if (type === 'headline') {
    prompt = `${systemInstruction}
        Actúa como un Experto SEO. Analiza el siguiente texto y proporciona 3 variaciones optimizadas de H1 y una Meta Description (máx 155 caracteres) optimizada para CTR. Responde en Español.

        Texto: "${content}"`;
  } else if (type === 'audit') {
    prompt = `${systemInstruction}
        Actúa como Auditor SEO Técnico. Proporciona una lista de comprobaciones basada en el input: "${content}". Si el input es una URL, menciona claramente que NO puedes rastrear la web en tiempo real pero da recomendaciones generales basadas en la estructura visible de la URL o el tema inferido. Responde en Español.`;
  } else if (type === 'schema') {
    prompt = `${systemInstruction}
        Actúa como Desarrollador SEO Técnico. Genera un marcado Schema 'NewsArticle' JSON-LD válido para: "${content}". Usa marcadores genéricos (ej: "URL_AQUI", "FECHA_AQUI") para datos que no estén explícitamente en el texto. NO inventes autores o fechas si no se dan. Muestra SOLO el código JSON.`;
  } else if (type === 'calendar') {
    prompt = `${systemInstruction}
        Actúa como Redactor Jefe. Crea un calendario de contenidos de 5 días enfocado en el tema: "${content}". Sugiere ángulos 'Breaking News' y 'Evergreen'. Responde en Español.`;
  } else if (type === 'competitor') {
    prompt = `${systemInstruction}
        Actúa como Estratega SEO. Analiza la estrategia de contenido típica para un sitio del tipo: "${content}". Identifica oportunidades teóricas de "Océano Azul". NO inventes competidores ni métricas de tráfico. Responde en Español.`;
  } else if (type === 'tone') {
    prompt = `${systemInstruction}
        Actúa como Editor Senior. Analiza el tono de voz del texto. Da una puntuación del 1-10 en "Objetividad" basada SOLO en el texto.
        Texto: "${content}"`;
  } else if (type === 'roadmap') {
    const v = vertical || 'media';
    let role = 'Estratega SEO General';
    let focus = 'Visibilidad General';

    const verticalMap: any = {
      media: {
        role: 'Director SEO de Medio de Comunicación',
        focus: 'Google Discover, Top Stories, Velocidad',
      },
      ecom: {
        role: 'Head of SEO para E-commerce',
        focus: 'Fichas de Producto, Categorías, Crawl Budget',
      },
      local: {
        role: 'Especialista SEO Local',
        focus: 'Google Business Profile, Citaciones, Reseñas',
      },
      national: {
        role: 'Consultor SEO Nacional',
        focus: 'Arquitectura Web, Contenidos, Autoridad de Marca',
      },
      international: {
        role: 'Estratega SEO Internacional',
        focus: 'Hreflang, Localización, Dominios Globales',
      },
    };

    if (verticalMap[v]) {
      role = verticalMap[v].role;
      focus = verticalMap[v].focus;
    }

    prompt = `${systemInstruction}
        Actúa como ${role}. Crea un Roadmap Estratégico de 6 meses para: "${content}".
        Enfoque: ${focus}.
        Estructura (Markdown):
        1. Diagnóstico Inicial (Teórico basado en input)
        2. Fases (Mes 1-6)
        3. KPIs Recomendados (Genéricos para el vertical)

        Responde en Español.`;
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || 'No se generó análisis.';
  } catch (error) {
    console.error('OpenAI Analysis Error:', error);
    return `Error generando análisis con OpenAI: ${error instanceof Error ? error.message : String(error)}`;
  }
};
