import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BookOpen,
  FileText,
  Files,
  Flag,
  Layers,
  Link as LinkIcon,
  ListChecks,
  Map,
  Milestone,
  Rocket,
  Search,
  Sparkles,
  Target,
  Wrench,
} from 'lucide-react';
import { AdvancedMethodCtaPanel } from '@/components/metodologia/AdvancedMethodCtaPanel';
import { AdvancedMethodNavigationMap } from '@/components/metodologia/AdvancedMethodNavigationMap';
import { AdvancedMethodOverview } from '@/components/metodologia/AdvancedMethodOverview';
import { AdvancedMethodNextSteps } from '@/components/metodologia/AdvancedMethodNextSteps';
import { AdvancedMethodPhases } from '@/components/metodologia/AdvancedMethodPhases';
import { AdvancedMethodPrioritization } from '@/components/metodologia/AdvancedMethodPrioritization';
import { AdvancedMethodRealContext } from '@/components/metodologia/AdvancedMethodRealContext';
import { AdvancedMethodStatus } from '@/components/metodologia/AdvancedMethodStatus';
import { AdvancedToolsGovernanceSummary } from '@/components/metodologia/AdvancedToolsGovernanceSummary';
import { AdvancedToolRadar } from '@/components/metodologia/AdvancedToolRadar';
import { MethodologyHeader } from '@/components/metodologia/MethodologyHeader';
import { MethodologyProcessTimeline } from '@/components/metodologia/MethodologyProcessTimeline';
import { MethodologySectionNav } from '@/components/metodologia/MethodologySectionNav';
import {
  MethodologyResource,
  MethodologyResourcesPanel,
  MethodologyResourcesTable,
} from '@/components/metodologia/MethodologyResources';
import { SeoQueueConcept } from '@/components/metodologia/SeoQueueConcept';
import { SeoQueueDryRunPanel } from '@/components/metodologia/SeoQueueDryRunPanel';
import { SeoQueueGovernanceReadiness } from '@/components/metodologia/SeoQueueGovernanceReadiness';
import { SeoQueuePilotSelector } from '@/components/metodologia/SeoQueuePilotSelector';

const kpiCards = [
  {
    title: '8 fases',
    subtitle: 'Proceso completo',
    icon: Layers,
    accent: 'text-blue-600 bg-blue-50',
  },
  {
    title: '12 recursos',
    subtitle: 'Material de apoyo',
    icon: BookOpen,
    accent: 'text-emerald-600 bg-emerald-50',
  },
  {
    title: '6 documentos',
    subtitle: 'Documentación base',
    icon: Files,
    accent: 'text-violet-600 bg-violet-50',
  },
  {
    title: '4 enlaces clave',
    subtitle: 'Accesos rápidos',
    icon: LinkIcon,
    accent: 'text-sky-600 bg-sky-50',
  },
] as const;

const methodologyPhases = [
  {
    title: 'Kickoff',
    description: 'Alineamos objetivos, alcance, responsables y contexto del proyecto.',
    chips: ['Objetivos', 'Stakeholders'],
    icon: Flag,
  },
  {
    title: 'Auditoría inicial',
    description: 'Analizamos el estado actual del sitio a nivel técnico, contenido y arquitectura.',
    chips: ['SEO técnico', 'Contenidos'],
    icon: Search,
  },
  {
    title: 'Puntos de control',
    description: 'Definimos checkpoints para supervisar calidad, prioridades y evolución.',
    chips: ['KPIs', 'Revisión'],
    icon: ListChecks,
  },
  {
    title: 'Plan de acción',
    description: 'Traducimos los hallazgos en acciones priorizadas, responsables y timings.',
    chips: ['Roadmap', 'Prioridades'],
    icon: Milestone,
  },
  {
    title: 'Desglose web',
    description: 'Estructuramos la web por áreas, URLs, verticales o bloques de trabajo.',
    chips: ['Arquitectura', 'URLs'],
    icon: Map,
  },
  {
    title: 'Implementación',
    description: 'Ejecutamos los cambios técnicos, editoriales y estratégicos definidos.',
    chips: ['Cambios', 'Producción'],
    icon: Wrench,
  },
  {
    title: 'Validación',
    description: 'Comprobamos que las mejoras estén correctamente aplicadas y midiendo.',
    chips: ['QA', 'Seguimiento'],
    icon: Target,
  },
  {
    title: 'Mejora continua',
    description: 'Iteramos, refinamos y ampliamos el trabajo según resultados y aprendizaje.',
    chips: ['Optimización', 'Iteración'],
    icon: Sparkles,
  },
] as const;

