import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../constants';
import { ClusterCategory, NewsCluster, NewsPriority } from '../types';

const resolveGeminiApiKey = (userProvidedKey?: string) =>
  userProvidedKey || import.meta.env.VITE_GEMINI_API_KEY || '';

export const analyzeNewsWithGemini = async (
  clusters: NewsCluster[],
  userProvidedKey?: string,
): Promise<NewsCluster[]> => {
  try {
    const apiKey = resolveGeminiApiKey(userProvidedKey);
    if (!apiKey) {
      throw new Error('No se encontró API Key de Gemini.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const itemsToAnalyze = clusters.slice(0, 50).map((cluster) => ({
      id: cluster.cluster_id,
      title: cluster.title,
      source: cluster.top_source,
      technical_score: cluster.score,
      articles_count: cluster.coverage_count,
      snippet: cluster.articles[0]?.snippet,
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analiza estos clusters de noticias pre-procesados.\n${JSON.stringify(itemsToAnalyze, null, 2)}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              suggestedTitle: { type: Type.STRING },
              summary: { type: Type.STRING },
              priority: { type: Type.STRING, enum: Object.values(NewsPriority) },
              category: { type: Type.STRING, enum: Object.values(ClusterCategory) },
              reasoning: { type: Type.STRING },
            },
            required: ['id', 'suggestedTitle', 'priority', 'category', 'reasoning'],
          },
        },
      },
    });

    if (!response.text) {
      throw new Error('No response text generated');
    }

    const aiResults = JSON.parse(response.text) as any[];
    const merged = clusters.map((cluster) => {
      const aiResult = aiResults.find((item) => item.id === cluster.cluster_id);
      cluster.ai_analysis = aiResult
        ? {
            suggestedTitle: aiResult.suggestedTitle,
            summary: aiResult.summary,
            priority: aiResult.priority,
            category: aiResult.category,
            reasoning: aiResult.reasoning,
          }
        : {
            suggestedTitle: cluster.title,
            summary: cluster.articles[0]?.snippet || 'Sin análisis de IA disponible.',
            priority: NewsPriority.DISCARD,
            category: ClusterCategory.OTROS,
            reasoning: 'Ítem crudo (no analizado por IA o fuera de límite).',
          };
      return cluster;
    });

    return merged.sort((a, b) => {
      const priorityA = a.ai_analysis?.priority === NewsPriority.P1 ? 2000 : a.ai_analysis?.priority === NewsPriority.P2 ? 1000 : 0;
      const priorityB = b.ai_analysis?.priority === NewsPriority.P1 ? 2000 : b.ai_analysis?.priority === NewsPriority.P2 ? 1000 : 0;
      return priorityB + b.score - (priorityA + a.score);
    });
  } catch (error) {
    console.error('Gemini Analysis Failed:', error);
    throw error;
  }
};
