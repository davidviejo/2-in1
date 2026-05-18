import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CircleDashed,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Layers,
  Link2,
  ListTodo,
  MoreHorizontal,
  NotebookText,
  PencilRuler,
  Share2,
  Target,
  TrendingUp,
  Workflow,
  Wrench,
  BarChart3,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastContext';
import { useLocation } from 'react-router-dom';

const kpis = [
  { label: 'módulos', value: '8', subtitle: 'Estructura definida', icon: Layers },
  { label: 'fases', value: '7', subtitle: 'De principio a fin', icon: Workflow },
  { label: 'recursos', value: '24', subtitle: 'Documentación y guías', icon: BookOpen },
  { label: 'enlaces internos', value: '12', subtitle: 'Referencias activas', icon: Link2 },
];

const modules = [
  { id: 'M1', title: 'Auditoría inicial', description: 'Análisis del estado actual del sitio y detección de oportunidades.', status: 'Completado', docs: 6, links: 3 },
  { id: 'M2', title: 'Estrategia y verticales', description: 'Definición de verticales, segmentos y priorización de acciones.', status: 'En progreso', docs: 5, links: 2 },
  { id: 'M3', title: 'SEO editorial', description: 'Plan editorial, clusters y optimización de contenido.', status: 'En progreso', docs: 4, links: 2 },
  { id: 'M4', title: 'Técnico avanzado', description: 'Rendimiento, indexabilidad, datos estructurados y arquitectura.', status: 'Pendiente', docs: 3, links: 1 },
  { id: 'M5', title: 'Autoridad y E-E-A-T', description: 'Señales de autoridad, reputación y experiencia demostrada.', status: 'Pendiente', docs: 3, links: 2 },
  { id: 'M6', title: 'Distribución y enlaces', description: 'Link building, PR digital y estrategias de distribución.', status: 'Pendiente', docs: 3, links: 2 },
  { id: 'M7', title: 'Medición y reporting', description: 'Consolidación de KPIs, tableros y seguimiento de evolución.', status: 'Pendiente', docs: 2, links: 1 },
  { id: 'M8', title: 'Escalado y optimización', description: 'Iteración continua y mejora de procesos para escalar resultados.', status: 'Pendiente', docs: 2, links: 1 },
];

const phases = [
  { title: 'Descubrimiento', desc: 'Recopilación de contexto, objetivos, stakeholders y recursos existentes.', deliverables: ['Brief inicial', 'Mapa de stakeholders'], status: 'Completado', icon: Target },
  { title: 'Auditoría inicial', desc: 'Revisión SEO técnica, contenidos, arquitectura y rendimiento.', deliverables: ['Informe de auditoría', 'Checklist técnico'], status: 'En progreso', icon: CircleDashed },
  { title: 'Priorización', desc: 'Ordenamos hallazgos según impacto, esfuerzo y dependencia.', deliverables: ['Matriz ICE', 'Backlog priorizado'], status: 'En progreso', icon: TrendingUp },
  { title: 'Plan de acción', desc: 'Definimos roadmap, responsables, timings y entregables.', deliverables: ['Roadmap trimestral', 'Plan de acción'], status: 'Pendiente', icon: PencilRuler },
  { title: 'Implementación', desc: 'Ejecución de cambios técnicos, editoriales y de enlazado interno.', deliverables: ['Cambios implementados', 'Registro de tareas'], status: 'Pendiente', icon: Wrench },
  { title: 'Validación', desc: 'Comprobación de resultados, QA y seguimiento de KPIs.', deliverables: ['Informe de validación', 'Dashboard temporal'], status: 'Pendiente', icon: ListTodo },
  { title: 'Mejora continua', desc: 'Iteración, aprendizaje y optimización recurrente.', deliverables: ['Lecciones aprendidas', 'Backlog iterativo'], status: 'Pendiente', icon: BarChart3 },
];

const tabs = ['Documentación', 'Enlazado interno', 'URLs clave', 'Plantillas', 'KPIs', 'Notas rápidas'];

const resources = [
  { title: 'Guía de Metodología SEO - v2.1', meta: 'Google Docs · Actualizado hace 5 días', type: 'doc' },
  { title: 'Brief inicial del proyecto', meta: 'Documento · v1.2', type: 'doc' },
  { title: 'Checklist de auditoría', meta: 'Hoja de cálculo · v1.1', type: 'sheet' },
  { title: 'Roadmap trimestral', meta: 'Documento · v1.0', type: 'doc' },
  { title: 'Plan de enlazado interno', meta: 'Documento · v1.0', type: 'doc' },
  { title: 'Dashboard de seguimiento', meta: 'Hoja de cálculo · v1.3', type: 'chart' },
];

