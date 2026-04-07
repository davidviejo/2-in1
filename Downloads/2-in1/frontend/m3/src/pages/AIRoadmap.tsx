import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useProject } from '../context/ProjectContext';
import { useSettings } from '../context/SettingsContext';
import { generateAIRoadmap } from '../services/aiRoadmapService';
import { Task } from '../types';
import { useToast } from '../components/ui/ToastContext';
import {
  Sparkles,
  Bot,
  Zap,
  Check,
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
        return 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 border-rose-100 dark:border-rose-900/50';
      case 'Medium':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-900/50';
      case 'Low':
        return 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700';
      default:
        return 'text-slate-500';
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <BrainCircuit size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Roadmap IA Personalizado
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Genera una estrategia paralela basada en auditoría.
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
        <div className="flex justify-between items-center mb-4">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Auditoría / Necesidades del Cliente
          </label>

          {availableProviders.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Generar con:</span>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as any)}
                className="text-xs bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="flex items-center gap-1 text-xs text-amber-600 hover:underline"
            >
              <Settings size={12} /> Configurar API Keys
            </Link>
          )}
        </div>

        <textarea
          value={auditText}
          onChange={(e) => setAuditText(e.target.value)}
          placeholder="Pega aquí los puntos clave de la auditoría, debilidades técnicas, necesidades de contenido, etc..."
          className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-[120px] focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-y"
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedProvider}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
          >
            {isGenerating ? <Spinner size={20} className="text-white" /> : <Sparkles size={20} />}
            {isGenerating ? 'Analizando y Generando...' : 'Generar Roadmap IA'}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {tasks.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 dark:text-slate-300">
              Estrategia Generada ({tasks.length} Tareas)
            </h3>
            <button
              onClick={handleImportAll}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ArrowDownCircle size={16} />
              Volcar todo a MIA
            </button>
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
                          className={`group bg-white dark:bg-slate-800 border rounded-xl transition-all ${
                            snapshot.isDragging
                              ? 'shadow-xl ring-2 ring-indigo-500 rotate-1 z-50'
                              : 'hover:border-indigo-300 dark:hover:border-indigo-600 shadow-sm'
                          } border-slate-200 dark:border-slate-700`}
                        >
                          <div
                            className="p-4 flex items-start gap-4 cursor-pointer"
                            onClick={() =>
                              setExpandedTask(expandedTask === task.id ? null : task.id)
                            }
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="mt-1 cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400"
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
                                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-800">
                                    {task.category}
                                  </span>
                                )}
                                {task.isCustom && (
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                                    AI Custom
                                  </span>
                                )}
                                {modules.find((m) => m.title === 'MIA: Fichas de IA') && (
                                  <Link
                                    to={`/app/module/${modules.find((m) => m.title === 'MIA: Fichas de IA')?.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 uppercase tracking-wider bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                                    title="Ir al Módulo MIA: Fichas de IA"
                                  >
                                    Módulo{' '}
                                    {modules.find((m) => m.title === 'MIA: Fichas de IA')?.id}
                                    <ExternalLink size={10} />
                                  </Link>
                                )}
                              </div>
                              <h3 className="font-semibold text-lg leading-tight mb-1 text-slate-800 dark:text-slate-200">
                                {task.title}
                              </h3>
                              {expandedTask !== task.id && (
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-1">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            <div className="mt-1 text-slate-400">
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
                              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                                {task.description}
                              </p>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="flex items-center gap-2 px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-sm transition-colors"
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
