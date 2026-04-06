import React, { useState, memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Task } from '../types';
import {
  Check,
  CheckCircle2,
  GripVertical,
  Trash2,
  ChevronDown,
  Sparkles,
  Zap,
  Copy,
  HelpCircle,
  Bot,
  Circle,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/ui/ToastContext';
import { Spinner } from '../components/ui/Spinner';

interface RoadmapTaskItemProps {
  item: { task: Task; moduleId: number };
  index: number;
  isExpanded: boolean;
  onToggleExpand: (taskId: string) => void;
  onToggleTask: (moduleId: number, taskId: string) => void;
  onRemoveFromRoadmap: (moduleId: number, taskId: string) => void;
  onUpdateTaskNotes: (moduleId: number, taskId: string, notes: string) => void;
  onUpdateTaskImpact: (moduleId: number, taskId: string, impact: 'High' | 'Medium' | 'Low') => void;
  onToggleTaskCommunicated: (moduleId: number, taskId: string) => void;
  onVitaminAction: (task: Task, provider: 'mistral' | 'openai') => void;
  clientName: string;
  learningMode: boolean;
  mistralAvailable: boolean;
  openaiAvailable: boolean;
  vitaminResult: string | null;
  isVitaminLoading: boolean;
  vitaminSource: 'mistral' | 'openai' | null;
}

const RoadmapTaskItem: React.FC<RoadmapTaskItemProps> = memo(
  ({
    item,
    index,
    isExpanded,
    onToggleExpand,
    onToggleTask,
    onRemoveFromRoadmap,
    onUpdateTaskNotes,
    onUpdateTaskImpact,
    onToggleTaskCommunicated,
    onVitaminAction,
    clientName,
    learningMode,
    mistralAvailable,
    openaiAvailable,
    vitaminResult,
    isVitaminLoading,
    vitaminSource,
  }) => {
    const { success: showSuccess } = useToast();
    const [slackSent, setSlackSent] = useState(false);

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

    const copyClientNotification = (task: Task) => {
      const template = `Hola ${clientName}, te comento que hemos avanzado con la tarea: *${task.title}*.\n\n${task.description}\n\nCualquier duda me dices.`;
      navigator.clipboard.writeText(template);
      setSlackSent(true);
      showSuccess('Notificación copiada al portapapeles.');
      setTimeout(() => setSlackSent(false), 3000);
    };

    return (
      <Draggable draggableId={item.task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`group bg-white dark:bg-slate-800 border rounded-xl transition-all ${
              snapshot.isDragging
                ? 'shadow-xl ring-2 ring-blue-500 rotate-1 z-50'
                : 'hover:border-blue-300 dark:hover:border-blue-600 shadow-sm'
            } ${
              item.task.status === 'completed'
                ? 'border-emerald-100 bg-emerald-50/10 dark:border-emerald-900 dark:bg-emerald-900/10'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div
              className="p-4 flex items-start gap-4 cursor-pointer"
              onClick={() => onToggleExpand(item.task.id)}
            >
              <div
                {...provided.dragHandleProps}
                className="mt-1 cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical size={20} />
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTask(item.moduleId, item.task.id);
                }}
                className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                  item.task.status === 'completed'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getImpactColor(item.task.impact)}`}
                  >
                    {item.task.impact} Impacto
                  </span>
                  <Link
                    to={`/app/module/${item.moduleId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 uppercase tracking-wider bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                    title={`Ir al Módulo ${item.moduleId}`}
                  >
                    Módulo {item.moduleId}
                    <ExternalLink size={10} />
                  </Link>
                  {item.task.category && (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-800">
                      {item.task.category}
                    </span>
                  )}
                  {item.task.isCustom && (
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full border border-purple-100 dark:border-purple-800">
                      Personalizada
                    </span>
                  )}
                </div>
                <h3
                  className={`font-semibold text-lg leading-tight mb-1 ${item.task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}
                >
                  {item.task.title}
                </h3>
                {/* Preview description when collapsed */}
                {!isExpanded && (
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-1">
                    {item.task.description}
                  </p>
                )}
              </div>

              <div className="mt-1 text-slate-400">
                <ChevronDown
                  size={20}
                  className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div
                className="px-5 pb-5 pt-0 pl-[4.5rem] cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                  {item.task.description}
                </p>

                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Impacto de la Tarea
                    </label>
                    <select
                      value={item.task.impact}
                      onChange={(e) =>
                        onUpdateTaskImpact(
                          item.moduleId,
                          item.task.id,
                          e.target.value as 'High' | 'Medium' | 'Low',
                        )
                      }
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium"
                    >
                      <option value="High">🔥 Alto Impacto</option>
                      <option value="Medium">⚡ Impacto Medio</option>
                      <option value="Low">☕ Bajo Impacto</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Mis Notas</label>
                  <textarea
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 min-h-[80px]"
                    placeholder="Escribe tus notas aquí..."
                    defaultValue={item.task.userNotes || ''}
                    onBlur={(e) => onUpdateTaskNotes(item.moduleId, item.task.id, e.target.value)}
                  />
                </div>

                {learningMode && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-300 mb-4 flex gap-3">
                    <HelpCircle size={16} className="text-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-purple-700 dark:text-purple-400 block mb-1">
                        Por qué esto importa:
                      </span>
                      Dominar esta tarea es crucial para el éxito de tu estrategia SEO en el módulo{' '}
                      {item.moduleId}.
                    </div>
                  </div>
                )}

                {/* Vitamin Result */}
                {vitaminResult && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-amber-800 dark:text-amber-400 font-bold text-sm mb-2 flex items-center gap-2">
                      {vitaminSource === 'mistral' ? (
                        <Zap size={16} className="fill-amber-500 text-amber-500" />
                      ) : (
                        <Bot size={16} className="text-emerald-500" />
                      )}
                      {vitaminSource === 'mistral' ? 'Mistral Insights' : 'ChatGPT Insights'}
                    </h4>
                    <div className="text-slate-700 dark:text-slate-300 text-sm prose prose-sm max-w-none dark:prose-invert">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: vitaminResult
                            .replace(/\n/g, '<br/>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 flex-wrap items-center">
                  {/* Vitamin Actions Group */}
                  <div className="flex bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800 p-1 gap-1">
                    <button
                      onClick={() => onVitaminAction(item.task, 'mistral')}
                      disabled={isVitaminLoading || !mistralAvailable}
                      title={
                        mistralAvailable
                          ? 'Vitaminizar con Mistral AI'
                          : 'Requiere API Key de Mistral'
                      }
                      className="flex items-center gap-1 px-3 py-1 rounded hover:bg-white dark:hover:bg-slate-800 text-amber-700 dark:text-amber-400 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVitaminLoading && vitaminSource === 'mistral' ? (
                        <Spinner size={14} className="text-amber-600" />
                      ) : (
                        <Zap size={14} />
                      )}
                      Mistral
                    </button>
                    <div className="w-px bg-amber-200 dark:bg-amber-800 mx-1"></div>
                    <button
                      onClick={() => onVitaminAction(item.task, 'openai')}
                      disabled={isVitaminLoading || !openaiAvailable}
                      title={
                        openaiAvailable ? 'Vitaminizar con ChatGPT' : 'Requiere API Key de OpenAI'
                      }
                      className="flex items-center gap-1 px-3 py-1 rounded hover:bg-white dark:hover:bg-slate-800 text-amber-700 dark:text-amber-400 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVitaminLoading && vitaminSource === 'openai' ? (
                        <Spinner size={14} className="text-amber-600" />
                      ) : (
                        <Bot size={14} />
                      )}
                      ChatGPT
                    </button>
                  </div>

                  <button
                    onClick={() => copyClientNotification(item.task)}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 transition-colors text-sm font-medium"
                  >
                    {slackSent ? (
                      <>
                        <Check size={16} /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Notificar Cliente
                      </>
                    )}
                  </button>

                  {item.task.status === 'completed' && (
                    <button
                      onClick={() => onToggleTaskCommunicated(item.moduleId, item.task.id)}
                      className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm font-medium ${
                        item.task.communicated
                          ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400'
                          : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                      title={
                        item.task.communicated
                          ? 'Marcar como No Comunicado'
                          : 'Marcar como Comunicado'
                      }
                    >
                      {item.task.communicated ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      {item.task.communicated ? 'Comunicado' : 'No comunicado'}
                    </button>
                  )}

                  <button
                    onClick={() => onRemoveFromRoadmap(item.moduleId, item.task.id)}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors text-sm font-medium ml-auto"
                    title="Quitar del Roadmap"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Quitar del Roadmap</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Draggable>
    );
  },
);

export default RoadmapTaskItem;


RoadmapTaskItem.displayName = 'RoadmapTaskItem';
