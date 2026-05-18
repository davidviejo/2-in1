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
  Save,
  Loader2,
} from 'lucide-react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastContext';
import { useLocation } from 'react-router-dom';
import { metodologiaService } from '@/services/metodologiaService';

interface MethodologyModule {
  id: string;
  title: string;
  description: string;
  status: 'Completado' | 'En progreso' | 'Pendiente';
  docs: number;
  links: number;
  order: number;
}

interface MethodologyPhase {
  id: string;
  title: string;
  desc: string;
  deliverables: string[];
  status: 'Completado' | 'En progreso' | 'Pendiente';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  order: number;
}

const kpis = [
  { label: 'módulos', value: '8', subtitle: 'Estructura definida', icon: Layers },
  { label: 'fases', value: '7', subtitle: 'De principio a fin', icon: Workflow },
  { label: 'recursos', value: '24', subtitle: 'Documentación y guías', icon: BookOpen },
  { label: 'enlaces internos', value: '12', subtitle: 'Referencias activas', icon: Link2 },
];

const initialModules: MethodologyModule[] = [
  { id: 'M1', title: 'Auditoría inicial', description: 'Análisis del estado actual del sitio y detección de oportunidades.', status: 'Completado', docs: 6, links: 3, order: 1 },
  { id: 'M2', title: 'Estrategia y verticales', description: 'Definición de verticales, segmentos y priorización de acciones.', status: 'En progreso', docs: 5, links: 2, order: 2 },
  { id: 'M3', title: 'SEO editorial', description: 'Plan editorial, clusters y optimización de contenido.', status: 'En progreso', docs: 4, links: 2, order: 3 },
  { id: 'M4', title: 'Técnico avanzado', description: 'Rendimiento, indexabilidad, datos estructurados y arquitectura.', status: 'Pendiente', docs: 3, links: 1, order: 4 },
  { id: 'M5', title: 'Autoridad y E-E-A-T', description: 'Señales de autoridad, reputación y experiencia demostrada.', status: 'Pendiente', docs: 3, links: 2, order: 5 },
  { id: 'M6', title: 'Distribución y enlaces', description: 'Link building, PR digital y estrategias de distribución.', status: 'Pendiente', docs: 3, links: 2, order: 6 },
  { id: 'M7', title: 'Medición y reporting', description: 'Consolidación de KPIs, tableros y seguimiento de evolución.', status: 'Pendiente', docs: 2, links: 1, order: 7 },
  { id: 'M8', title: 'Escalado y optimización', description: 'Iteración continua y mejora de procesos para escalar resultados.', status: 'Pendiente', docs: 2, links: 1, order: 8 },
];