const initialDeepDiveResources: MethodologyResource[] = [
  {
    name: 'Brief inicial del proyecto',
    description: 'Documento de arranque con contexto, objetivos y alcance.',
    type: 'Google Docs',
    linkText: 'Abrir documento',
    usage: 'Kickoff',
  },
  {
    name: 'Checklist de auditoría SEO',
    description: 'Listado técnico y editorial para revisar el sitio.',
    type: 'Google Sheets',
    linkText: 'Abrir sheet',
    usage: 'Auditoría inicial',
  },
  {
    name: 'Plantilla de puntos de control',
    description: 'Guía para registrar revisiones y checkpoints clave.',
    type: 'Google Docs',
    linkText: 'Abrir documento',
    usage: 'Puntos de control',
  },
  {
    name: 'Roadmap y plan de acción',
    description: 'Planificación priorizada con responsables y timings.',
    type: 'Google Docs',
    linkText: 'Abrir documento',
    usage: 'Plan de acción',
  },
  {
    name: 'Desglose de arquitectura web',
    description: 'Documento con URLs, taxonomía y estructura del sitio.',
    type: 'Sheet / Docs',
    linkText: 'Abrir recurso',
    usage: 'Desglose web',
  },
  {
    name: 'Checklist de implementación',
    description: 'Seguimiento de tareas ejecutadas y control de cambios.',
    type: 'Google Sheets',
    linkText: 'Abrir sheet',
    usage: 'Implementación',
  },
  {
    name: 'Documento de validación',
    description: 'QA, revisión de resultados y comprobaciones finales.',
    type: 'Google Docs',
    linkText: 'Abrir documento',
    usage: 'Validación',
  },
  {
    name: 'Backlog de mejora continua',
    description: 'Listado de aprendizajes, optimizaciones y siguientes pasos.',
    type: 'Notion / Docs',
    linkText: 'Abrir recurso',
    usage: 'Mejora continua',
  },
];

const resourceTabs = ['Documentación', 'Sheets', 'Enlaces', 'Plantillas'] as const;

const levelBadgeVariant: Record<AdvancedMethodLevel, 'success' | 'warning' | 'danger'> = {
  Alto: 'danger',
  Medio: 'warning',
  Bajo: 'success',
};

const MetodologiaPage: React.FC = () => {
  const [deepDiveResources, setDeepDiveResources] = useState(initialDeepDiveResources);

  const featuredResources = useMemo(
    () =>
      deepDiveResources.slice(0, 5).map((resource, index) => ({
        name: resource.name,
        description: `${resource.type} · ${resource.usage}`,
        icon: [FileText, ListChecks, Milestone, Map, Rocket][index] ?? BookOpen,
      })),
    [deepDiveResources],
  );

  const addResource = () => {
    const name = window.prompt('Nombre del recurso');
    if (!name) return;
    const description = window.prompt('Descripción del recurso') ?? 'Sin descripción';
    const type = window.prompt('Tipo (Google Docs, Sheet, Notion, etc.)') ?? 'Documento';
    const usage = window.prompt('Uso recomendado (fase)') ?? 'General';
    const linkText = window.prompt('Texto del enlace') ?? 'Abrir recurso';

    setDeepDiveResources((prev) => [...prev, { name, description, type, linkText, usage }]);
  };

  const editResource = (resourceName: string) => {
    setDeepDiveResources((prev) =>
      prev.map((resource) => {
        if (resource.name !== resourceName) return resource;
        const name = window.prompt('Nombre del recurso', resource.name) ?? resource.name;
        const description =
          window.prompt('Descripción', resource.description) ?? resource.description;
        const type = window.prompt('Tipo', resource.type) ?? resource.type;
        const usage = window.prompt('Uso recomendado', resource.usage) ?? resource.usage;
        const linkText = window.prompt('Texto del enlace', resource.linkText) ?? resource.linkText;
        return { ...resource, name, description, type, usage, linkText };
      }),
    );
  };

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <MethodologyHeader
        kpiCards={kpiCards}
        onAddResource={addResource}
        onEditFirstResource={() => editResource(deepDiveResources[0]?.name ?? '')}
      />

      <MethodologySectionNav />
      <AdvancedMethodOverview />
      <AdvancedMethodStatus />
      <AdvancedMethodRealContext />
      <AdvancedMethodPrioritization />
      <AdvancedToolsGovernanceSummary />
      <AdvancedMethodNavigationMap />
      <AdvancedMethodCtaPanel />
      <AdvancedMethodPhases />
      <AdvancedToolRadar />
      <SeoQueueConcept />
      <SeoQueueDryRunPanel />
      <SeoQueuePilotSelector />
      <SeoQueueGovernanceReadiness />
      <AdvancedMethodNextSteps />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),370px]">
        <MethodologyProcessTimeline phases={methodologyPhases} />
        <MethodologyResourcesPanel
          resourceTabs={resourceTabs}
          featuredResources={featuredResources}
        />
      </div>

      <MethodologyResourcesTable resources={deepDiveResources} onEditResource={editResource} />
    </section>
  );
};

export default MetodologiaPage;
