import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { ModuleData, Task } from '../types';
import { CheckCircle2, HelpCircle } from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import { enhanceTaskWithMistral, isMistralConfigured } from '../services/mistralService';
import { enhanceTaskWithOpenAI, isOpenAIConfigured } from '../services/openaiService';
import RoadmapTaskItem from '../components/RoadmapTaskItem';

interface ClientRoadmapProps {
  modules: ModuleData[];
  customRoadmapOrder: string[] | undefined;
  onReorder: (newOrder: string[]) => void;
  onToggleTask: (moduleId: number, taskId: string) => void;
  onRemoveFromRoadmap: (moduleId: number, taskId: string) => void;
  onUpdateTaskNotes: (moduleId: number, taskId: string, notes: string) => void;
  onUpdateTaskImpact: (moduleId: number, taskId: string, impact: 'High' | 'Medium' | 'Low') => void;
  clientVertical: string;
  clientName?: string;
  onToggleTaskCommunicated: (moduleId: number, taskId: string) => void;
}

const ClientRoadmap: React.FC<ClientRoadmapProps> = ({
  modules,
  customRoadmapOrder = [],
  onReorder,
  onToggleTask,
  onRemoveFromRoadmap,
  onUpdateTaskNotes,
  onUpdateTaskImpact,
  clientVertical,
  clientName = 'Cliente',
  onToggleTaskCommunicated,
}) => {
  const { success: showSuccess, error: showError } = useToast();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const mistralAvailable = isMistralConfigured();
  const openaiAvailable = isOpenAIConfigured();

  // Vitamin State
  const [vitaminResult, setVitaminResult] = useState<string | null>(null);
  const [isVitaminLoading, setIsVitaminLoading] = useState(false);
  const [vitaminSource, setVitaminSource] = useState<'mistral' | 'openai' | null>(null);

  const [learningMode, setLearningMode] = useState(false);

  const tasks = useMemo(() => {
    // Flatten all tasks that are in the custom roadmap
    const roadmapTasks: { task: Task; moduleId: number }[] = [];
    modules.forEach((m) => {
      m.tasks.forEach((t) => {
        if (t.isInCustomRoadmap) {
          roadmapTasks.push({ task: t, moduleId: m.id });
        }
      });
    });

    // Sort based on customRoadmapOrder
    return roadmapTasks.sort((a, b) => {
      const indexA = customRoadmapOrder.indexOf(a.task.id);
      const indexB = customRoadmapOrder.indexOf(b.task.id);

      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [modules, customRoadmapOrder]);

  // Clear vitamin result when expanding a new task
  useEffect(() => {
    setVitaminResult(null);
  }, [expandedTask]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const newOrder = items.map((i) => i.task.id);
    onReorder(newOrder);
  };

  const handleVitaminAction = useCallback(
    async (task: Task, provider: 'mistral' | 'openai') => {
      setIsVitaminLoading(true);
      setVitaminResult(null);
      setVitaminSource(provider);
      try {
        let result = '';
        if (provider === 'mistral') {
          result = await enhanceTaskWithMistral(task, clientVertical);
        } else {
          result = await enhanceTaskWithOpenAI(task, clientVertical);
        }

        setVitaminResult(result);
        if (result.startsWith('Error')) {
          showError(`Error al conectar con ${provider === 'mistral' ? 'Mistral' : 'OpenAI'}.`);
        } else {
          showSuccess(`Tarea vitaminizada con ${provider === 'mistral' ? 'Mistral' : 'ChatGPT'}.`);
        }
      } catch (e) {
        showError('Error desconocido al vitaminizar.');
      } finally {
        setIsVitaminLoading(false);
      }
    },
    [clientVertical, showError, showSuccess],
  );

  const handleToggleExpand = useCallback((taskId: string) => {
    setExpandedTask((prev) => (prev === taskId ? null : taskId));
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={48} className="text-slate-300 dark:text-slate-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          Tu Hoja de Ruta está vacía
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
          Ve a los módulos y selecciona las tareas clave para construir tu estrategia personalizada.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Roadmap Cliente
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Organiza y prioriza las acciones estratégicas para este proyecto.
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setLearningMode(!learningMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${learningMode ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}
          >
            <HelpCircle size={14} /> Modo Aprendizaje: {learningMode ? 'ON' : 'OFF'}
          </button>
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg text-sm font-bold">
            {tasks.filter((t) => t.task.status === 'completed').length} / {tasks.length} Completadas
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="roadmap">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {tasks.map((item, index) => (
                <RoadmapTaskItem
                  key={item.task.id}
                  item={item}
                  index={index}
                  isExpanded={expandedTask === item.task.id}
                  onToggleExpand={handleToggleExpand}
                  onToggleTask={onToggleTask}
                  onRemoveFromRoadmap={onRemoveFromRoadmap}
                  onUpdateTaskNotes={onUpdateTaskNotes}
                  onUpdateTaskImpact={onUpdateTaskImpact}
                  onToggleTaskCommunicated={onToggleTaskCommunicated}
                  onVitaminAction={handleVitaminAction}
                  clientName={clientName}
                  learningMode={learningMode}
                  mistralAvailable={mistralAvailable}
                  openaiAvailable={openaiAvailable}
                  vitaminResult={expandedTask === item.task.id ? vitaminResult : null}
                  isVitaminLoading={isVitaminLoading}
                  vitaminSource={vitaminSource}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default ClientRoadmap;
