import React from 'react';
import {
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

const kpiCards = [
  { title: '8 fases', subtitle: 'Proceso completo', icon: Layers, accent: 'text-blue-600 bg-blue-50' },
  { title: '12 recursos', subtitle: 'Material de apoyo', icon: BookOpen, accent: 'text-emerald-600 bg-emerald-50' },
  { title: '6 documentos', subtitle: 'Documentación base', icon: Files, accent: 'text-violet-600 bg-violet-50' },
  { title: '4 enlaces clave', subtitle: 'Accesos rápidos', icon: LinkIcon, accent: 'text-sky-600 bg-sky-50' },
] as const;

const methodologyPhases = [
  { title: 'Kickoff', description: 'Alineamos objetivos, alcance, responsables y contexto del proyecto.', chips: ['Objetivos', 'Stakeholders'], icon: Flag },
  { title: 'Auditoría inicial', description: 'Analizamos el estado actual del sitio a nivel técnico, contenido y arquitectura.', chips: ['SEO técnico', 'Contenidos'], icon: Search },
  { title: 'Puntos de control', description: 'Definimos checkpoints para supervisar calidad, prioridades y evolución.', chips: ['KPIs', 'Revisión'], icon: ListChecks },
  { title: 'Plan de acción', description: 'Traducimos los hallazgos en acciones priorizadas, responsables y timings.', chips: ['Roadmap', 'Prioridades'], icon: Milestone },
  { title: 'Desglose web', description: 'Estructuramos la web por áreas, URLs, verticales o bloques de trabajo.', chips: ['Arquitectura', 'URLs'], icon: Map },
  { title: 'Implementación', description: 'Ejecutamos los cambios técnicos, editoriales y estratégicos definidos.', chips: ['Cambios', 'Producción'], icon: Wrench },
  { title: 'Validación', description: 'Comprobamos que las mejoras estén correctamente aplicadas y midiendo.', chips: ['QA', 'Seguimiento'], icon: Target },
  { title: 'Mejora continua', description: 'Iteramos, refinamos y ampliamos el trabajo según resultados y aprendizaje.', chips: ['Optimización', 'Iteración'], icon: Sparkles },
] as const;

const featuredResources = [
  { name: 'Brief inicial del proyecto', description: 'Documento base · Google Docs', icon: FileText },
  { name: 'Checklist de auditoría', description: 'Hoja de cálculo · Google Sheets', icon: ListChecks },
  { name: 'Roadmap estratégico', description: 'Documento de trabajo · Google Docs', icon: Milestone },
  { name: 'Mapa de URLs y verticales', description: 'Documento operativo · Sheet', icon: Map },
  { name: 'Panel de control SEO', description: 'Dashboard de seguimiento', icon: Rocket },
] as const;

const deepDiveResources = [
  { name: 'Brief inicial del proyecto', description: 'Documento de arranque con contexto, objetivos y alcance.', type: 'Google Docs', linkText: 'Abrir documento', usage: 'Kickoff' },
  { name: 'Checklist de auditoría SEO', description: 'Listado técnico y editorial para revisar el sitio.', type: 'Google Sheets', linkText: 'Abrir sheet', usage: 'Auditoría inicial' },
  { name: 'Plantilla de puntos de control', description: 'Guía para registrar revisiones y checkpoints clave.', type: 'Google Docs', linkText: 'Abrir documento', usage: 'Puntos de control' },
  { name: 'Roadmap y plan de acción', description: 'Planificación priorizada con responsables y timings.', type: 'Google Docs', linkText: 'Abrir documento', usage: 'Plan de acción' },
  { name: 'Desglose de arquitectura web', description: 'Documento con URLs, taxonomía y estructura del sitio.', type: 'Sheet / Docs', linkText: 'Abrir recurso', usage: 'Desglose web' },
  { name: 'Checklist de implementación', description: 'Seguimiento de tareas ejecutadas y control de cambios.', type: 'Google Sheets', linkText: 'Abrir sheet', usage: 'Implementación' },
  { name: 'Documento de validación', description: 'QA, revisión de resultados y comprobaciones finales.', type: 'Google Docs', linkText: 'Abrir documento', usage: 'Validación' },
  { name: 'Backlog de mejora continua', description: 'Listado de aprendizajes, optimizaciones y siguientes pasos.', type: 'Notion / Docs', linkText: 'Abrir recurso', usage: 'Mejora continua' },
] as const;

const resourceTabs = ['Documentación', 'Sheets', 'Enlaces', 'Plantillas'] as const;

const MetodologiaPage: React.FC = () => {
  return (
    <section className="space-y-6 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <header id="estructura" className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Aplicación de la metodología</h1>
            <p className="max-w-4xl text-sm text-muted-foreground md:text-base">
              Explica de forma clara cómo se aplica la metodología, de inicio a fin, y centraliza los recursos de apoyo para profundizar en cada etapa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>+ Añadir recurso</Button>
            <Button variant="secondary">Editar contenido</Button>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),340px]" id="fases">
        <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-foreground">Cómo aplicamos la metodología</h2>
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="grid min-w-[980px] grid-cols-8 gap-4">
              {methodologyPhases.map((phase, index) => {
                const Icon = phase.icon;
                return (
                  <div key={phase.title} className="relative rounded-xl border border-border bg-slate-50/70 p-4">
                    {index < methodologyPhases.length - 1 && (
                      <span className="pointer-events-none absolute left-[calc(100%-8px)] top-8 hidden h-px w-4 border-t border-dashed border-slate-300 lg:block" />
                    )}
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">{index + 1}</span>
                      <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600"><Icon size={15} /></span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{phase.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{phase.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {phase.chips.map((chip) => (
                        <span key={chip} className="rounded-full border border-border bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
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
                <a key={resource.name} href="#" className="flex items-start gap-3 rounded-xl border border-border bg-slate-50 p-3 hover:border-primary/30">
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
        <p className="mt-1 text-sm text-muted-foreground">Documentación, enlaces y materiales de apoyo vinculados a la metodología.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[820px] w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Nombre</th><th className="px-3 py-3">Descripción</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Enlace</th><th className="px-3 py-3">Uso recomendado</th>
              </tr>
            </thead>
            <tbody>
              {deepDiveResources.map((resource) => (
                <tr key={resource.name} className="border-b border-border/70 align-top">
                  <td className="px-3 py-3 font-medium text-foreground">{resource.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{resource.description}</td>
                  <td className="px-3 py-3 text-slate-600">{resource.type}</td>
                  <td className="px-3 py-3">
                    <a href="#" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      {resource.linkText}
                      <ExternalLink size={13} />
                    </a>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{resource.usage}</td>
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
