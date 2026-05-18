import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { BarChart3, BookOpen, ChevronDown, CircleDashed, Copy, ExternalLink, FileSpreadsheet, FileText, GripVertical, Layers, Link2, ListTodo, Loader2, MoreHorizontal, PencilRuler, Share2, SquarePen, Target, TrendingUp, Workflow, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastContext';
import { useLocation } from 'react-router-dom';
import { safeCopyToClipboard, safeShareResource } from '@/lib/browser/shareClipboard';
import { CreateModuleInput, CreateResourceInput, metodologiaService, MethodologyModule, MethodologyPhase, MethodologyResource, MethodologyStatus, ResourceType } from '@/services/metodologiaService';
import { useMetodologiaKpis, useMetodologiaModules, useMetodologiaPhases, useMetodologiaResources } from '@/hooks/useMetodologia';
import { getFilteredResourcesByTab, metodologiaTabs, MetodologiaTab } from '@/lib/metodologia/transforms';





const KPI_ICONS = {
  módulos: Layers,
  fases: Workflow,
  recursos: BookOpen,
  'enlaces internos': Link2,
} as const;

const STATUS_VARIANTS: Record<MethodologyStatus, 'success' | 'warning' | 'default'> = { Completado: 'success', 'En progreso': 'warning', Pendiente: 'default' };

type NewResourceDraft = CreateResourceInput;

type NewModuleDraft = CreateModuleInput;

const buildInitialResourceDraft = (moduleId: string): NewResourceDraft => ({
  type: 'doc',
  title: '',
  moduleId,
  description: '',
  status: 'Pendiente',
  links: [],
  docs: 0,
  meta: '',
  metadata: '',
});

const initialModuleDraft: NewModuleDraft = {
  id: '',
  title: '',
  description: '',
  status: 'Pendiente',
  docs: 0,
  links: 0,
};


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
  const [activeTab, setActiveTab] = useState<MetodologiaTab>('Documentación');
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [modules, setModules] = useState<MethodologyModule[]>([]);
  const [phases, setPhases] = useState<MethodologyPhase[]>([]);
  const [resources, setResources] = useState<MethodologyResource[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [showCreateResourceDrawer, setShowCreateResourceDrawer] = useState(false);
  const [newResource, setNewResource] = useState<NewResourceDraft>(() => buildInitialResourceDraft('M1'));
  const [newModule, setNewModule] = useState<NewModuleDraft>(initialModuleDraft);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const { info, successAction, error } = useToast();
  const location = useLocation();

  const { data: queryModules = [] } = useMetodologiaModules();
  const { data: queryPhases = [] } = useMetodologiaPhases();
  const { data: queryResources = [] } = useMetodologiaResources();
  const { data: kpis = [] } = useMetodologiaKpis();

  useEffect(() => {
    setModules(stableSortByOrder(queryModules));
    setExpandedModuleId((current) => current ?? queryModules[0]?.id ?? null);
  }, [queryModules]);

  useEffect(() => {
    setPhases(stableSortByOrder(queryPhases));
  }, [queryPhases]);

  useEffect(() => {
    setResources(queryResources);
  }, [queryResources]);

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.replace('#', ''));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const filteredResources = useMemo(() => getFilteredResourcesByTab(activeTab, resources), [activeTab, resources]);

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

  const isValidModuleId = (moduleId: string) => modules.some((module) => module.id === moduleId);

  const submitNewResource = async () => {
    const title = newResource.title.trim();
    if (!title) {
      error('Título requerido', 'Completa el título del recurso antes de guardar.');
      return;
    }
    if (!isValidModuleId(newResource.moduleId)) {
      error('Módulo inválido', 'Selecciona un módulo existente para continuar.');
      return;
    }

    const optimisticResource: MethodologyResource = {
      title,
      meta: newResource.meta || newResource.metadata,
      type: newResource.type,
      moduleId: newResource.moduleId,
      description: newResource.description,
      status: newResource.status,
      links: newResource.links,
      docs: newResource.docs,
      metadata: newResource.metadata,
    };

    setResources((current) => [optimisticResource, ...current]);
    setShowCreateResourceDrawer(false);

    try {
      const saved = await metodologiaService.createResource(newResource);
      setResources((current) => [saved, ...current.filter((resource) => resource !== optimisticResource)]);
      successAction('Recurso creado', `Se añadió "${saved.title}" correctamente.`);
    } catch {
      setResources((current) => current.filter((resource) => resource !== optimisticResource));
      error('No se pudo crear el recurso', 'No se guardaron los cambios. Intenta nuevamente.');
    }
  };

  void newModule;

  return <div className="space-y-6 overflow-x-hidden text-slate-800">{/* UI kept */}
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex justify-between"><div><h1 className="text-3xl font-bold text-slate-900">Metodología</h1><p className="mt-1 text-sm text-slate-600">Esta página es única y aplica de la misma forma para todos los proyectos.</p></div><Button onClick={() => { setNewResource(buildInitialResourceDraft(modules[0]?.id ?? 'M1')); setShowCreateResourceDrawer(true); }}>+ Añadir recurso</Button></div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => { const Icon = KPI_ICONS[item.label as keyof typeof KPI_ICONS] ?? BookOpen; return <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon size={18} /><p>{item.value} {item.label}</p></article>; })}</section>

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

    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-2 flex-wrap">{metodologiaTabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>{filteredResources.map((resource) => <article key={resource.title} className="border rounded p-3 mt-2"><div className="flex gap-2 items-center">{getResourceIcon(resource.type)}<p className="flex-1">{resource.title}</p><button onClick={() => setDrawer({ kind: 'resource', mode: 'edit', data: resource })}><SquarePen size={14}/></button><button onClick={() => openResource(resource.title)}><ExternalLink size={14}/></button></div></article>)}</aside>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2>Biblioteca de recursos</h2><table className="min-w-full text-sm"><tbody>{resources.map((row) => <tr key={row.title}><td>{row.type}</td><td>{row.title}</td><td><Badge variant="info">{row.moduleId}</Badge></td><td>{row.description}</td><td>{row.meta}</td><td><div className="flex gap-2"><button onClick={() => setDrawer({ kind: 'resource', mode: 'edit', data: row })}><SquarePen size={14}/></button><button onClick={() => openResource(row.title)}><ExternalLink size={14}/></button><button onClick={() => void safeShareResource(row.title, row.title)}><Share2 size={14}/></button><button onClick={() => void safeCopyToClipboard(row.title)}><Copy size={14}/></button><button onClick={() => info('Más opciones', row.title)}><MoreHorizontal size={14}/></button></div></td></tr>)}</tbody></table></section>

    {drawer && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-slate-900/30" onClick={() => setDrawer(null)} /><div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white p-5 shadow-2xl overflow-auto"><div className="flex justify-between"><h3>{drawer.mode === 'edit' ? 'Editar' : 'Crear'} {drawer.kind}</h3><button onClick={() => setDrawer(null)}><X size={16}/></button></div>
      {drawer.kind === 'module' && <div className="space-y-2 mt-4"><input className="w-full border p-2" value={drawer.data.id} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, id: e.target.value } })}/><input className="w-full border p-2" value={drawer.data.title} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, title: e.target.value } })}/><textarea className="w-full border p-2" value={drawer.data.description} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, description: e.target.value } })}/><select className="w-full border p-2" value={drawer.data.status} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, status: normalizeStatus(e.target.value) } })}><option>Completado</option><option>En progreso</option><option>Pendiente</option></select><input type="number" className="w-full border p-2" value={drawer.data.docs} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, docs: Number(e.target.value) } })}/><input type="number" className="w-full border p-2" value={drawer.data.links} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, links: Number(e.target.value) } })}/></div>}
      {drawer.kind === 'phase' && <div className="space-y-2 mt-4"><input className="w-full border p-2" value={drawer.data.title} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, title: e.target.value } })}/><textarea className="w-full border p-2" value={drawer.data.desc} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, desc: e.target.value } })}/><select className="w-full border p-2" value={drawer.data.status} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, status: normalizeStatus(e.target.value) } })}><option>Completado</option><option>En progreso</option><option>Pendiente</option></select><textarea className="w-full border p-2" value={drawer.data.deliverables.join(', ')} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, deliverables: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) } })}/></div>}
      {drawer.kind === 'resource' && <div className="space-y-2 mt-4"><input className="w-full border p-2" value={drawer.data.title} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, title: e.target.value } })}/><input className="w-full border p-2" value={drawer.data.meta} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, meta: e.target.value } })}/><select className="w-full border p-2" value={drawer.data.type} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, type: normalizeResourceType(e.target.value) } })}><option value="doc">doc</option><option value="sheet">sheet</option><option value="chart">chart</option></select><select className="w-full border p-2" value={drawer.data.moduleId} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, moduleId: e.target.value } })}>{modules.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}</select><textarea className="w-full border p-2" value={drawer.data.description} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, description: e.target.value } })}/></div>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDrawer(null)}>Cancelar</Button><Button onClick={() => void handleSave()}>Guardar</Button></div>
    </div></div>}
    {showCreateResourceDrawer && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-slate-900/30" onClick={() => setShowCreateResourceDrawer(false)} /><div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white p-5 shadow-2xl overflow-auto"><div className="flex justify-between"><h3>Nuevo recurso</h3><button onClick={() => setShowCreateResourceDrawer(false)}><X size={16}/></button></div><div className="space-y-2 mt-4"><select className="w-full border p-2" value={newResource.type} onChange={(e) => setNewResource((prev) => ({ ...prev, type: normalizeResourceType(e.target.value) }))}><option value="doc">Documento</option><option value="sheet">Hoja de cálculo</option><option value="chart">Dashboard</option></select><input className="w-full border p-2" placeholder="Título" value={newResource.title} onChange={(e) => setNewResource((prev) => ({ ...prev, title: e.target.value }))} /><select className="w-full border p-2" value={newResource.moduleId} onChange={(e) => setNewResource((prev) => ({ ...prev, moduleId: e.target.value }))}>{modules.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.title}</option>)}</select><textarea className="w-full border p-2" placeholder="Descripción" value={newResource.description} onChange={(e) => setNewResource((prev) => ({ ...prev, description: e.target.value }))} /><select className="w-full border p-2" value={newResource.status} onChange={(e) => setNewResource((prev) => ({ ...prev, status: normalizeStatus(e.target.value) }))}><option>Completado</option><option>En progreso</option><option>Pendiente</option></select><input className="w-full border p-2" placeholder="Enlaces/docs (separados por coma)" value={newResource.links.join(', ')} onChange={(e) => setNewResource((prev) => ({ ...prev, links: e.target.value.split(',').map((link) => link.trim()).filter(Boolean) }))} /><input type="number" className="w-full border p-2" placeholder="Cantidad de docs" value={newResource.docs} onChange={(e) => setNewResource((prev) => ({ ...prev, docs: Number(e.target.value) || 0 }))} /><input className="w-full border p-2" placeholder="Metadatos" value={newResource.metadata} onChange={(e) => setNewResource((prev) => ({ ...prev, metadata: e.target.value, meta: e.target.value }))} /></div><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowCreateResourceDrawer(false)}>Cancelar</Button><Button onClick={() => void submitNewResource()}>Crear recurso</Button></div></div></div>}
  </div>;
};

export default MetodologiaPage;
