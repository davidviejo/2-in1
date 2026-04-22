import React, { useMemo, useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useProject } from '../context/ProjectContext';
import { useSettings } from '../context/SettingsContext';
import { generateAIRoadmap } from '@/features/client-management/roadmap/api/roadmapApi';
import { useToast } from '../components/ui/ToastContext';
import {
  Sparkles,
  Trash2,
  GripVertical,
  ChevronDown,
  BrainCircuit,
  Settings,
  ArrowDownCircle,
  ExternalLink,
  WandSparkles,
  ClipboardPlus,
} from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useGSCAuth } from '../hooks/useGSCAuth';
import { useGSCData } from '../hooks/useGSCData';
import { useSeoInsightState } from '../hooks/useSeoInsightState';
import {
  AIRoadmapPromptTemplateKey,
  AIRoadmapTraceItem,
  GeoScope,
  ProjectType,
  Task,
} from '@/types';

const PROMPT_TEMPLATES: Record<
  AIRoadmapPromptTemplateKey,
  { label: string; objective: string; guidance: string }
> = {
  growth: {
    label: 'Crecimiento orgánico',
    objective: 'Escalar tráfico orgánico de calidad y cuota no-brand.',
    guidance:
      'Construye un plan priorizado por impacto en clics, impresiones y cobertura temática, con quick wins + iniciativas estructurales.',
  },
  local_seo: {
    label: 'SEO local',
    objective: 'Mejorar visibilidad local y captación por intención geográfica.',
    guidance:
      'Prioriza local pack, páginas locales, consistencia NAP, señales de reputación y enlazado local por zona.',
  },
  quick_wins: {
    label: 'Quick wins',
    objective: 'Capturar mejoras rápidas en 30 días.',
    guidance:
      'Enfócate en optimizaciones de CTR, snippets, canibalización, enlaces internos y tareas bloqueadas de bajo esfuerzo.',
  },
  traffic_recovery: {
    label: 'Recuperación de caída',
    objective: 'Detener y revertir pérdida de tráfico/clics.',
    guidance:
      'Diagnostica causas raíz, prioriza riesgos críticos y define secuencia de recuperación con validaciones quincenales.',
  },
  quarterly_plan: {
    label: 'Roadmap trimestral',
    objective: 'Orquestar ejecución SEO de 90 días con hitos.',
    guidance:
      'Divide en fases (semanas 1-4, 5-8, 9-12), dependencias, responsables y KPIs de validación por módulo.',
  },
};

const OPEN_INSIGHT_STATUSES = new Set([
  'new',
  'triaged',
  'planned',
  'in_progress',
  'postponed',
  'actionable',
  'watch',
  'investigate',
]);

const BLOCKED_TASK_TERMS = ['blocked', 'bloqueada', 'bloqueado', 'pending', 'pendiente'];

const calculateModuleScore = (tasks: Task[]) => {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.status === 'completed').length;
  return Math.round((completed / tasks.length) * 100);
};

const normalizeProjectProfile = (projectType?: ProjectType, sector?: string, geoScope?: GeoScope) => ({
  projectType: projectType || 'MEDIA',
  sector: sector?.trim() || 'Genérico',
  geoScope: geoScope || 'global',
});

const formatTraceLine = (item: AIRoadmapTraceItem) => {
  const detailParts = [item.detail];
  if (item.priority) detailParts.push(`prioridad ${item.priority}`);
  if (item.property) detailParts.push(`propiedad ${item.property}`);
  if (item.module) detailParts.push(`módulo ${item.module}`);
  if (item.query) detailParts.push(`query ${item.query}`);
  if (item.url) detailParts.push(`url ${item.url}`);
  if (item.currentPeriod || item.previousPeriod) {
    detailParts.push(
      `periodo ${item.currentPeriod || 'n/d'}${item.previousPeriod ? ` vs ${item.previousPeriod}` : ''}`,
    );
  }
  return `- ${item.label}: ${detailParts.join(' · ')}`;
};

