import { describe, expect, it } from 'vitest';
import { buildPendingChecks, getChecklistPriority } from './seoChecklistAiValidation';
import { CHECKLIST_POINTS, SeoPage } from '../types/seoChecklist';

const buildMockPage = (): SeoPage => ({
  id: '1',
  url: 'https://example.com',
  kwPrincipal: 'seo test',
  pageType: 'landing',
  checklist: CHECKLIST_POINTS.reduce((acc, point) => {
    acc[point.key] = {
      key: point.key,
      label: point.label,
      status_manual: 'NO',
      notes_manual: '',
    };
    return acc;
  }, {} as SeoPage['checklist']),
});

describe('seoChecklistAiValidation', () => {
  it('excludes strict SI from pending list', () => {
    const page = buildMockPage();
    page.checklist.CONTENIDOS.status_manual = 'SI';

    const result = buildPendingChecks(page);
    expect(result.skippedSi.map((item) => item.key)).toContain('CONTENIDOS');
    expect(result.pending.some((item) => item.key === 'CONTENIDOS')).toBe(false);
  });

  it('orders checks by priority alta > media > baja', () => {
    const page = buildMockPage();
    const result = buildPendingChecks(page);
    const priorities = result.pending.map((item) => item.priority);

    const firstLowPriorityIndex = priorities.findIndex((priority) => priority === 'baja');
    const lastHighPriorityIndex = priorities.lastIndexOf('alta');

    expect(firstLowPriorityIndex).toBeGreaterThan(lastHighPriorityIndex);
  });

  it('returns configured priority by checklist key', () => {
    expect(getChecklistPriority('CONTENIDOS')).toBe('alta');
    expect(getChecklistPriority('DATOS_ESTRUCTURADOS')).toBe('media');
    expect(getChecklistPriority('ENLACE')).toBe('baja');
  });
});
