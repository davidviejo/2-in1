import { createHttpClient } from './httpClient';

const api = createHttpClient({ service: 'api' });

type ReorderPayload = { id: string; order: number };

export const metodologiaService = {
  reorderModules: async (modules: ReorderPayload[]) => {
    await api.post('/metodologia/modules/reorder', { modules });
  },
  reorderPhases: async (phases: ReorderPayload[]) => {
    await api.post('/metodologia/phases/reorder', { phases });
  },
};
