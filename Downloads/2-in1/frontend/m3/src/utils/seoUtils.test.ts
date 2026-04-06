import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPageAnalysis } from './seoUtils';
import { analyzeUrl } from '../services/pythonEngineClient';
import { SeoPage } from '../types/seoChecklist';

// Mock dependencies
vi.mock('../services/pythonEngineClient', () => ({
  analyzeUrl: vi.fn(),
  ENGINE_ANALYZE_TIMEOUT_MS: 90000,
}));

vi.mock('../services/googleSearchConsole', () => ({
  getPageQueries: vi.fn(),
}));

const mockPage: SeoPage = {
  id: 'page-1',
  url: 'https://example.com',
  kwPrincipal: 'test',
  pageType: 'Article',
  checklist: {
    GEOLOCALIZACION: {
      key: 'GEOLOCALIZACION',
      label: 'Geo',
      status_manual: 'NA',
      notes_manual: '',
    },
    DATOS_ESTRUCTURADOS: {
      key: 'DATOS_ESTRUCTURADOS',
      label: 'Data',
      status_manual: 'NA',
      notes_manual: '',
    },
    OPORTUNIDADES: { key: 'OPORTUNIDADES', label: 'Ops', status_manual: 'NA', notes_manual: '' },
  } as any,
};

describe('runPageAnalysis', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should sync LocalBusiness from DATOS_ESTRUCTURADOS to GEOLOCALIZACION if present', async () => {
    // Mock analyzeUrl response
    (analyzeUrl as any).mockResolvedValue({
      pageId: 'page-1',
      items: {
        DATOS_ESTRUCTURADOS: {
          autoData: {
            schemasParsed: ['LocalBusiness', 'Organization'],
          },
        },
        GEOLOCALIZACION: {
          autoData: {
            localBusiness: false, // Initially false or undefined
          },
        },
        OPORTUNIDADES: { autoData: {} },
      },
    });

    const updates = await runPageAnalysis(mockPage);

    // Check if GEOLOCALIZACION was updated
    expect(updates.checklist?.GEOLOCALIZACION.autoData.localBusiness).toBe(true);
  });

  it('should sync LocalBusiness from DATOS_ESTRUCTURADOS to GEOLOCALIZACION if GEOLOCALIZACION is missing', async () => {
    // Mock analyzeUrl response without GEOLOCALIZACION
    (analyzeUrl as any).mockResolvedValue({
      pageId: 'page-1',
      items: {
        DATOS_ESTRUCTURADOS: {
          autoData: {
            schemasParsed: [{ '@type': 'LocalBusiness' }],
          },
        },
        OPORTUNIDADES: { autoData: {} },
      },
    });

    const updates = await runPageAnalysis(mockPage);

    // Check if GEOLOCALIZACION was created and updated
    expect(updates.checklist?.GEOLOCALIZACION).toBeDefined();
    expect(updates.checklist?.GEOLOCALIZACION.autoData.localBusiness).toBe(true);
  });

  it('should NOT sync LocalBusiness if not present in DATOS_ESTRUCTURADOS', async () => {
    // Mock analyzeUrl response
    (analyzeUrl as any).mockResolvedValue({
      pageId: 'page-1',
      items: {
        DATOS_ESTRUCTURADOS: {
          autoData: {
            schemasParsed: ['Article'],
          },
        },
        GEOLOCALIZACION: {
          autoData: {
            localBusiness: false,
          },
        },
        OPORTUNIDADES: { autoData: {} },
      },
    });

    const updates = await runPageAnalysis(mockPage);

    // Check if GEOLOCALIZACION remains false
    expect(updates.checklist?.GEOLOCALIZACION.autoData.localBusiness).toBe(false);
  });
});
