import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, ChevronDown, CircleDashed, Copy, ExternalLink, FileSpreadsheet, FileText, GripVertical, Layers, Link2, ListTodo, MoreHorizontal, PencilRuler, Share2, SquarePen, Target, TrendingUp, Workflow, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastContext';
import { useLocation } from 'react-router-dom';
import { safeCopyToClipboard, safeShareResource } from '@/lib/browser/shareClipboard';
import { CreateMethodologyModuleInput, CreateMethodologyResourceInput, metodologiaService, MethodologyModule, MethodologyPhase, MethodologyResource, MethodologyStatus, ResourceType } from '@/services/metodologiaService';

const kpis = [
  { label: 'módulos', value: '8', subtitle: 'Estructura definida', icon: Layers },
  { label: 'fases', value: '7', subtitle: 'De principio a fin', icon: Workflow },
  { label: 'recursos', value: '24', subtitle: 'Documentación y guías', icon: BookOpen },
  { label: 'enlaces internos', value: '12', subtitle: 'Referencias activas', icon: Link2 },
];

const initialModules: MethodologyModule[] = [
  { id: 'M1', title: 'Auditoría inicial', description: 'Análisis del estado actual del sitio y detección de oportunidades.', status: 'Completado', docs: 6, links: 3 },
  { id: 'M2', title: 'Estrategia y verticales', description: 'Definición de verticales, segmentos y priorización de acciones.', status: 'En progreso', docs: 5, links: 2 },
  { id: 'M3', title: 'SEO editorial', description: 'Plan editorial, clusters y optimización de contenido.', status: 'En progreso', docs: 4, links: 2 },
];

const initialPhases: MethodologyPhase[] = [
  { title: 'Descubrimiento', desc: 'Recopilación de contexto, objetivos, stakeholders y recursos existentes.', deliverables: ['Brief inicial', 'Mapa de stakeholders'], status: 'Completado' },
  { title: 'Auditoría inicial', desc: 'Revisión SEO técnica, contenidos, arquitectura y rendimiento.', deliverables: ['Informe de auditoría', 'Checklist técnico'], status: 'En progreso' },
  { title: 'Priorización', desc: 'Ordenamos hallazgos según impacto, esfuerzo y dependencia.', deliverables: ['Matriz ICE', 'Backlog priorizado'], status: 'Pendiente' },
];

const initialResources: MethodologyResource[] = [
  { title: 'Guía de Metodología SEO - v2.1', meta: 'Google Docs · Actualizado hace 5 días', type: 'doc', moduleId: 'M1', description: 'Manual completo de la metodología y estándares del proyecto.' },
  { title: 'Checklist de auditoría', meta: 'Hoja de cálculo · v1.1', type: 'sheet', moduleId: 'M2', description: 'Lista de validación técnica para auditoría.' },
  { title: 'Dashboard de seguimiento', meta: 'Hoja de cálculo · v1.3', type: 'chart', moduleId: 'M3', description: 'Control de KPIs y avance del plan.' },
];

const tabs = ['Documentación', 'Enlazado interno', 'URLs clave', 'Plantillas', 'KPIs', 'Notas rápidas'] as const;
const phaseIcons = [Target, CircleDashed, TrendingUp, PencilRuler, Wrench, ListTodo, BarChart3];
const STATUS_VARIANTS: Record<MethodologyStatus, 'success' | 'warning' | 'default'> = { Completado: 'success', 'En progreso': 'warning', Pendiente: 'default' };

type DrawerState =
  | { kind: 'module'; mode: 'edit'; data: MethodologyModule }
  | { kind: 'phase'; mode: 'edit'; data: MethodologyPhase }
  | { kind: 'resource'; mode: 'edit'; data: MethodologyResource }
  | null;

const defaultStatus: MethodologyStatus = 'Pendiente';
const createDefaultResourceDraft = (moduleId: string): CreateMethodologyResourceInput => ({ type: 'doc', title: '', moduleId, description: '', status: 'Pendiente', linksDocs: '', metadata: '' });
const defaultModuleDraft: CreateMethodologyModuleInput = { id: '', title: '', description: '', status: 'Pendiente' };

