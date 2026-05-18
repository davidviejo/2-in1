import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CircleDashed, ExternalLink, FileSpreadsheet, FileText, GripVertical, Layers, Link2, ListTodo, MoreHorizontal,
  NotebookText, PencilRuler, Share2, Target, TrendingUp, Workflow, Wrench, BarChart3, Copy, ChevronDown, Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastContext';
import { useLocation } from 'react-router-dom';
import { metodologiaService, ModuleItem, PhaseItem, ResourceItem, StatusType } from '@/services/metodologiaService';

type EditorMode = 'edit' | 'create';
type EntityType = 'module' | 'phase' | 'resource';

const statusVariantMap: Record<StatusType, 'success' | 'warning' | 'default'> = { Completado: 'success', 'En progreso': 'warning', Pendiente: 'default' };
const phaseIcons = [Target, CircleDashed, TrendingUp, PencilRuler, Wrench, ListTodo, BarChart3];
const tabs = ['Documentación', 'Enlazado interno', 'URLs clave', 'Plantillas', 'KPIs', 'Notas rápidas'];

const initialModules: ModuleItem[] = [
  { id: 'M1', title: 'Auditoría inicial', description: 'Análisis del estado actual del sitio y detección de oportunidades.', status: 'Completado', docs: 6, links: 3 },
  { id: 'M2', title: 'Estrategia y verticales', description: 'Definición de verticales, segmentos y priorización de acciones.', status: 'En progreso', docs: 5, links: 2 },
];
const initialPhases: PhaseItem[] = [
  { title: 'Descubrimiento', desc: 'Recopilación de contexto, objetivos, stakeholders y recursos existentes.', deliverables: ['Brief inicial', 'Mapa de stakeholders'], status: 'Completado' },
  { title: 'Auditoría inicial', desc: 'Revisión SEO técnica, contenidos, arquitectura y rendimiento.', deliverables: ['Informe de auditoría', 'Checklist técnico'], status: 'En progreso' },
  { title: 'Priorización', desc: 'Ordenamos hallazgos según impacto, esfuerzo y dependencia.', deliverables: ['Matriz ICE', 'Backlog priorizado'], status: 'Pendiente' },
];
const initialResources: ResourceItem[] = [
  { title: 'Guía de Metodología SEO - v2.1', meta: 'Google Docs · Actualizado hace 5 días', type: 'doc', module: 'M1', description: 'Manual completo.' },
  { title: 'Checklist de auditoría', meta: 'Hoja de cálculo · v1.1', type: 'sheet', module: 'M2', description: 'Checklist técnico.' },
];

const MetodologiaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Documentación');
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(initialModules[0].id);
  const [modules, setModules] = useState(initialModules);
  const [phases, setPhases] = useState(initialPhases);
  const [resources, setResources] = useState(initialResources);
  const [editor, setEditor] = useState<{ open: boolean; type: EntityType; mode: EditorMode; index: number | null }>({ open: false, type: 'module', mode: 'edit', index: null });
  const [form, setForm] = useState<Record<string, string>>({});
  const { info, successAction } = useToast();
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.replace('#', ''))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const kpis = useMemo(() => [
    { label: 'módulos', value: String(modules.length), subtitle: 'Estructura definida', icon: Layers },
    { label: 'fases', value: String(phases.length), subtitle: 'De principio a fin', icon: Workflow },
    { label: 'recursos', value: String(resources.length), subtitle: 'Documentación y guías', icon: BookOpen },
    { label: 'enlaces internos', value: String(modules.reduce((acc, m) => acc + m.links, 0)), subtitle: 'Referencias activas', icon: Link2 },
  ], [modules, phases, resources]);

  const tabResources = useMemo((): Record<string, ResourceItem[]> => ({
    Documentación: resources,
    'Enlazado interno': resources.filter((r) => r.title.toLowerCase().includes('enlazado') || r.title.toLowerCase().includes('link')),
    'URLs clave': resources.filter((r) => r.title.toLowerCase().includes('sitemap') || r.title.toLowerCase().includes('dashboard')),
    Plantillas: resources.filter((r) => r.title.toLowerCase().includes('brief') || r.title.toLowerCase().includes('checklist')),
    KPIs: resources.filter((r) => r.title.toLowerCase().includes('dashboard')),
    'Notas rápidas': [],
  }), [resources]);

  const openEditor = (type: EntityType, mode: EditorMode, index: number | null) => {
    const source = type === 'module' ? modules[index ?? 0] : type === 'phase' ? phases[index ?? 0] : resources[index ?? 0];
    setForm(source ? Object.fromEntries(Object.entries(source).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)])) : {});
    setEditor({ open: true, type, mode, index });
  };

  const saveEditor = async () => {
    if (editor.type === 'module') {
      const next: ModuleItem = { id: form.id, title: form.title, description: form.description, status: (form.status as StatusType) || 'Pendiente', docs: Number(form.docs || 0), links: Number(form.links || 0) };
      const saved = await metodologiaService.updateModule(next);
      setModules((prev) => prev.map((m, i) => (i === editor.index ? saved : m)));
    } else if (editor.type === 'phase') {
      const next: PhaseItem = { title: form.title, desc: form.desc, status: (form.status as StatusType) || 'Pendiente', deliverables: (form.deliverables || '').split(',').map((d) => d.trim()).filter(Boolean) };
      const saved = await metodologiaService.updatePhase(next);
      setPhases((prev) => prev.map((p, i) => (i === editor.index ? saved : p)));
    } else {
      const next: ResourceItem = { title: form.title, meta: form.meta, type: form.type, module: form.module, description: form.description };
      const saved = await metodologiaService.updateResource(next);
      setResources((prev) => prev.map((r, i) => (i === editor.index ? saved : r)));
    }
    setEditor((e) => ({ ...e, open: false }));
    successAction('Guardado', 'Cambios persistidos y vistas actualizadas.');
  };

  const getResourceIcon = (type: string) => type === 'sheet' ? <FileSpreadsheet size={16} className="text-emerald-600" /> : type === 'chart' ? <BarChart3 size={16} className="text-violet-600" /> : <FileText size={16} className="text-blue-600" />;
  const filteredResources = tabResources[activeTab] ?? [];

  return <div className="space-y-6 overflow-x-hidden text-slate-800">{/* UI omitted for brevity in instruction kept */}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Estructura de la metodología</h2><div className="mt-4 space-y-3">{modules.map((m, idx) => <div key={m.id} className="rounded-xl border p-4"><div className="flex items-center gap-2"><GripVertical size={16} /><span>{m.id}</span><div className="flex-1"><p>{m.title}</p></div><Badge variant={statusVariantMap[m.status]}>{m.status}</Badge><button onClick={() => openEditor('module', 'edit', idx)}><Edit3 size={14} /></button><button onClick={() => setExpandedModuleId((c) => c === m.id ? null : m.id)}><ChevronDown size={16} /></button></div>{expandedModuleId === m.id && <p>{m.description}</p>}</div>)}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Cómo aplicamos la metodología</h2><div className="grid gap-4 sm:grid-cols-2">{phases.map((phase, idx) => { const Icon = phaseIcons[idx % phaseIcons.length]; return <div key={phase.title} className="rounded-2xl border p-4"><div className="flex justify-between"><Icon size={20} /><Badge variant={statusVariantMap[phase.status]}>{phase.status}</Badge></div><p>{phase.title}</p><button onClick={() => openEditor('phase', 'edit', idx)} className="text-xs">Editar fase</button></div>; })}</div></section>
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mt-2 flex gap-2">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>{filteredResources.map((resource, idx) => <article key={resource.title} className="rounded-xl border p-3"><div className="flex items-center gap-2">{getResourceIcon(resource.type)}<p className="flex-1">{resource.title}</p><button onClick={() => openEditor('resource', 'edit', idx)}><Edit3 size={14} /></button><button onClick={() => info('Abrir', resource.title)}><ExternalLink size={14} /></button><Share2 size={14} /><Copy size={14} /><MoreHorizontal size={14} /></div></article>)}</aside>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2>Biblioteca de recursos</h2><table className="min-w-full"><tbody>{resources.map((r, idx) => <tr key={r.title}><td><span className="inline-flex items-center gap-2"><NotebookText size={13} />{r.type}</span></td><td>{r.title}</td><td><Badge variant="info">{r.module}</Badge></td><td>{r.description}</td><td>{r.meta}</td><td><button onClick={() => openEditor('resource', 'edit', idx)}><Edit3 size={14} /></button></td></tr>)}</tbody></table></section>
    {editor.open && <div className="fixed inset-0 z-40"><button className="absolute inset-0 bg-black/30" onClick={() => setEditor((e) => ({ ...e, open: false }))} /><aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white p-5 shadow-2xl"><h3 className="font-semibold">{editor.mode === 'edit' ? 'Editar' : 'Crear'} {editor.type}</h3><div className="mt-3 space-y-2">{Object.entries(form).map(([key, value]) => <label key={key} className="block"><span className="text-xs uppercase">{key}</span><input className="mt-1 w-full rounded border px-2 py-1" value={value} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /></label>)}</div><div className="mt-4 flex gap-2"><Button variant="secondary" onClick={() => setEditor((e) => ({ ...e, open: false }))}>Cancelar</Button><Button onClick={() => void saveEditor()}>Guardar</Button></div></aside></div>}
  </div>;
};

export default MetodologiaPage;
