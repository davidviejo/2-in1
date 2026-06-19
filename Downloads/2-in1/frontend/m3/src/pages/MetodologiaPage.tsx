import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BookOpen,
  ExternalLink,
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
  Settings,
  Sparkles,
  Target,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  advancedMethodNavigation,
  advancedMethodOverview,
  advancedMethodPhases,
  advancedToolCandidates,
  futureSeoQueueWorkflow,
  AdvancedMethodLevel,
} from '@/config/seoAdvancedMethod';

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

const initialDeepDiveResources = [
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
    <section className="space-y-6 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <header id="estructura" className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
              Aplicación de la metodología
            </h1>
            <p className="max-w-4xl text-sm text-muted-foreground md:text-base">
              Explica de forma clara cómo se aplica la metodología, de inicio a fin, y centraliza
              los recursos de apoyo para profundizar en cada etapa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addResource}>+ Añadir recurso</Button>
            <Button
              variant="secondary"
              onClick={() => editResource(deepDiveResources[0]?.name ?? '')}
            >
              Editar primer recurso
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map(({ title, subtitle, icon: Icon, accent }) => (
            <Card key={title} className="border-border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>
                <span className={`rounded-xl p-2 ${accent}`}>
                  <Icon size={18} />
                </span>
              </div>
            </Card>
          ))}
        </div>
      </header>

      <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="metodo-seo-avanzado-2026">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl space-y-3">
            <Badge variant="primary">Framework transversal</Badge>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                {advancedMethodOverview.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
                {advancedMethodOverview.subtitle}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {advancedMethodOverview.principles.map((principle) => (
                <div
                  key={principle}
                  className="rounded-xl border border-border bg-surface-alt p-3 text-sm text-muted-foreground"
                >
                  {principle}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt p-4 lg:max-w-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity size={16} className="text-primary" />
              Centro de control metodológico
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Esta fase solo documenta y conecta áreas existentes. No ejecuta automatizaciones, no
              crea endpoints y no duplica tareas, roadmap, Kanban, Gantt, Tools Hub ni Intelligence.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Dónde se ejecuta cada parte</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mapa transversal para usar el método sin crear una sección monolítica nueva.
            </p>
          </div>
          <Badge variant="neutral">Navegación existente</Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {advancedMethodNavigation.map((item) => (
            <Link
              key={`${item.title}-${item.route.path}`}
              to={item.route.path}
              className="group rounded-xl border border-border bg-surface-alt p-4 transition hover:border-primary/40 hover:bg-surface"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant={item.route.area === 'Workflow' ? 'warning' : 'primary'}>
                    {item.route.area}
                  </Badge>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h3>
                </div>
                <ArrowRight
                  size={16}
                  className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              <span className="mt-3 inline-flex text-xs font-semibold text-primary">
                {item.route.label}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Fases avanzadas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fases, criterios, entregables y conexiones operativas definidos desde configuración
              tipada.
            </p>
          </div>
          <Badge variant="success">{advancedMethodPhases.length} fases conectadas</Badge>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {advancedMethodPhases.map((phase, index) => (
            <article key={phase.id} className="rounded-xl border border-border bg-surface-alt p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{phase.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {phase.relatedRoutes.map((route) => (
                    <Link key={`${phase.id}-${route.path}`} to={route.path}>
                      <Badge variant="neutral">{route.label}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{phase.objective}</p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Criterios de entrada
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                    {phase.entryCriteria.map((criterion) => (
                      <li key={criterion}>• {criterion}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Criterios de salida
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                    {phase.exitCriteria.map((criterion) => (
                      <li key={criterion}>• {criterion}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Acciones recomendadas
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {phase.recommendedActions.join(' · ')}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Entregables esperados
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {phase.expectedDeliverables.join(' · ')}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Herramientas relacionadas
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {phase.relatedTools.join(' · ')}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Riesgos / checkpoints
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {phase.risksAndCheckpoints.join(' · ')}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-border bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Workflows futuros sugeridos
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {phase.futureWorkflows.join(' · ')}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Card>

      <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Radar de herramientas avanzadas
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Inventario candidato para futuras fases. Es visual y configurado en frontend; no
              implementa ejecución real.
            </p>
          </div>
          <Badge variant="warning">Solo propuesta</Badge>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Herramienta</th>
                <th className="px-3 py-3">Impacto</th>
                <th className="px-3 py-3">Dificultad</th>
                <th className="px-3 py-3">Dependencias</th>
                <th className="px-3 py-3">Riesgo</th>
                <th className="px-3 py-3">Reutilización</th>
                <th className="px-3 py-3">Prioridad</th>
                <th className="px-3 py-3">Dónde vive</th>
              </tr>
            </thead>
            <tbody>
              {advancedToolCandidates.map((tool) => (
                <tr key={tool.id} className="border-b border-border/70 align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground">{tool.name}</p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                      {tool.description}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={levelBadgeVariant[tool.seoImpact]}>{tool.seoImpact}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={levelBadgeVariant[tool.technicalDifficulty]}>
                      {tool.technicalDifficulty}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {tool.dependencies.join(' · ')}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={levelBadgeVariant[tool.risk]}>{tool.risk}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={levelBadgeVariant[tool.existingCodeReuse]}>
                      {tool.existingCodeReuse}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge
                      variant={
                        tool.suggestedPriority === 'P1'
                          ? 'success'
                          : tool.suggestedPriority === 'P2'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {tool.suggestedPriority}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-foreground">{tool.shouldLiveIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <Badge variant="warning">Fase futura</Badge>
            <h2 className="mt-3 text-xl font-semibold text-foreground">
              Automatización semiasistida / Cola SEO
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              Esta sección deja preparada la dirección de producto: en fases posteriores podrá
              ejecutar acciones secuenciales, acciones paralelas seguras, dry-run, logs, errores,
              reintentos, pausas, revisión humana y envío de resultados a tareas, roadmap o
              entregables. En Fase 1A no ejecuta nada.
            </p>
          </div>
          <Link to="/app/kanban">
            <Button variant="secondary">Ver ejecución actual</Button>
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr),360px]">
          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">
                {futureSeoQueueWorkflow.title}
              </h3>
              <Badge variant="neutral">{futureSeoQueueWorkflow.statusLabel}</Badge>
            </div>
            <ol className="mt-4 grid gap-2 md:grid-cols-2">
              {futureSeoQueueWorkflow.steps.map((step, index) => (
                <li
                  key={step}
                  className="rounded-lg border border-border bg-white p-3 text-sm text-muted-foreground"
                >
                  <span className="mr-2 font-semibold text-primary">{index + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-dashed border-border bg-surface-alt p-4">
            <h3 className="text-base font-semibold text-foreground">Guardrails previstos</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>• Modo dry-run antes de cualquier ejecución real.</li>
              <li>• Confirmación humana para acciones sensibles.</li>
              <li>• Logs y trazabilidad por paso.</li>
              <li>• Reintentos y pausas controladas.</li>
              <li>• Integración con Kanban, roadmap y entregables existentes.</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),370px]" id="fases">
        <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-foreground">Cómo aplicamos la metodología</h2>
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="grid min-w-[1100px] grid-cols-8 gap-5">
              {methodologyPhases.map((phase, index) => {
                const Icon = phase.icon;
                return (
                  <div
                    key={phase.title}
                    className="relative rounded-xl border border-border bg-slate-50/70 p-5"
                  >
                    {index < methodologyPhases.length - 1 && (
                      <span className="pointer-events-none absolute left-[calc(100%-8px)] top-8 hidden h-px w-4 border-t border-dashed border-slate-300 lg:block" />
                    )}
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
                        {index + 1}
                      </span>
                      <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
                        <Icon size={15} />
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{phase.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {phase.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {phase.chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card id="recursos" className="border-border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Recursos destacados</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {resourceTabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-medium ${index === 0 ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-slate-50 text-muted-foreground'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {featuredResources.map((resource) => {
              const Icon = resource.icon;
              return (
                <a
                  key={resource.name}
                  href="#"
                  className="flex items-start gap-3 rounded-xl border border-border bg-slate-50 p-3 hover:border-primary/30"
                >
                  <span className="mt-0.5 rounded-lg bg-white p-2 text-primary shadow-sm">
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{resource.name}</p>
                    <p className="text-xs text-muted-foreground">{resource.description}</p>
                  </div>
                  <ExternalLink size={14} className="mt-1 text-muted-foreground" />
                </a>
              );
            })}
          </div>

          <Button variant="secondary" className="mt-4 w-full justify-center">
            Ver todos los recursos
          </Button>
        </Card>
      </div>

      <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-foreground">Recursos para profundizar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Documentación, enlaces y materiales de apoyo vinculados a la metodología.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Nombre</th>
                <th className="px-3 py-3">Descripción</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Enlace</th>
                <th className="px-3 py-3">Uso recomendado</th>
                <th className="px-3 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {deepDiveResources.map((resource) => (
                <tr key={resource.name} className="border-b border-border/70 align-top">
                  <td className="px-3 py-3 font-medium text-foreground">{resource.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{resource.description}</td>
                  <td className="px-3 py-3 text-slate-600">{resource.type}</td>
                  <td className="px-3 py-3">
                    <a
                      href="#"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {resource.linkText}
                      <ExternalLink size={13} />
                    </a>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{resource.usage}</td>
                  <td className="px-3 py-3">
                    <Button
                      variant="ghost"
                      className="h-auto px-0 text-xs"
                      onClick={() => editResource(resource.name)}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
};

export default MetodologiaPage;
