import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { BarChart3, BookOpen, ChevronDown, CircleDashed, Copy, ExternalLink, FileSpreadsheet, FileText, GripVertical, Layers, Link2, ListTodo, Loader2, MoreHorizontal, PencilRuler, Share2, SquarePen, Target, TrendingUp, Workflow, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastContext';
import { useLocation } from 'react-router-dom';
import { safeCopyToClipboard, safeShareResource } from '@/lib/browser/shareClipboard';
import { metodologiaService, MethodologyModule, MethodologyPhase, MethodologyResource, MethodologyStatus, ResourceType } from '@/services/metodologiaService';

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
];

const initialPhases: MethodologyPhase[] = [
  { title: 'Descubrimiento', desc: 'Recopilación de contexto, objetivos, stakeholders y recursos existentes.', deliverables: ['Brief inicial', 'Mapa de stakeholders'], status: 'Completado', order: 1 },
  { title: 'Auditoría inicial', desc: 'Revisión SEO técnica, contenidos, arquitectura y rendimiento.', deliverables: ['Informe de auditoría', 'Checklist técnico'], status: 'En progreso', order: 2 },
  { title: 'Priorización', desc: 'Ordenamos hallazgos según impacto, esfuerzo y dependencia.', deliverables: ['Matriz ICE', 'Backlog priorizado'], status: 'Pendiente', order: 3 },
];

const initialResources: MethodologyResource[] = [
  { title: 'Guía de Metodología SEO - v2.1', meta: 'Google Docs · Actualizado hace 5 días', type: 'doc', moduleId: 'M1', description: 'Manual completo de la metodología y estándares compartidos para todos los proyectos.' },
  { title: 'Checklist de auditoría', meta: 'Hoja de cálculo · v1.1', type: 'sheet', moduleId: 'M2', description: 'Lista de validación técnica para auditoría.' },
  { title: 'Dashboard de seguimiento', meta: 'Hoja de cálculo · v1.3', type: 'chart', moduleId: 'M3', description: 'Control de KPIs y avance del plan.' },
];

const tabs = ['Documentación', 'Enlazado interno', 'URLs clave', 'Plantillas', 'KPIs', 'Notas rápidas'] as const;
const phaseIcons = [Target, CircleDashed, TrendingUp, PencilRuler, Wrench, ListTodo, BarChart3];
const STATUS_VARIANTS: Record<MethodologyStatus, 'success' | 'warning' | 'default'> = { Completado: 'success', 'En progreso': 'warning', Pendiente: 'default' };

type DrawerState =
  | { kind: 'module'; mode: 'edit' | 'create'; data: MethodologyModule }
  | { kind: 'phase'; mode: 'edit' | 'create'; data: MethodologyPhase }
  | { kind: 'resource'; mode: 'edit' | 'create'; data: MethodologyResource }
  | null;

const defaultStatus: MethodologyStatus = 'Pendiente';

const normalizeStatus = (value: string): MethodologyStatus => (
  value === 'Completado' || value === 'En progreso' || value === 'Pendiente' ? value : defaultStatus
);

const normalizeResourceType = (value: string): ResourceType => (
  value === 'doc' || value === 'sheet' || value === 'chart' ? value : 'doc'
);

const stableSortByOrder = <T extends { order: number }>(items: T[]) => items
  .map((item, index) => ({ item, index }))
  .sort((a, b) => a.item.order - b.item.order || a.index - b.index)
  .map(({ item }) => item);

const applyOrder = <T extends { order: number }>(items: T[]) => items.map((item, index) => ({ ...item, order: index + 1 }));

