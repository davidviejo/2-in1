import {
  createDefaultProjectSegmentationConfig,
  parseProjectSegmentationConfig,
} from '@/features/gsc-impact/segmentation/configAdapter';
import { ProjectSegmentationConfig } from '@/features/gsc-impact/segmentation/types';

const GSC_IMPACT_SEGMENTATION_PREFIX = 'mediaflow_gsc_impact_segmentation_';
const LEGACY_BRAND_TERMS_PREFIX = 'mediaflow_gsc_impact_brand_terms_';
const DEFAULT_CLIENT_KEY = 'default';

const buildStorageKey = (clientId?: string | null): string =>
  `${GSC_IMPACT_SEGMENTATION_PREFIX}${clientId || DEFAULT_CLIENT_KEY}`;

export class GscImpactSegmentationRepository {
  static getConfigByClientId(clientId?: string | null): ProjectSegmentationConfig {
    try {
      const raw = localStorage.getItem(buildStorageKey(clientId));
      if (raw) {
        return parseProjectSegmentationConfig(JSON.parse(raw));
      }

      const legacyBrandTerms = localStorage.getItem(`${LEGACY_BRAND_TERMS_PREFIX}${clientId || DEFAULT_CLIENT_KEY}`);
      if (legacyBrandTerms) {
        return parseProjectSegmentationConfig({ brandedTerms: legacyBrandTerms });
      }
    } catch (error) {
      console.error('Failed to parse GSC impact segmentation config', error);
    }

    return createDefaultProjectSegmentationConfig();
  }

  static saveConfigByClientId(clientId: string | null | undefined, config: ProjectSegmentationConfig): void {
    const normalized = parseProjectSegmentationConfig(config);
    localStorage.setItem(buildStorageKey(clientId), JSON.stringify(normalized));
  }
}
