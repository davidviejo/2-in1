import { KPI, Resource } from '@/types/metodologia';

export const metodologiaTabs = ['Documentación', 'Enlazado interno', 'URLs clave', 'Plantillas', 'KPIs', 'Notas rápidas'] as const;
export type MetodologiaTab = (typeof metodologiaTabs)[number];

export const getFilteredResourcesByTab = (activeTab: MetodologiaTab, resources: Resource[]): Resource[] => {
  const map: Record<MetodologiaTab, Resource[]> = {
    Documentación: resources,
    'Enlazado interno': resources.filter((r) => r.title.toLowerCase().includes('enlazado') || r.title.toLowerCase().includes('link')),
    'URLs clave': resources.filter((r) => r.title.toLowerCase().includes('sitemap') || r.title.toLowerCase().includes('dashboard')),
    Plantillas: resources.filter((r) => r.title.toLowerCase().includes('brief') || r.title.toLowerCase().includes('checklist')),
    KPIs: resources.filter((r) => r.title.toLowerCase().includes('dashboard')),
    'Notas rápidas': [],
  };
  return map[activeTab] ?? [];
};

export const getKpiByLabel = (kpis: KPI[], label: string) => kpis.find((kpi) => kpi.label === label);