const normalizeStatus = (value: string): MethodologyStatus => value === 'Completado' || value === 'En progreso' || value === 'Pendiente' ? value : defaultStatus;
const normalizeResourceType = (value: string): ResourceType => value === 'doc' || value === 'sheet' || value === 'chart' ? value : 'doc';

const MetodologiaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Documentación');
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(initialModules[0].id);
  const [modules, setModules] = useState(initialModules);
  const [phases, setPhases] = useState(initialPhases);
  const [resources, setResources] = useState(initialResources);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [showCreateResource, setShowCreateResource] = useState(false);
  const [newResource, setNewResource] = useState<CreateMethodologyResourceInput>(createDefaultResourceDraft(initialModules[0].id));
  const [newModule, setNewModule] = useState<CreateMethodologyModuleInput>(defaultModuleDraft);
  const { info, successAction, error } = useToast();
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.replace('#', ''));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const filteredResources = useMemo(() => ({
    Documentación: resources,
    'Enlazado interno': resources.filter((r) => r.title.toLowerCase().includes('enlazado') || r.title.toLowerCase().includes('link')),
    'URLs clave': resources.filter((r) => r.title.toLowerCase().includes('sitemap') || r.title.toLowerCase().includes('dashboard')),
    Plantillas: resources.filter((r) => r.title.toLowerCase().includes('brief') || r.title.toLowerCase().includes('checklist')),
    KPIs: resources.filter((r) => r.title.toLowerCase().includes('dashboard')),
    'Notas rápidas': [],
  }[activeTab] ?? []), [activeTab, resources]);

  const openResource = (title: string) => window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(title)}`, '_blank', 'noopener,noreferrer');

  const handleResourceSubmit = async () => {
    const normalizedTitle = newResource.title.trim();
    const moduleExists = modules.some((module) => module.id === newResource.moduleId);
    if (!normalizedTitle) return error('Título requerido', 'Completa el título para crear el recurso.');
    if (!moduleExists) return error('Módulo inválido', 'Selecciona un módulo válido.');

    const optimisticItem: MethodologyResource = {
      title: normalizedTitle,
      meta: `${newResource.status} · ${newResource.linksDocs} · ${newResource.metadata}`,
      type: newResource.type,
      moduleId: newResource.moduleId,
      description: newResource.description,
    };

    setResources((current) => [optimisticItem, ...current]);

    try {
      const created = await metodologiaService.createResource({ ...newResource, title: normalizedTitle });
      setResources((current) => [created, ...current.filter((item) => item.title !== optimisticItem.title)]);
      successAction('Recurso creado', 'Se guardó correctamente.');
      setNewResource(createDefaultResourceDraft(modules[0]?.id ?? 'M1'));
      setShowCreateResource(false);
    } catch {
      setResources((current) => current.filter((item) => item.title !== optimisticItem.title));
      error('No se pudo crear el recurso', 'Intenta nuevamente en unos segundos.');
    }
  };

  const handleSave = async () => {
    if (!drawer) return;
    try {
      if (drawer.kind === 'module') {
        const saved = await metodologiaService.updateModule(drawer.data);
        setModules((current) => current.map((m) => m.id === saved.id ? saved : m));
      }
      if (drawer.kind === 'phase') {
        const saved = await metodologiaService.updatePhase(drawer.data);
        setPhases((current) => current.map((p) => p.title === saved.title ? saved : p));
      }
      if (drawer.kind === 'resource') {
        const saved = await metodologiaService.updateResource(drawer.data);
        setResources((current) => current.map((r) => r.title === saved.title ? saved : r));
      }
      successAction('Guardado', 'Cambios persistidos y vistas actualizadas.');
      setDrawer(null);
    } catch {
      error('No se pudo guardar', 'Reintenta en unos segundos.');
    }
  };

  const getResourceIcon = (type: ResourceType) => type === 'sheet' ? <FileSpreadsheet size={16} className="text-emerald-600" /> : type === 'chart' ? <BarChart3 size={16} className="text-violet-600" /> : <FileText size={16} className="text-blue-600" />;

  return <div className="space-y-6 overflow-x-hidden text-slate-800">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex justify-between"><h1 className="text-3xl font-bold text-slate-900">Metodología</h1><Button onClick={() => setShowCreateResource(true)}>+ Añadir recurso</Button></div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => { const Icon = item.icon; return <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon size={18} /><p>{item.value} {item.label}</p></article>; })}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2>Estructura</h2>{modules.map((m) => <div key={m.id} className="rounded-xl border p-3 mt-2"><div className="flex items-center gap-2"><GripVertical size={14}/><span>{m.id}</span><p className="flex-1">{m.title}</p><Badge variant={STATUS_VARIANTS[m.status]}>{m.status}</Badge><button onClick={() => setDrawer({ kind: 'module', mode: 'edit', data: m })}><SquarePen size={14}/></button><button onClick={() => setExpandedModuleId(expandedModuleId === m.id ? null : m.id)}><ChevronDown size={14}/></button></div>{expandedModuleId===m.id && <p className="text-sm">{m.description} · {m.docs} docs · {m.links} links</p>}</div>)}</section>
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-2 flex-wrap">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>{filteredResources.map((resource) => <article key={resource.title} className="border rounded p-3 mt-2"><div className="flex gap-2 items-center">{getResourceIcon(resource.type)}<p className="flex-1">{resource.title}</p><button onClick={() => setDrawer({ kind: 'resource', mode: 'edit', data: resource })}><SquarePen size={14}/></button><button onClick={() => openResource(resource.title)}><ExternalLink size={14}/></button></div></article>)}</aside>

    {showCreateResource && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-slate-900/30" onClick={() => setShowCreateResource(false)} /><div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white p-5 shadow-2xl overflow-auto"><div className="flex justify-between"><h3>Nuevo recurso</h3><button onClick={() => setShowCreateResource(false)}><X size={16}/></button></div><div className="space-y-2 mt-4"><select className="w-full border p-2" value={newResource.type} onChange={(e) => setNewResource((current) => ({ ...current, type: normalizeResourceType(e.target.value) }))}><option value="doc">Documento</option><option value="sheet">Hoja</option><option value="chart">Dashboard</option></select><input className="w-full border p-2" value={newResource.title} onChange={(e) => setNewResource((current) => ({ ...current, title: e.target.value }))} placeholder="Título *"/><select className="w-full border p-2" value={newResource.moduleId} onChange={(e) => setNewResource((current) => ({ ...current, moduleId: e.target.value }))}>{modules.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.title}</option>)}</select><textarea className="w-full border p-2" value={newResource.description} onChange={(e) => setNewResource((current) => ({ ...current, description: e.target.value }))} placeholder="Descripción"/><select className="w-full border p-2" value={newResource.status} onChange={(e) => setNewResource((current) => ({ ...current, status: normalizeStatus(e.target.value) }))}><option>Completado</option><option>En progreso</option><option>Pendiente</option></select><input className="w-full border p-2" value={newResource.linksDocs} onChange={(e) => setNewResource((current) => ({ ...current, linksDocs: e.target.value }))} placeholder="Enlaces / docs"/><input className="w-full border p-2" value={newResource.metadata} onChange={(e) => setNewResource((current) => ({ ...current, metadata: e.target.value }))} placeholder="Metadatos"/></div><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowCreateResource(false)}>Cancelar</Button><Button onClick={() => void handleResourceSubmit()}>Crear recurso</Button></div></div></div>}

    {drawer && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-slate-900/30" onClick={() => setDrawer(null)} /><div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white p-5 shadow-2xl overflow-auto"><div className="flex justify-between"><h3>Editar {drawer.kind}</h3><button onClick={() => setDrawer(null)}><X size={16}/></button></div>
      {drawer.kind === 'module' && <div className="space-y-2 mt-4"><input className="w-full border p-2" value={drawer.data.id} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, id: e.target.value } })}/><input className="w-full border p-2" value={drawer.data.title} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, title: e.target.value } })}/></div>}
      {drawer.kind === 'resource' && <div className="space-y-2 mt-4"><input className="w-full border p-2" value={drawer.data.title} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, title: e.target.value } })}/><input className="w-full border p-2" value={drawer.data.meta} onChange={(e) => setDrawer({ ...drawer, data: { ...drawer.data, meta: e.target.value } })}/></div>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDrawer(null)}>Cancelar</Button><Button onClick={() => void handleSave()}>Guardar</Button></div>
    </div></div>}
  </div>;
};

export default MetodologiaPage;
