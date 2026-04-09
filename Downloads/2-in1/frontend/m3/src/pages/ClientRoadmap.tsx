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

const parseTaskNumericId = (taskId: string): { moduleNumber: number; taskNumber: number } | null => {
  const match = /^m(\d+)-(\d+)$/.exec(taskId);
  if (!match) {
    return null;
  }

  return {
    moduleNumber: Number(match[1]),
    taskNumber: Number(match[2]),
  };
};

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
  const buildTaskKey = useCallback((moduleId: number, taskId: string) => `${moduleId}::${taskId}`, []);
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

    // Sort based on customRoadmapOrder first, then fallback to module/task order
    return roadmapTasks.sort((a, b) => {
      const indexA = customRoadmapOrder.indexOf(a.task.id);
      const indexB = customRoadmapOrder.indexOf(b.task.id);
      const hasCustomOrderA = indexA !== -1;
      const hasCustomOrderB = indexB !== -1;

      if (hasCustomOrderA && hasCustomOrderB) {
        return indexA - indexB;
      }

      if (hasCustomOrderA) {
        return -1;
      }

      if (hasCustomOrderB) {
        return 1;
      }

      if (a.moduleId !== b.moduleId) {
        return a.moduleId - b.moduleId;
      }

      const parsedA = parseTaskNumericId(a.task.id);
      const parsedB = parseTaskNumericId(b.task.id);

      if (parsedA && parsedB) {
        if (parsedA.moduleNumber !== parsedB.moduleNumber) {
          return parsedA.moduleNumber - parsedB.moduleNumber;
        }

        if (parsedA.taskNumber !== parsedB.taskNumber) {
          return parsedA.taskNumber - parsedB.taskNumber;
        }
      }

      if (parsedA && !parsedB) {
        return -1;
      }

      if (!parsedA && parsedB) {
        return 1;
      }

      return a.task.id.localeCompare(b.task.id);
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
      } catch {
        showError('Error desconocido al vitaminizar.');
      } finally {
        setIsVitaminLoading(false);
      }
    },
    [clientVertical, showError, showSuccess],
  );

  const handleToggleExpand = useCallback((taskKey: string) => {
    setExpandedTask((prev) => (prev === taskKey ? null : taskKey));
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="page-shell flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <div className="surface-subtle mb-6 flex h-24 w-24 items-center justify-center rounded-full">
          <CheckCircle2 size={48} className="icon-tone-muted" />
        </div>
        <h2 className="section-title mb-2">Tu Hoja de Ruta está vacía</h2>
        <p className="section-subtitle mb-6 max-w-md">
          Ve a los módulos y selecciona las tareas clave para construir tu estrategia personalizada.
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell mx-auto max-w-4xl animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="section-title mb-2">Roadmap Cliente</h1>
          <p className="section-subtitle">Organiza y prioriza las acciones estratégicas para este proyecto.</p>
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setLearningMode(!learningMode)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              learningMode ? 'bg-primary-soft text-primary' : 'bg-surface-alt text-muted'
            }`}
          >
            <HelpCircle size={14} /> Modo Aprendizaje: {learningMode ? 'ON' : 'OFF'}
          </button>
          <div className="rounded-brand-md bg-info-soft px-4 py-2 text-sm font-bold text-info">
            {tasks.filter((t) => t.task.status === 'completed').length} / {tasks.length} Completadas
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="roadmap">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {tasks.map((item, index) => {
                const taskKey = buildTaskKey(item.moduleId, item.task.id);
                return (
                  <RoadmapTaskItem
                    key={taskKey}
                    item={item}
                    taskKey={taskKey}
                    index={index}
                    isExpanded={expandedTask === taskKey}
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
                    vitaminResult={expandedTask === taskKey ? vitaminResult : null}
                    isVitaminLoading={isVitaminLoading}
                    vitaminSource={vitaminSource}
                  />
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default ClientRoadmap;
