import { createHttpClient, HttpClientError } from '@/services/httpClient';

const httpClient = createHttpClient({ service: 'api' });

interface ReorderPayloadItem {
  id: string;
  order: number;
}

const toError = (error: unknown, fallback: string) => {
  if (error instanceof HttpClientError) {
    return new Error(error.message || fallback);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
};

export const metodologiaService = {
  async reorderModules(items: ReorderPayloadItem[]) {
    try {
      await httpClient.post('api/metodologia/modules/reorder', { items });
    } catch (error) {
      throw toError(error, 'No se pudo guardar el nuevo orden de módulos.');
    }
  },

  async reorderPhases(items: ReorderPayloadItem[]) {
    try {
      await httpClient.post('api/metodologia/phases/reorder', { items });
    } catch (error) {
      throw toError(error, 'No se pudo guardar el nuevo orden de fases.');
    }
  },
};
