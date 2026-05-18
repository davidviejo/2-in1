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
import { useMetodologiaKpis, useMetodologiaModules, useMetodologiaPhases, useMetodologiaResources } from '@/hooks/useMetodologia';
import { buildPhaseTableRows, buildResourceTableRows, filterResourcesByTab, findInitialExpandedModuleId, metodologiaTabs } from '@/lib/metodologia';
import type { KPI } from '@/types/metodologia';

const MetodologiaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Documentación');
  const { data: modules = [] } = useMetodologiaModules();
  const { data: phases = [] } = useMetodologiaPhases();
  const { data: resources = [] } = useMetodologiaResources();
  const { data: kpis = [] } = useMetodologiaKpis();
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const { info, successAction } = useToast();
  const location = useLocation();

  useEffect(() => {
    if (!expandedModuleId) {
      setExpandedModuleId(findInitialExpandedModuleId(modules));
    }
  }, [expandedModuleId, modules]);

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

  const iconByKpi: Record<KPI['icon'], React.ComponentType<{ size?: number }>> = {
    layers: Layers,
    workflow: Workflow,
    bookOpen: BookOpen,
    link2: Link2,
  };

  const phaseIconByTitle: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Descubrimiento: Target,
    'Auditoría inicial': CircleDashed,
    Priorización: TrendingUp,
    'Plan de acción': PencilRuler,
    Implementación: Wrench,
    Validación: ListTodo,
    'Mejora continua': BarChart3,
  };

  const filteredResources = filterResourcesByTab(resources, activeTab);
  const phaseRows = buildPhaseTableRows(phases);
  const resourceRows = buildResourceTableRows(resources);

  return (
    <div className="space-y-6 overflow-x-hidden text-slate-800">
      <section id="resumen" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Metodología</h1>
            <p className="mt-2 text-sm text-slate-600">Centraliza el proceso de trabajo, documentación y recursos estratégicos del proyecto.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => successAction('Recurso en creación', 'Abrimos el flujo para añadir un nuevo recurso.')}>+ Añadir recurso</Button>
            <Button variant="secondary" onClick={() => info('Editor de estructura', 'Aquí podrás reordenar módulos y fases en los próximos pasos.')}>Editar estructura</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = iconByKpi[item.icon];
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
                  const Icon = phaseIconByTitle[phase.title] ?? Workflow;
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
            {metodologiaTabs.map((tab) => (
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
            {filteredResources.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
              No hay recursos para esta pestaña todavía.
            </p>}
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
              {phaseRows.map((row) => (
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
              {resourceRows.map((row) => (
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
