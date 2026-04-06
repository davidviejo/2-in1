import { analyzeGSCInsights } from '../utils/gscInsights';
import { GSCRow } from '../types';

interface GSCWorkerPayload {
  currentRows: GSCRow[];
  previousRows?: GSCRow[];
}

addEventListener('message', (e: MessageEvent<GSCWorkerPayload>) => {
  const payload = e.data;

  if (!payload || !Array.isArray(payload.currentRows)) {
    postMessage({ type: 'ERROR', payload: 'Invalid data format: expected currentRows array of GSCRow' });
    return;
  }

  try {
    const insights = analyzeGSCInsights({
      currentRows: payload.currentRows,
      previousRows: Array.isArray(payload.previousRows) ? payload.previousRows : [],
    });

    postMessage({ type: 'SUCCESS', payload: insights });
  } catch (error) {
    postMessage({ type: 'ERROR', payload: error instanceof Error ? error.message : String(error) });
  }
});