const AIRoadmap: React.FC = () => {
  const { currentClient, updateAIRoadmap, importMultipleAIRoadmapTasks, modules, saveAIRoadmapGeneration } =
    useProject();
  const { settings } = useSettings();
  const { success, error } = useToast();
  const { gscAccessToken } = useGSCAuth();

  const [auditText, setAuditText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'mistral' | 'gemini' | ''>(
    '',
  );
  const [selectedTemplate, setSelectedTemplate] = useState<AIRoadmapPromptTemplateKey>('growth');

  const projectProfile = normalizeProjectProfile(
    currentClient?.projectType,
    currentClient?.sector,
    currentClient?.geoScope,
  );

  const { insights, comparisonPeriod, selectedSite } = useGSCData(
    gscAccessToken,
    undefined,
    undefined,
    'previous_period',
    {
      propertyId: currentClient?.id,
      projectType: projectProfile.projectType,
      analysisProjectTypes: currentClient?.analysisProjectTypes || [projectProfile.projectType],
      sector: projectProfile.sector,
      geoScope: projectProfile.geoScope,
      brandTerms: currentClient?.brandTerms || [],
    },
  );
  const { getInsightStatus } = useSeoInsightState(currentClient?.id || 'global');

  const tasks = currentClient?.aiRoadmap || [];

  const availableProviders = [
    {
      id: 'mistral',
      name: 'Mistral AI',
      key: settings.mistralApiKey,
      model: settings.mistralModel || 'mistral-large-latest',
    },
    {
      id: 'openai',
      name: 'OpenAI (ChatGPT)',
      key: settings.openaiApiKey,
      model: settings.openaiModel || 'gpt-4o',
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      key: settings.geminiApiKey,
      model: settings.geminiModel || 'gemini-1.5-pro',
    },
  ].filter((p) => !!p.key);

  useEffect(() => {
    if (availableProviders.length > 0) {
      if (!selectedProvider || !availableProviders.find((p) => p.id === selectedProvider)) {
        setSelectedProvider(availableProviders[0].id as any);
      }
    } else {
      setSelectedProvider('');
    }
  }, [settings.mistralApiKey, settings.openaiApiKey, settings.geminiApiKey]);

  const weakestModules = useMemo(
    () =>
      modules
        .map((module) => {
          const score = calculateModuleScore(module.tasks);
          const openTasks = module.tasks.filter((task) => task.status !== 'completed').length;
          return {
            id: `module-${module.id}`,
            label: `${module.title}`,
            detail: `score ${score}/100 · ${openTasks} tareas abiertas`,
            module: module.title,
            timestamp: Date.now(),
            score,
          };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 4),
    [modules],
  );

  const prioritizedOpenInsights = useMemo(() => {
    return (insights.insights || [])
      .filter((insight) => OPEN_INSIGHT_STATUSES.has(getInsightStatus(insight)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((insight) => ({
        id: insight.id,
        label: insight.title,
        detail: insight.summary,
        priority: insight.priority,
        module: insight.moduleId ? `M${insight.moduleId}` : undefined,
        property: insight.propertyId,
        query: insight.trace?.query,
        url: insight.trace?.url,
        currentPeriod: insight.periodCurrent
          ? `${insight.periodCurrent.startDate}→${insight.periodCurrent.endDate}`
          : undefined,
        previousPeriod: insight.periodPrevious
          ? `${insight.periodPrevious.startDate}→${insight.periodPrevious.endDate}`
          : undefined,
        timestamp: insight.updatedAt || insight.createdAt || Date.now(),
      }));
  }, [getInsightStatus, insights.insights]);

  const quickWins = useMemo(
    () =>
      (insights.quickWinsLayer || []).slice(0, 4).map((insight) => ({
        id: insight.id,
        label: insight.title,
        detail: insight.suggestedAction || insight.summary,
        priority: insight.priority,
        property: insight.propertyId,
        query: insight.trace?.query,
        url: insight.trace?.url,
        currentPeriod: insight.periodCurrent
          ? `${insight.periodCurrent.startDate}→${insight.periodCurrent.endDate}`
          : undefined,
        previousPeriod: insight.periodPrevious
          ? `${insight.periodPrevious.startDate}→${insight.periodPrevious.endDate}`
          : undefined,
        timestamp: insight.updatedAt || insight.createdAt || Date.now(),
      })),
    [insights.quickWinsLayer],
  );

  const weakestProperties = useMemo(() => {
    const propertySnapshots = (currentClient?.seoSnapshots || []).filter(
      (snapshot) => snapshot.scope === 'property',
    );
    const byProperty = new Map<string, typeof propertySnapshots>();

    propertySnapshots.forEach((snapshot) => {
      const bucket = byProperty.get(snapshot.scopeId) || [];
      bucket.push(snapshot);
      byProperty.set(snapshot.scopeId, bucket);
    });

    return Array.from(byProperty.entries())
      .map(([propertyId, snapshots]) => {
        const sorted = [...snapshots].sort((a, b) => b.timestamp - a.timestamp);
        const current = sorted[0];
        const previous = sorted[1];
        if (!current || !previous) return null;
        const deltaClicks = current.metrics.clicks - previous.metrics.clicks;

        return {
          id: `property-${propertyId}`,
          label: current.scopeLabel || propertyId,
          detail: `Δ clicks ${deltaClicks.toFixed(0)} · actual ${current.metrics.clicks.toFixed(0)} · anterior ${previous.metrics.clicks.toFixed(0)}`,
          property: current.property,
          currentPeriod: `${current.period.currentStart}→${current.period.currentEnd}`,
          previousPeriod: previous.period.previousStart
            ? `${previous.period.previousStart}→${previous.period.previousEnd}`
            : `${previous.period.currentStart}→${previous.period.currentEnd}`,
          timestamp: current.timestamp,
          deltaClicks,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.deltaClicks - b.deltaClicks)
      .slice(0, 3);
  }, [currentClient?.seoSnapshots]);

  const blockedOrPendingTasks = useMemo(
    () =>
      modules
        .flatMap((module) =>
          module.tasks.map((task) => ({ module, task })).filter(({ task }) => {
            const normalized = (task.status || '').toLowerCase();
            return BLOCKED_TASK_TERMS.some((term) => normalized.includes(term));
          }),
        )
        .slice(0, 5)
        .map(({ module, task }) => ({
          id: task.id,
          label: task.title,
          detail: `estado ${task.status || 'pendiente'} · impacto ${task.impact}`,
          module: module.title,
          timestamp: Date.now(),
        })),
    [modules],
  );

  const contextBlocks = useMemo(() => {
    const quickWinsBlock = quickWins.length ? quickWins : [];
    return {
      weakestModules,
      prioritizedOpenInsights,
      quickWins: quickWinsBlock,
      weakestProperties,
      blockedOrPendingTasks,
    };
  }, [blockedOrPendingTasks, prioritizedOpenInsights, quickWins, weakestModules, weakestProperties]);

  const insertLinesIntoTextarea = (lines: string[]) => {
    const compactLines = lines.filter(Boolean);
    if (!compactLines.length) return;
    setAuditText((prev) => `${prev.trim() ? `${prev.trim()}\n\n` : ''}${compactLines.join('\n')}`);
  };

  const handleInsertTemplate = () => {
    const template = PROMPT_TEMPLATES[selectedTemplate];
    insertLinesIntoTextarea([
      `Objetivo del roadmap IA: ${template.label}.`,
      `Contexto de proyecto: ${projectProfile.projectType} · ${projectProfile.sector} · ${projectProfile.geoScope}.`,
      `Objetivo operativo: ${template.objective}`,
      `Guía: ${template.guidance}`,
    ]);
  };

  const handleInsertAutoContext = () => {
    insertLinesIntoTextarea([
      `Contexto trazable generado automáticamente (${new Date().toISOString()}):`,
      '[Módulos con peor score]',
      ...contextBlocks.weakestModules.map(formatTraceLine),
      '[Insights abiertos prioritarios]',
      ...contextBlocks.prioritizedOpenInsights.map(formatTraceLine),
      '[Quick wins detectados]',
      ...contextBlocks.quickWins.map(formatTraceLine),
      '[Propiedades con peor evolución]',
      ...contextBlocks.weakestProperties.map(formatTraceLine),
      '[Tareas bloqueadas o pendientes]',
      ...contextBlocks.blockedOrPendingTasks.map(formatTraceLine),
      `Fuente GSC: ${selectedSite || 'sin propiedad seleccionada'} · periodo actual ${comparisonPeriod?.current?.startDate || 'n/d'}→${comparisonPeriod?.current?.endDate || 'n/d'} · periodo anterior ${comparisonPeriod?.previous?.startDate || 'n/d'}→${comparisonPeriod?.previous?.endDate || 'n/d'}`,
    ]);
  };

  const handleGenerate = async () => {
    if (!auditText.trim()) {
      error('Por favor ingresa una auditoría o necesidades del cliente.');
      return;
    }

    if (!selectedProvider) {
      error('No hay ninguna API Key configurada. Ve a Ajustes.');
      return;
    }

    const providerConfig = availableProviders.find((p) => p.id === selectedProvider);
    if (!providerConfig || !providerConfig.key) {
      error('Error de configuración del proveedor.');
      return;
    }

    setIsGenerating(true);
    try {
      const allSystemTasks = modules.flatMap((m) =>
        m.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
        })),
      );

      const contextualPrompt = [
        `Proyecto: ${projectProfile.projectType} · ${projectProfile.sector} · ${projectProfile.geoScope}`,
        `Template seleccionado: ${PROMPT_TEMPLATES[selectedTemplate].label}`,
        '',
        auditText,
      ].join('\n');

      const newTasks = await generateAIRoadmap(contextualPrompt, allSystemTasks, {
        provider: selectedProvider as any,
        apiKey: providerConfig.key,
        model: providerConfig.model,
      });

      updateAIRoadmap(newTasks);
      saveAIRoadmapGeneration({
        provider: selectedProvider,
        model: providerConfig.model,
        template: selectedTemplate,
        promptInput: contextualPrompt,
        generatedTaskIds: newTasks.map((task) => task.id),
        contextSnapshot: {
          projectType: projectProfile.projectType,
          sector: projectProfile.sector,
          geoScope: projectProfile.geoScope,
          property: selectedSite || currentClient?.name,
          currentPeriod: comparisonPeriod
            ? `${comparisonPeriod.current.startDate}→${comparisonPeriod.current.endDate}`
            : undefined,
          previousPeriod: comparisonPeriod
            ? `${comparisonPeriod.previous.startDate}→${comparisonPeriod.previous.endDate}`
            : undefined,
          weakModules: contextBlocks.weakestModules,
          openInsights: contextBlocks.prioritizedOpenInsights,
          quickWins: contextBlocks.quickWins,
          weakestProperties: contextBlocks.weakestProperties,
          blockedTasks: contextBlocks.blockedOrPendingTasks,
        },
      });

      success(
        `Roadmap generado con éxito usando ${providerConfig.name} (${providerConfig.model}).`,
      );
    } catch (e) {
      console.error(e);
      error('Error generando el roadmap. Revisa la consola o intenta de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    updateAIRoadmap(items);
  };

  const handleDeleteTask = (taskId: string) => {
    const newTasks = tasks.filter((t) => t.id !== taskId);
    updateAIRoadmap(newTasks);
  };

  const handleImportAll = () => {
    if (tasks.length === 0) return;
    importMultipleAIRoadmapTasks(tasks);
    success("Todas las tareas han sido volcadas al módulo 'MIA: Fichas de IA'.");
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'High':
        return 'text-danger bg-danger-soft border-danger/20';
      case 'Medium':
        return 'text-warning bg-warning-soft border-warning/20';
      case 'Low':
        return 'text-muted bg-surface-alt border-border';
      default:
        return 'text-muted';
    }
  };

  return (
    <div className="page-shell mx-auto max-w-4xl animate-fade-in pb-20">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-brand">
          <BrainCircuit size={24} />
        </div>
        <div>
          <h1 className="section-title">Roadmap IA Personalizado</h1>
          <p className="section-subtitle">Genera una estrategia asistida por contexto real del proyecto.</p>
        </div>
      </div>

      <Card className="mb-6 rounded-2xl p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge variant="secondary">Proyecto: {projectProfile.projectType}</Badge>
          <Badge variant="secondary">Sector: {projectProfile.sector}</Badge>
          <Badge variant="secondary">Geo: {projectProfile.geoScope}</Badge>
          <Badge variant="outline">Propiedad: {selectedSite || 'No conectada'}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-alt p-3">
            <p className="text-xs font-semibold text-foreground">Ayudas de contexto</p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              <li>• Módulos débiles: {contextBlocks.weakestModules.length}</li>
              <li>• Insights abiertos: {contextBlocks.prioritizedOpenInsights.length}</li>
              <li>• Quick wins: {contextBlocks.quickWins.length}</li>
              <li>• Propiedades con caída: {contextBlocks.weakestProperties.length}</li>
              <li>• Tareas bloqueadas/pendientes: {contextBlocks.blockedOrPendingTasks.length}</li>
            </ul>
            <Button onClick={handleInsertAutoContext} variant="secondary" className="mt-3 text-xs">
              <ClipboardPlus size={14} /> Insertar contexto automático
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-surface-alt p-3">
            <p className="text-xs font-semibold text-foreground">Plantilla de objetivo</p>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value as AIRoadmapPromptTemplateKey)}
              className="mt-2 w-full rounded-brand-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            >
              {Object.entries(PROMPT_TEMPLATES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted">{PROMPT_TEMPLATES[selectedTemplate].guidance}</p>
            <Button onClick={handleInsertTemplate} variant="secondary" className="mt-3 text-xs">
              <WandSparkles size={14} /> Insertar plantilla
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mb-8 rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <label className="block text-sm font-bold text-foreground">
            Auditoría / Necesidades del Cliente (manual + asistida)
          </label>

          {availableProviders.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">Generar con:</span>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as any)}
                className="rounded-brand-md border border-border bg-surface-alt px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                {availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Link
              to="/app/settings"
              className="flex items-center gap-1 text-xs text-warning hover:underline"
            >
              <Settings size={12} /> Configurar API Keys
            </Link>
          )}
        </div>

        <textarea
          value={auditText}
          onChange={(e) => setAuditText(e.target.value)}
          placeholder="Pega auditoría, retos y necesidades. Puedes usar 'Insertar contexto automático' y 'Insertar plantilla' para no empezar desde cero..."
          className="form-textarea min-h-[180px] resize-y"
        />
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedProvider}
            className="rounded-xl px-6 py-3 font-bold"
          >
            {isGenerating ? <Spinner size={20} className="text-white" /> : <Sparkles size={20} />}
            {isGenerating ? 'Analizando y Generando...' : 'Generar Roadmap IA'}
          </Button>
        </div>
      </Card>

      {tasks.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-foreground">Estrategia Generada ({tasks.length} Tareas)</h3>
            <Button onClick={handleImportAll} variant="secondary" className="text-sm font-medium">
              <ArrowDownCircle size={16} />
              Volcar todo a MIA
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="ai-roadmap">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {tasks.map((task, index) => (
                    <React.Fragment key={task.id}>
                      <Draggable draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`group rounded-xl border border-border bg-surface transition-all ${
                            snapshot.isDragging
                              ? 'z-50 rotate-1 shadow-xl ring-2 ring-primary'
                              : 'shadow-sm hover:border-primary/40'
                          }`}
                        >
                          <div
                            className="flex cursor-pointer items-start gap-4 p-4"
                            onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="icon-tone-muted mt-1 cursor-grab p-1 active:cursor-grabbing"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical size={20} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getImpactColor(task.impact)}`}
                                >
                                  {task.impact} Impacto
                                </span>
                                {task.category && (
                                  <span className="rounded-full border border-border bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-muted">
                                    {task.category}
                                  </span>
                                )}
                                {task.isCustom && (
                                  <Badge variant="primary" className="text-[10px] font-bold">
                                    AI Custom
                                  </Badge>
                                )}
                                {modules.find((m) => m.title === 'MIA: Fichas de IA') && (
                                  <Link
                                    to={`/app/module/${modules.find((m) => m.title === 'MIA: Fichas de IA')?.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary transition-colors hover:bg-primary-soft/80"
                                    title="Ir al Módulo MIA: Fichas de IA"
                                  >
                                    Módulo {modules.find((m) => m.title === 'MIA: Fichas de IA')?.id}
                                    <ExternalLink size={10} />
                                  </Link>
                                )}
                              </div>
                              <h3 className="mb-1 text-lg font-semibold leading-tight text-foreground">
                                {task.title}
                              </h3>
                              {expandedTask !== task.id && (
                                <p className="line-clamp-1 text-sm leading-relaxed text-muted">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            <div className="icon-tone-muted mt-1">
                              <ChevronDown
                                size={20}
                                className={`transition-transform ${expandedTask === task.id ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </div>

                          {expandedTask === task.id && (
                            <div
                              className="cursor-default px-5 pb-5 pl-[4.5rem] pt-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="mb-4 text-sm leading-relaxed text-muted">{task.description}</p>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger-soft"
                                >
                                  <Trash2 size={16} /> Eliminar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        )}
                      </Draggable>
                    </React.Fragment>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </>
      )}
    </div>
  );
};

export default AIRoadmap;
