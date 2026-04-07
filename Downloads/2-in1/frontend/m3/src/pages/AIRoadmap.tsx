import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useProject } from '../context/ProjectContext';
import { useSettings } from '../context/SettingsContext';
import { generateAIRoadmap } from '../services/aiRoadmapService';
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
} from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

const AIRoadmap: React.FC = () => {
  const { currentClient, updateAIRoadmap, importMultipleAIRoadmapTasks, modules } = useProject();
  const { settings } = useSettings();
  const { success, error } = useToast();

  const [auditText, setAuditText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'mistral' | 'gemini' | ''>(
    '',
  );

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
    // Set default provider if none selected or current selection is invalid
    if (availableProviders.length > 0) {
      if (!selectedProvider || !availableProviders.find((p) => p.id === selectedProvider)) {
        setSelectedProvider(availableProviders[0].id as any);
      }
    } else {
      setSelectedProvider('');
    }
  }, [settings.mistralApiKey, settings.openaiApiKey, settings.geminiApiKey]);

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

      const newTasks = await generateAIRoadmap(auditText, allSystemTasks, {
        provider: selectedProvider as any,
        apiKey: providerConfig.key,
        model: providerConfig.model,
      });

      updateAIRoadmap(newTasks);
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
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-brand">
          <BrainCircuit size={24} />
        </div>
        <div>
          <h1 className="section-title">Roadmap IA Personalizado</h1>
          <p className="section-subtitle">Genera una estrategia paralela basada en auditoría.</p>
        </div>
      </div>

      {/* Input Section */}
      <Card className="mb-8 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <label className="block text-sm font-bold text-foreground">
            Auditoría / Necesidades del Cliente
          </label>

          {availableProviders.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Generar con:</span>
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
          placeholder="Pega aquí los puntos clave de la auditoría, debilidades técnicas, necesidades de contenido, etc..."
          className="form-textarea min-h-[120px] resize-y"
        />
        <div className="flex justify-end mt-4">
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

      {/* Results Section */}
      {tasks.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">
              Estrategia Generada ({tasks.length} Tareas)
            </h3>
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
                    <Draggable key={task.id} draggableId={task.id} index={index}>
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
                            className="p-4 flex items-start gap-4 cursor-pointer"
                            onClick={() =>
                              setExpandedTask(expandedTask === task.id ? null : task.id)
                            }
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="icon-tone-muted mt-1 cursor-grab p-1 active:cursor-grabbing"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical size={20} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getImpactColor(task.impact)}`}
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
                                    Módulo{' '}
                                    {modules.find((m) => m.title === 'MIA: Fichas de IA')?.id}
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
                              className="px-5 pb-5 pt-0 pl-[4.5rem] cursor-default"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="mb-4 text-sm leading-relaxed text-muted">
                                {task.description}
                              </p>
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
