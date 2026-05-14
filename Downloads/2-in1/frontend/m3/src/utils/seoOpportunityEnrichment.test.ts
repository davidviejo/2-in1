import { describe, expect, it } from 'vitest';
import { buildSeoUrlCanonicalKey } from './seoUrlNormalizer';
import { calculateSeoOpportunityPriority, enrichGscOpportunitiesWithUrlChecklist } from './seoOpportunityEnrichment';

describe('seoOpportunityEnrichment', () => {
  it('normaliza URLs equivalentes', () => {
    const a = buildSeoUrlCanonicalKey('https://www.dominio.com/servicio/?utm_source=x');
    const b = buildSeoUrlCanonicalKey('dominio.com/servicio/');
    expect(a.startsWith('dominio.com/servicio')).toBe(true);
    expect(b).toBe('dominio.com/servicio');
  });

  it('calcula prioridad y tipo', () => {
    const result = calculateSeoOpportunityPriority({
      clicks: 20,
      impressions: 15000,
      ctr: 0.01,
      position: 8,
      checklistProgressPercent: 80,
      pendingChecklistBlocks: [],
    });
    expect(result.seoPriorityScore).toBeGreaterThan(50);
    expect(['Quick win', 'Monitorizar', 'Requiere base']).toContain(result.opportunityTypeLabel);
  });

  it('enriquece con match y deja N/D sin match', () => {
    const rows: any[] = [{ key: 'https://dominio.com/servicio/', postClicks: 3, postImpressions: 100, postCtr: 0.03, postPosition: 9 }];
    const pages: any[] = [{ id: '1', url: 'https://dominio.com/servicio/', kwPrincipal: 'seo local', pageType: 'service', cluster: 'local', checklist: {} }];
    const enriched = enrichGscOpportunitiesWithUrlChecklist(rows, pages);
    expect(enriched[0].targetKeyword).toBe('seo local');

    const noMatch = enrichGscOpportunitiesWithUrlChecklist([{ key: '/missing' }], pages);
    expect(noMatch[0].seoPriorityLabel).toBe('No disponible');
  });
});
