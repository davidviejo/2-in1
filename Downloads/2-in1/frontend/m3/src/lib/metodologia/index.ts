import type { Module, Phase, Resource } from '@/types/metodologia';

export const metodologiaTabs = ['Documentación', 'Enlazado interno', 'URLs clave', 'Plantillas', 'KPIs', 'Notas rápidas'] as const;

export const filterResourcesByTab = (resources: Resource[], tab: string): Resource[] => {
  const byTitle = (words: string[]) => resources.filter((resource) => words.some((word) => resource.title.toLowerCase().includes(word)));

  switch (tab) {
    case 'Documentación':
      return resources;
    case 'Enlazado interno':
      return byTitle(['enlazado', 'link']);
    case 'URLs clave':
      return byTitle(['sitemap', 'dashboard']);
    case 'Plantillas':
      return byTitle(['brief', 'checklist']);
    case 'KPIs':
      return byTitle(['dashboard']);
    case 'Notas rápidas':
    default:
      return [];
  }
};

export const buildPhaseTableRows = (phases: Phase[]) =>
  phases.map((phase) => [phase.title, phase.objective, phase.actions, phase.deliverables.join(' · '), phase.owner]);

export const buildResourceTableRows = (resources: Resource[]) =>
  resources.map((resource) => [resource.source, resource.title, resource.moduleId, resource.description, resource.updatedAt]);

export const findInitialExpandedModuleId = (modules: Module[]) => modules[0]?.id ?? null;
