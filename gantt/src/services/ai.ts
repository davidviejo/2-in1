import { GoogleGenAI, Type } from "@google/genai";
import { Task } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseTasksFromText(text: string, currentDate: Date) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Extract tasks from the following text and return them as a list of tasks with titles, start dates, and end dates. Use the current date ${currentDate.toISOString()} as a reference for relative dates (e.g. 'next week', 'tomorrow'). Text: "${text}"`,
    config: {
      systemInstruction: "You are an assistant that extracts schedule and task information into structured JSON. Always provide exact dates based on the context.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The task title" },
            startDate: { type: Type.STRING, description: "Start date in YYYY-MM-DD format" },
            endDate: { type: Type.STRING, description: "End date in YYYY-MM-DD format" }
          },
          required: ["title", "startDate", "endDate"],
        }
      }
    }
  });

  if (!response.text) return [];
  const parsed = JSON.parse(response.text);
  return parsed.map((t: any) => ({
    title: t.title,
    startDate: new Date(t.startDate),
    endDate: new Date(t.endDate)
  }));
}

export async function parseTasksFromAudio(base64Audio: string, mimeType: string, currentDate: Date) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: {
      parts: [
        {
          inlineData: {
             data: base64Audio,
             mimeType: mimeType
          }
        },
        {
          text: `Extract tasks from this audio and return them as structured JSON. Use the current date ${currentDate.toISOString()} as a reference.`
        }
      ]
    },
    config: {
      systemInstruction: "You are an assistant that extracts schedule from audio into structured JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The task title" },
            startDate: { type: Type.STRING, description: "Start date in YYYY-MM-DD format" },
            endDate: { type: Type.STRING, description: "End date in YYYY-MM-DD format" }
          },
          required: ["title", "startDate", "endDate"],
        }
      }
    }
  });

  if (!response.text) return [];
  const parsed = JSON.parse(response.text);
  return parsed.map((t: any) => ({
    title: t.title,
    startDate: new Date(t.startDate),
    endDate: new Date(t.endDate)
  }));
}

export async function analyzeBottlenecks(tasks: Task[], currentDate: Date) {
  const tasksData = tasks.map(t => ({
    title: t.title,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    assignee: t.assignee || 'Sin asignar',
    project: t.project || 'Sin proyecto'
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analiza la siguiente lista de tareas de un diagrama de Gantt e identifica posibles cuellos de botella, solapamientos críticos o sobrecarga de trabajo para los responsables. Usa la fecha actual ${currentDate.toISOString()} como referencia. Responde de forma muy concisa, directa y profesional.\n\nTareas: ${JSON.stringify(tasksData, null, 2)}`
  });

  return response.text;
}
