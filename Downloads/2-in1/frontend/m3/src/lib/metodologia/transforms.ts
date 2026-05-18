import { BookOpen, Layers, Link2, Workflow } from 'lucide-react';
import type { KPI, Module, Phase, Resource } from '@/types/metodologia';

export const metodologiaTabs = ['Documentación', 'Enlazado interno', 'URLs clave', 'Plantillas', 'KPIs', 'Notas rápidas'] as const;

const tabToTags: Record<(typeof metodologiaTabs)[number], string[]> = {
  Documentación: ['documentacion'],
  'Enlazado interno': ['enlazado'],
  'URLs clave': ['urls-clave'],
  Plantillas: ['plantillas'],
  KPIs: ['kpis'],
  'Notas rápidas': ['notas'],
};

export const buildMetodologiaKPIs = (modules: Module[], phases: Phase[], resources: Resource[]): KPI[] => {
  const totalLinks = modules.reduce((acc, item) => acc + item.links, 0);
  return [
    { key: 'modules', label: 'módulos', value: String(modules.length), subtitle: 'Estructura definida', icon: Layers },
    { key: 'phases', label: 'fases', value: String(phases.length), subtitle: 'De principio a fin', icon: Workflow },
    { key: 'resources', label: 'recursos', value: String(resources.length), subtitle: 'Documentación y guías', icon: BookOpen },
    { key: 'internal-links', label: 'enlaces internos', value: String(totalLinks), subtitle: 'Referencias activas', icon: Link2 },
  ];
};

export const getResourcesByTab = (resources: Resource[], tab: string): Resource[] => {
  const tags = tabToTags[tab as keyof typeof tabToTags];
  if (!tags) return resources;
  return resources.filter((resource) => resource.tags.some((tag) => tags.includes(tag)));
};
