import { analyzeGSCInsights } from '../utils/gscInsights';
import { GSCRow, ProjectType } from '../types';
import { SeoInsightDateRange } from '../types/seoInsights';

interface GSCWorkerPayload {
  currentRows: GSCRow[];
  previousRows?: GSCRow[];
  propertyId?: string;
  periodCurrent?: SeoInsightDateRange;
  periodPrevious?: SeoInsightDateRange;
  brandTerms?: string[];
  projectType?: ProjectType;
  analysisProjectTypes?: ProjectType[];
  sector?: string;
  geoScope?: string;
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
      propertyId: payload.propertyId,
      periodCurrent: payload.periodCurrent,
      periodPrevious: payload.periodPrevious,
      brandTerms: payload.brandTerms,
      projectType: payload.projectType,
      analysisProjectTypes: payload.analysisProjectTypes,
      sector: payload.sector,
      geoScope: payload.geoScope,
    });

    postMessage({ type: 'SUCCESS', payload: insights });
  } catch (error) {
    postMessage({ type: 'ERROR', payload: error instanceof Error ? error.message : String(error) });
  }
});