const tabResources: Record<string, typeof resources> = {
  Documentación: resources,
  'Enlazado interno': resources.filter((resource) => resource.title.toLowerCase().includes('enlazado') || resource.title.toLowerCase().includes('link')),
  'URLs clave': resources.filter((resource) => resource.title.toLowerCase().includes('sitemap') || resource.title.toLowerCase().includes('dashboard')),
  Plantillas: resources.filter((resource) => resource.title.toLowerCase().includes('brief') || resource.title.toLowerCase().includes('checklist')),
  KPIs: resources.filter((resource) => resource.title.toLowerCase().includes('dashboard')),
  'Notas rápidas': [],
};

const MetodologiaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Documentación');
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(modules[0].id);
  const { info, successAction } = useToast();
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const openResource = (title: string) => {
    const query = encodeURIComponent(title);
    window.open(`https://drive.google.com/drive/search?q=${query}`, '_blank', 'noopener,noreferrer');
    successAction('Recurso abierto', `Abriendo búsqueda en Drive para "${title}".`);
  };

  const shareResource = async (title: string) => {
    const text = `Recurso metodología: ${title}`;
    if (navigator.share) {
      await navigator.share({ title, text });
      successAction('Compartido', `Has compartido "${title}".`);
      return;
    }
    await navigator.clipboard.writeText(text);
    successAction('Compartido', 'Copiamos los datos al portapapeles para compartir.');
  };

  const copyResource = async (title: string) => {
    const query = encodeURIComponent(title);
    await navigator.clipboard.writeText(`https://drive.google.com/drive/search?q=${query}`);
    successAction('Enlace copiado', `Copiado el acceso para "${title}".`);
  };

  const statusClass = useMemo(() => ({
    Completado: 'success',
    'En progreso': 'warning',
    Pendiente: 'default',
  } as const), []);

  const getResourceIcon = (type: string) => {
    if (type === 'sheet') return <FileSpreadsheet size={16} className="text-emerald-600" />;
    if (type === 'chart') return <BarChart3 size={16} className="text-violet-600" />;
    return <FileText size={16} className="text-blue-600" />;
  };

  const filteredResources = tabResources[activeTab] ?? [];

  return (
    <div className="space-y-6 overflow-x-hidden text-slate-800">
      <section id="resumen" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Metodología</h1>
            <p className="mt-2 text-sm text-slate-600">Centraliza el proceso de trabajo, documentación y recursos estratégicos compartidos por todos los proyectos.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => successAction('Recurso en creación', 'Abrimos el flujo para añadir un nuevo recurso.')}>+ Añadir recurso</Button>
            <Button variant="secondary" onClick={() => info('Editor de estructura', 'Aquí podrás reordenar módulos y fases en los próximos pasos.')}>Editar estructura</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-blue-700">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{item.value} <span className="text-base font-semibold text-slate-700">{item.label}</span></p>
                  <p className="text-xs text-slate-500">{item.subtitle}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section id="estructura" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Estructura de la metodología</h2>
            <div className="mt-4 space-y-3">
              {modules.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <GripVertical size={16} className="text-slate-400" />
                    <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">{m.id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{m.title}</p>
                      <p className="text-sm text-slate-600">{m.description}</p>
                    </div>
                    <Badge variant={statusClass[m.status as keyof typeof statusClass]}>{m.status}</Badge>
                    <span className="text-xs text-slate-500">{m.docs} docs · {m.links} enlaces</span>
                    <button
                      type="button"
                      onClick={() => setExpandedModuleId((current) => (current === m.id ? null : m.id))}
                      className="rounded-md p-1 transition hover:bg-slate-200"
                      title={expandedModuleId === m.id ? 'Ocultar detalle' : 'Ver detalle'}
                    >
                      <ChevronDown size={16} className={`text-slate-400 transition ${expandedModuleId === m.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {expandedModuleId === m.id && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p><span className="font-semibold">Estado:</span> {m.status}</p>
                      <p><span className="font-semibold">Documentos:</span> {m.docs}</p>
                      <p><span className="font-semibold">Enlaces:</span> {m.links}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section id="fases" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Cómo aplicamos la metodología</h2>
            <div className="mt-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {phases.map((phase, idx) => {
                  const Icon = phase.icon;
                  return (
                    <div key={phase.title} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      
                      <div className="mb-3 flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{idx + 1}</span>
                        <Badge variant={statusClass[phase.status as keyof typeof statusClass]}>{phase.status}</Badge>
                      </div>
                      <Icon size={22} className="mb-2 text-violet-600" />
                      <p className="font-semibold text-slate-900">{phase.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{phase.desc}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Entregables</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-700">
                        {phase.deliverables.map((deliverable) => <li key={deliverable}>• {deliverable}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside id="recursos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recursos y documentación</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-full px-3 py-1 text-xs font-medium ${activeTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {filteredResources.map((resource) => (
              <article key={resource.title} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getResourceIcon(resource.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{resource.title}</p>
                    <p className="text-xs text-slate-500">{resource.meta}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openResource(resource.title)}
                    title="Abrir recurso"
                    className="rounded p-1 transition hover:bg-slate-100"
                  >
                    <ExternalLink size={14} className="text-slate-400" />
                  </button>
                </div>
              </article>
            ))}
            {filteredResources.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                No hay recursos para esta pestaña todavía.
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => setActiveTab('Documentación')}
          >
            Ver todos los recursos
          </Button>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Detalle por fase</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Fase</th><th className="px-3 py-2">Objetivo</th><th className="px-3 py-2">Acciones clave</th><th className="px-3 py-2">Entregables</th><th className="px-3 py-2">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Descubrimiento', 'Entender el negocio, objetivos y contexto del proyecto.', 'Kickoff · Entrevistas · Inventario de activos · Benchmark', 'Brief inicial · Mapa de stakeholders', 'Estratega SEO'],
                ['Auditoría inicial', 'Detectar oportunidades y problemas actuales.', 'Crawl · Logs · CWV · Contenidos · Arquitectura', 'Informe de auditoría · Checklist técnico', 'Analista Técnico'],
                ['Priorización', 'Focalizar en lo que genera más impacto.', 'Impacto · Esfuerzo · Dependencias · Matriz ICE', 'Matriz ICE · Backlog priorizado', 'Estratega SEO'],
                ['Plan de acción', 'Convertir prioridades en un plan ejecutable.', 'Roadmap · Recursos · Timings · Entregables', 'Roadmap trimestral · Plan de acción', 'Project Manager'],
                ['Implementación', 'Ejecutar cambios y mejoras planificadas.', 'Técnicos · Contenidos · Enlazado interno', 'Cambios implementados · Registro de tareas', 'Desarrollador'],
                ['Validación', 'Verificar resultados y asegurar calidad.', 'QA · Tests · KPIs · Monitorización', 'Informe de validación · Dashboard temporal', 'Analista SEO'],
                ['Mejora continua', 'Aprender y optimizar de forma recurrente.', 'Análisis · Iteración · Heurísticas · Experimentación', 'Lecciones aprendidas · Backlog iterativo', 'Estratega SEO'],
              ].map((row) => (
                <tr key={row[0]} className="border-b border-slate-100 align-top">
                  {row.map((cell) => <td key={cell} className="px-3 py-3 text-slate-700">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Biblioteca de recursos</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Título</th><th className="px-3 py-2">Módulo</th><th className="px-3 py-2">Descripción</th><th className="px-3 py-2">Última actualización</th><th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Google Docs', 'Guía de Metodología SEO - v2.1', 'M1', 'Manual completo de la metodología y estándares comunes para todos los proyectos.', '12 mayo 2026 · Laura P.', 'abrir'],
                ['Notion', 'Sitemap Maestro & Taxonomía', 'M2', 'Estructura de sitemap y taxonomía por verticales.', '09 mayo 2026 · Ana R.', 'compartir'],
                ['Google Docs', 'Brief Editorial - Plantilla', 'M3', 'Plantilla para la creación de briefs editoriales.', '07 mayo 2026 · Carlos T.', 'copiar'],
                ['Google Sheets', 'Plan de Enlazado Interno', 'M5', 'Estrategia de anchor text y asignación de enlaces.', '11 mayo 2026 · Marta L.', 'abrir'],
                ['PDF', 'Checklist Técnico Avanzado', 'M4', 'Lista de verificación técnica para auditorías avanzadas.', '03 mayo 2026 · Diego F.', 'compartir'],
                ['Google Docs', 'Plan de Link Building 2026', 'M6', 'Estrategias, partners y tácticas de link building.', '14 mayo 2026 · Paula G.', 'más'],
              ].map((row) => (
                <tr key={row[1]} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3"><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"><NotebookText size={13} />{row[0]}</span></td>
                  <td className="px-3 py-3 font-medium text-slate-900">{row[1]}</td>
                  <td className="px-3 py-3"><Badge variant="info">{row[2]}</Badge></td>
                  <td className="px-3 py-3 text-slate-700">{row[3]}</td>
                  <td className="px-3 py-3 text-slate-600">{row[4]}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <button type="button" title="Abrir" onClick={() => openResource(row[1])}><ExternalLink size={14} /></button>
                      <button type="button" title="Compartir" onClick={() => void shareResource(row[1])}><Share2 size={14} /></button>
                      <button type="button" title="Copiar enlace" onClick={() => void copyResource(row[1])}><Copy size={14} /></button>
                      <button type="button" title="Más" onClick={() => info('Más opciones', `Acción: más opciones para "${row[1]}".`)}><MoreHorizontal size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default MetodologiaPage;