const initialPhases: MethodologyPhase[] = [
  { id: 'F1', title: 'Descubrimiento', desc: 'Recopilación de contexto, objetivos, stakeholders y recursos existentes.', deliverables: ['Brief inicial', 'Mapa de stakeholders'], status: 'Completado', icon: Target, order: 1 },
  { id: 'F2', title: 'Auditoría inicial', desc: 'Revisión SEO técnica, contenidos, arquitectura y rendimiento.', deliverables: ['Informe de auditoría', 'Checklist técnico'], status: 'En progreso', icon: CircleDashed, order: 2 },
  { id: 'F3', title: 'Priorización', desc: 'Ordenamos hallazgos según impacto, esfuerzo y dependencia.', deliverables: ['Matriz ICE', 'Backlog priorizado'], status: 'En progreso', icon: TrendingUp, order: 3 },
  { id: 'F4', title: 'Plan de acción', desc: 'Definimos roadmap, responsables, timings y entregables.', deliverables: ['Roadmap trimestral', 'Plan de acción'], status: 'Pendiente', icon: PencilRuler, order: 4 },
  { id: 'F5', title: 'Implementación', desc: 'Ejecución de cambios técnicos, editoriales y de enlazado interno.', deliverables: ['Cambios implementados', 'Registro de tareas'], status: 'Pendiente', icon: Wrench, order: 5 },
  { id: 'F6', title: 'Validación', desc: 'Comprobación de resultados, QA y seguimiento de KPIs.', deliverables: ['Informe de validación', 'Dashboard temporal'], status: 'Pendiente', icon: ListTodo, order: 6 },
  { id: 'F7', title: 'Mejora continua', desc: 'Iteración, aprendizaje y optimización recurrente.', deliverables: ['Lecciones aprendidas', 'Backlog iterativo'], status: 'Pendiente', icon: BarChart3, order: 7 },
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

const sortByOrder = <T extends { order: number }>(items: T[]) => [...items].sort((a, b) => a.order - b.order);
const reindex = <T extends { order: number }>(items: T[]) => items.map((item, index) => ({ ...item, order: index + 1 }));

const MetodologiaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Documentación');
  const [modules, setModules] = useState(() => sortByOrder(initialModules));
  const [phases, setPhases] = useState(() => sortByOrder(initialPhases));
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(initialModules[0].id);
  const [hasPendingOrderChanges, setHasPendingOrderChanges] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const { info, successAction, error: errorToast } = useToast();
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const saveOrder = async (nextModules: MethodologyModule[], nextPhases: MethodologyPhase[], previousModules: MethodologyModule[], previousPhases: MethodologyPhase[]) => {
    setIsSavingOrder(true);
    try {
      await Promise.all([
        metodologiaService.reorderModules(nextModules.map((module) => ({ id: module.id, order: module.order }))),
        metodologiaService.reorderPhases(nextPhases.map((phase) => ({ id: phase.id, order: phase.order }))),
      ]);
      setHasPendingOrderChanges(false);
      successAction('Orden actualizado', 'El nuevo orden de módulos y fases fue guardado correctamente.');
    } catch (error) {
      setModules(previousModules);
      setPhases(previousPhases);
      const message = error instanceof Error ? error.message : 'No se pudo guardar el nuevo orden.';
      errorToast('Error al guardar el orden', message);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;
    if (!destination || destination.index === source.index) return;

    const previousModules = modules;
    const previousPhases = phases;

    if (type === 'MODULE') {
      const reordered = [...modules];
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);
      const normalized = reindex(reordered);
      setModules(normalized);
      setHasPendingOrderChanges(true);
      void saveOrder(normalized, phases, previousModules, previousPhases);
      return;
    }

    const reorderedPhases = [...phases];
    const [moved] = reorderedPhases.splice(source.index, 1);
    reorderedPhases.splice(destination.index, 0, moved);
    const normalized = reindex(reorderedPhases);
    setPhases(normalized);
    setHasPendingOrderChanges(true);
    void saveOrder(modules, normalized, previousModules, previousPhases);
  };

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

  const statusClass = useMemo(() => ({ Completado: 'success', 'En progreso': 'warning', Pendiente: 'default' } as const), []);
  const getResourceIcon = (type: string) => {
    if (type === 'sheet') return <FileSpreadsheet size={16} className="text-emerald-600" />;
    if (type === 'chart') return <BarChart3 size={16} className="text-violet-600" />;
    return <FileText size={16} className="text-blue-600" />;
  };

  const filteredResources = tabResources[activeTab] ?? [];

  return <div className="space-y-6 overflow-x-hidden text-slate-800"><DragDropContext onDragEnd={onDragEnd}>{/* ...rest */}
    <section id="resumen" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Metodología</h1><p className="mt-2 text-sm text-slate-600">Centraliza el proceso de trabajo, documentación y recursos estratégicos del proyecto.</p></div><div className="flex gap-3"><Button onClick={() => successAction('Recurso en creación', 'Abrimos el flujo para añadir un nuevo recurso.')}>+ Añadir recurso</Button><Button variant="secondary" onClick={() => info('Editor de estructura', 'Arrastra módulos y fases para reordenar. Guardamos automáticamente cada cambio.')}>Editar estructura</Button></div></div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => { const Icon = item.icon; return <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-blue-700"><Icon size={18} /></div><div><p className="text-2xl font-bold text-slate-900">{item.value} <span className="text-base font-semibold text-slate-700">{item.label}</span></p><p className="text-xs text-slate-500">{item.subtitle}</p></div></div></article>; })}</section>
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]"><div className="space-y-6">
    <section id="estructura" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Estructura de la metodología</h2><Button variant="secondary" onClick={() => void saveOrder(modules, phases, modules, phases)} disabled={!hasPendingOrderChanges || isSavingOrder}>{isSavingOrder ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Guardando...</span> : <span className="inline-flex items-center gap-2"><Save size={14} /> Guardar orden</span>}</Button></div>
    <Droppable droppableId="modules" type="MODULE">{(provided) => <div className="mt-4 space-y-3" ref={provided.innerRef} {...provided.droppableProps}>{modules.map((m, index) => <Draggable draggableId={m.id} index={index} key={m.id}>{(dragProvided, snapshot) => <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={`rounded-xl border p-4 transition ${snapshot.isDragging ? 'border-blue-400 bg-blue-50 shadow-lg' : 'border-slate-200 bg-slate-50/80'}`}><div className="flex flex-wrap items-center gap-3"><button type="button" aria-label={`Mover ${m.title}`} className="cursor-grab rounded p-1 text-slate-400 active:cursor-grabbing" {...dragProvided.dragHandleProps}><GripVertical size={16} /></button><span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">{m.id}</span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{m.title}</p><p className="text-sm text-slate-600">{m.description}</p></div><Badge variant={statusClass[m.status]}>{m.status}</Badge><span className="text-xs text-slate-500">{m.docs} docs · {m.links} enlaces</span><button type="button" onClick={() => setExpandedModuleId((current) => (current === m.id ? null : m.id))} className="rounded-md p-1 transition hover:bg-slate-200" title={expandedModuleId === m.id ? 'Ocultar detalle' : 'Ver detalle'}><ChevronDown size={16} className={`text-slate-400 transition ${expandedModuleId === m.id ? 'rotate-180' : ''}`} /></button></div>{expandedModuleId === m.id && <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"><p><span className="font-semibold">Estado:</span> {m.status}</p><p><span className="font-semibold">Documentos:</span> {m.docs}</p><p><span className="font-semibold">Enlaces:</span> {m.links}</p></div>}</div>}</Draggable>)}{provided.placeholder}</div>}</Droppable>
    </section>
    <section id="fases" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Cómo aplicamos la metodología</h2><Droppable droppableId="phases" type="PHASE">{(provided) => <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" ref={provided.innerRef} {...provided.droppableProps}>{phases.map((phase, idx) => { const Icon = phase.icon; return <Draggable draggableId={phase.id} index={idx} key={phase.id}>{(dragProvided, snapshot) => <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={`relative rounded-2xl border p-4 transition ${snapshot.isDragging ? 'border-violet-400 bg-violet-50 shadow-lg' : 'border-slate-200 bg-slate-50'}`}><div className="mb-3 flex items-center justify-between"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{idx + 1}</span><div className="flex items-center gap-2"><button type="button" aria-label={`Mover ${phase.title}`} className="cursor-grab rounded p-1 text-slate-400 active:cursor-grabbing" {...dragProvided.dragHandleProps}><GripVertical size={14} /></button><Badge variant={statusClass[phase.status]}>{phase.status}</Badge></div></div><Icon size={22} className="mb-2 text-violet-600" /><p className="font-semibold text-slate-900">{phase.title}</p><p className="mt-1 text-xs text-slate-600">{phase.desc}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Entregables</p><ul className="mt-1 space-y-1 text-xs text-slate-700">{phase.deliverables.map((deliverable) => <li key={deliverable}>• {deliverable}</li>)}</ul></div>}</Draggable>; })}{provided.placeholder}</div>}</Droppable></section></div>
    <aside id="recursos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Recursos y documentación</h2><div className="mt-4 flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-full px-3 py-1 text-xs font-medium ${activeTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{tab}</button>)}</div><div className="mt-4 space-y-3">{filteredResources.map((resource) => <article key={resource.title} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start gap-3"><div className="mt-0.5">{getResourceIcon(resource.type)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{resource.title}</p><p className="text-xs text-slate-500">{resource.meta}</p></div><button type="button" onClick={() => openResource(resource.title)} title="Abrir recurso" className="rounded p-1 transition hover:bg-slate-100"><ExternalLink size={14} className="text-slate-400" /></button></div></article>)}{filteredResources.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">No hay recursos para esta pestaña todavía.</p>}</div><Button variant="secondary" className="mt-4 w-full" onClick={() => setActiveTab('Documentación')}>Ver todos los recursos</Button></aside></div>
  </DragDropContext></div>;
};

export default MetodologiaPage;
