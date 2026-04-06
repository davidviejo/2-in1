import { describe, expect, it } from 'vitest';
import { SeoPage } from '../types/seoChecklist';
import {
  evaluateEstructuraHeuristic,
  evaluateImagenesHeuristic,
  evaluateSnippetsHeuristic,
} from './checklistAiHeuristics';
import { PendingCheckDescriptor } from './seoChecklistAiValidation';

const baseCheck = (key: PendingCheckDescriptor['key']): PendingCheckDescriptor => ({
  key,
  label: key,
  priority: 'media',
  status_manual: 'NO',
  notes_manual: '',
  autoData: {},
});

const mockPage = (overrides?: Partial<SeoPage>): SeoPage => ({
  id: 'p1',
  url: 'https://example.com/blog/guia-seo',
  kwPrincipal: 'guia seo',
  pageType: 'blog',
  checklist: {} as SeoPage['checklist'],
  ...overrides,
});

describe('checklistAiHeuristics', () => {
  it('resuelve snippets como SI_IA cuando title y description están en rango', () => {
    const check = baseCheck('SNIPPETS');
    check.autoData = {
      title: 'Guía completa de SEO técnico para ecommerce 2026',
      metaDescription:
        'Aprende a optimizar rastreo, indexación y snippets con una checklist práctica para mejorar CTR y visibilidad orgánica.',
    };

    const result = evaluateSnippetsHeuristic(check);
    expect(result.decision).toBe('si_ia');
  });

  it('marca imágenes como error claro cuando faltan ALTs', () => {
    const check = baseCheck('IMAGENES');
    check.autoData = {
      imagesChecked: 12,
      missingAlt: 3,
      oversizedImages: 0,
    };

    const result = evaluateImagenesHeuristic(check);
    expect(result.decision).toBe('error_claro_ia');
    expect(result.evidence).toContain('missingAlt:3');
  });

  it('incluye inferencia de blog en estructura cuando no puede decidir', () => {
    const check = baseCheck('ESTRUCTURA');
    const page = mockPage();

    const result = evaluateEstructuraHeuristic(check, page);
    expect(result.decision).toBe('no_decidir');
    expect(result.evidence).toContain('blog_inferred:true');
  });
});