const reorderList = <T,>(list: T[], startIndex: number, endIndex: number): T[] => {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

const MetodologiaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Documentación');
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(initialModules[0].id);
  const [modules, setModules] = useState(stableSortByOrder(initialModules));
  const [phases, setPhases] = useState(stableSortByOrder(initialPhases));
  const [resources, setResources] = useState(initialResources);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const { info, successAction, error } = useToast();
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.replace('#', ''));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const filteredResources = useMemo(() => {
    const map: Record<(typeof tabs)[number], MethodologyResource[]> = {
      Documentación: resources,
      'Enlazado interno': resources.filter((r) => r.title.toLowerCase().includes('enlazado') || r.title.toLowerCase().includes('link')),
      'URLs clave': resources.filter((r) => r.title.toLowerCase().includes('sitemap') || r.title.toLowerCase().includes('dashboard')),
      Plantillas: resources.filter((r) => r.title.toLowerCase().includes('brief') || r.title.toLowerCase().includes('checklist')),
      KPIs: resources.filter((r) => r.title.toLowerCase().includes('dashboard')),
      'Notas rápidas': [],
    };
    return map[activeTab] ?? [];
  }, [activeTab, resources]);

  const openResource = (title: string) => window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(title)}`, '_blank', 'noopener,noreferrer');

  const persistOrder = async (nextModules: MethodologyModule[], nextPhases: MethodologyPhase[], previousModules: MethodologyModule[], previousPhases: MethodologyPhase[]) => {
    setIsSavingOrder(true);
    try {
      const [savedModules, savedPhases] = await Promise.all([
        metodologiaService.reorderModules(nextModules),
        metodologiaService.reorderPhases(nextPhases),
      ]);
      setModules(stableSortByOrder(savedModules));
      setPhases(stableSortByOrder(savedPhases));
      setOrderDirty(false);
      successAction('Orden guardado', 'Se actualizó el orden de módulos y fases.');
    } catch {
      setModules(previousModules);
      setPhases(previousPhases);
      setOrderDirty(false);
      error('No se pudo guardar el orden', 'Se restauró el orden anterior.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSave = async () => {
    if (!drawer) return;
    try {
      if (drawer.kind === 'module') {
        const saved = await metodologiaService.updateModule(drawer.data);
        setModules((current) => stableSortByOrder(current.some((m) => m.id === saved.id) ? current.map((m) => m.id === saved.id ? saved : m) : [saved, ...current]));
      }
      if (drawer.kind === 'phase') {
        const saved = await metodologiaService.updatePhase(drawer.data);
        setPhases((current) => stableSortByOrder(current.some((p) => p.title === saved.title) ? current.map((p) => p.title === saved.title ? saved : p) : [saved, ...current]));
      }
      if (drawer.kind === 'resource') {
        const saved = await metodologiaService.updateResource(drawer.data);
        setResources((current) => current.some((r) => r.title === saved.title) ? current.map((r) => r.title === saved.title ? saved : r) : [saved, ...current]);
      }
      successAction('Guardado', 'Cambios persistidos y vistas actualizadas.');
      setDrawer(null);
    } catch {
      error('No se pudo guardar', 'Reintenta en unos segundos.');
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;
    if (!destination || destination.index === source.index) return;

    const previousModules = modules;
    const previousPhases = phases;

    if (type === 'MODULE') {
      const nextModules = applyOrder(reorderList(modules, source.index, destination.index));
      setModules(nextModules);
      setOrderDirty(true);
      void persistOrder(nextModules, phases, previousModules, previousPhases);
      return;
    }

    if (type === 'PHASE') {
      const nextPhases = applyOrder(reorderList(phases, source.index, destination.index));
      setPhases(nextPhases);
      setOrderDirty(true);
      void persistOrder(modules, nextPhases, previousModules, previousPhases);
    }
  };

  const getResourceIcon = (type: ResourceType) => type === 'sheet' ? <FileSpreadsheet size={16} className="text-emerald-600" /> : type === 'chart' ? <BarChart3 size={16} className="text-violet-600" /> : <FileText size={16} className="text-blue-600" />;

  return <div className="space-y-6 overflow-x-hidden text-slate-800">{/* UI kept */}
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex justify-between"><div><h1 className="text-3xl font-bold text-slate-900">Metodología</h1><p className="mt-1 text-sm text-slate-600">Esta página es única y aplica de la misma forma para todos los proyectos.</p></div><Button onClick={() => setDrawer({ kind: 'resource', mode: 'create', data: { title: '', meta: '', type: 'doc', moduleId: modules[0]?.id ?? 'M1', description: '' } })}>+ Añadir recurso</Button></div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => { const Icon = item.icon; return <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon size={18} /><p>{item.value} {item.label}</p></article>; })}</section>

    <div className="flex items-center justify-end gap-3">
      {isSavingOrder && <span className="inline-flex items-center gap-1 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Guardando orden...</span>}
      <Button variant="secondary" disabled={!orderDirty || isSavingOrder} onClick={() => void persistOrder(modules, phases, modules, phases)}>Guardar orden</Button>
    </div>

    <DragDropContext onDragEnd={handleDragEnd}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2>Estructura</h2>
        <Droppable droppableId="modules" type="MODULE">
          {(provided) => <div ref={provided.innerRef} {...provided.droppableProps}>{modules.map((m, index) => <Draggable key={m.id} draggableId={m.id} index={index}>
            {(dragProvided, snapshot) => <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={`rounded-xl border p-3 mt-2 transition ${snapshot.isDragging ? 'border-blue-400 bg-blue-50 shadow-lg' : ''}`}><div className="flex items-center gap-2"><span {...dragProvided.dragHandleProps}><GripVertical size={14}/></span><span>{m.id}</span><p className="flex-1">{m.title}</p><Badge variant={STATUS_VARIANTS[m.status]}>{m.status}</Badge><button onClick={() => setDrawer({ kind: 'module', mode: 'edit', data: m })}><SquarePen size={14}/></button><button onClick={() => setExpandedModuleId(expandedModuleId === m.id ? null : m.id)}><ChevronDown size={14}/></button></div>{expandedModuleId===m.id && <p className="text-sm">{m.description} · {m.docs} docs · {m.links} links</p>}</div>}
          </Draggable>)}{provided.placeholder}</div>}
        </Droppable>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2>Fases</h2>
        <Droppable droppableId="phases" type="PHASE">
          {(provided) => <div ref={provided.innerRef} {...provided.droppableProps} className="grid gap-3 sm:grid-cols-2">{phases.map((phase, idx) => { const Icon = phaseIcons[idx % phaseIcons.length]; return <Draggable key={phase.title} draggableId={phase.title} index={idx}>
            {(dragProvided, snapshot) => <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={`border rounded-xl p-3 transition ${snapshot.isDragging ? 'border-blue-400 bg-blue-50 shadow-lg' : ''}`}><div className="flex justify-between"><div className="flex items-center gap-2"><span {...dragProvided.dragHandleProps}><GripVertical size={14}/></span><Icon size={16}/></div><button onClick={() => setDrawer({ kind: 'phase', mode: 'edit', data: phase })}><SquarePen size={14}/></button></div><p>{phase.title}</p><Badge variant={STATUS_VARIANTS[phase.status]}>{phase.status}</Badge></div>}
          </Draggable>; })}{provided.placeholder}</div>}
        </Droppable>
      </section>
    </DragDropContext>

    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-2 flex-wrap">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>{filteredResources.map((resource) => <article key={resource.title} className="border rounded p-3 mt-2"><div className="flex gap-2 items-center">{getResourceIcon(resource.type)}<p className="flex-1">{resource.title}</p><button onClick={() => setDrawer({ kind: 'resource', mode: 'edit', data: resource })}><SquarePen size={14}/></button><button onClick={() => openResource(resource.title)}><ExternalLink size={14}/></button></div></article>)}</aside>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2>Biblioteca de recursos</h2><table className="min-w-full text-sm"><tbody>{resources.map((row) => <tr key={row.title}><td>{row.type}</td><td>{row.title}</td><td><Badge variant="info">{row.moduleId}</Badge></td><td>{row.description}</td><td>{row.meta}</td><td><div className="flex gap-2"><button onClick={() => setDrawer({ kind: 'resource', mode: 'edit', data: row })}><SquarePen size={14}/></button><button onClick={() => openResource(row.title)}><ExternalLink size={14}/></button><button onClick={() => void safeShareResource(row.title, row.title)}><Share2 size={14}/></button><button onClick={() => void safeCopyToClipboard(row.title)}><Copy size={14}/></button><button onClick={() => info('Más opciones', row.title)}><MoreHorizontal size={14}/></button></div></td></tr>)}</tbody></table></section>

    {drawer && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-slate-900/30" onClick={() => setDrawer(null)} /><div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white p-5 shadow-2xl overflow-auto"><div className="flex justify-between"><h3>{drawer.mode === 'edit' ? 'Editar' : 'Crear'} {drawer.kind}</h3><button onClick={() => setDrawer(null)}><X size={16}/></button></div>
      {drawer.kind === 'module' && <div className="space-y-2 mt-4"><input className="w-full border p-2" value={drawer.data.id} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, id: e.target.value } })}/><input className="w-full border p-2" value={drawer.data.title} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, title: e.target.value } })}/><textarea className="w-full border p-2" value={drawer.data.description} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, description: e.target.value } })}/><select className="w-full border p-2" value={drawer.data.status} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, status: normalizeStatus(e.target.value) } })}><option>Completado</option><option>En progreso</option><option>Pendiente</option></select><input type="number" className="w-full border p-2" value={drawer.data.docs} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, docs: Number(e.target.value) } })}/><input type="number" className="w-full border p-2" value={drawer.data.links} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, links: Number(e.target.value) } })}/></div>}
      {drawer.kind === 'phase' && <div className="space-y-2 mt-4"><input className="w-full border p-2" value={drawer.data.title} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, title: e.target.value } })}/><textarea className="w-full border p-2" value={drawer.data.desc} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, desc: e.target.value } })}/><select className="w-full border p-2" value={drawer.data.status} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, status: normalizeStatus(e.target.value) } })}><option>Completado</option><option>En progreso</option><option>Pendiente</option></select><textarea className="w-full border p-2" value={drawer.data.deliverables.join(', ')} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, deliverables: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) } })}/></div>}
      {drawer.kind === 'resource' && <div className="space-y-2 mt-4"><input className="w-full border p-2" value={drawer.data.title} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, title: e.target.value } })}/><input className="w-full border p-2" value={drawer.data.meta} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, meta: e.target.value } })}/><select className="w-full border p-2" value={drawer.data.type} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, type: normalizeResourceType(e.target.value) } })}><option value="doc">doc</option><option value="sheet">sheet</option><option value="chart">chart</option></select><select className="w-full border p-2" value={drawer.data.moduleId} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, moduleId: e.target.value } })}>{modules.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}</select><textarea className="w-full border p-2" value={drawer.data.description} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, description: e.target.value } })}/></div>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDrawer(null)}>Cancelar</Button><Button onClick={() => void handleSave()}>Guardar</Button></div>
    </div></div>}
  </div>;
};

export default MetodologiaPage;
