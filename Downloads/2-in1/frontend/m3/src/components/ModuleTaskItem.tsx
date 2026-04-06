import React, { memo } from 'react';
import { Task } from '../types';
import { renderMarkdown } from '../utils/markdown';
import {
  Check,
  ChevronDown,
  HelpCircle,
  Zap,
  Sparkles,
  Settings,
  CheckCircle2,
  Circle,
  Map,
  Trash2,
  Copy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from './ui/Spinner';

interface ModuleTaskItemProps {
  task: Task;
  moduleId: number;
  isExpanded: boolean;
  onToggleExpand: (taskId: string) => void;
  onToggleTask: (moduleId: number, taskId: string) => void;
  onUpdateTaskImpact: (moduleId: number, taskId: string, impact: 'High' | 'Medium' | 'Low') => void;
  onUpdateTaskNotes: (moduleId: number, taskId: string, notes: string) => void;
  onToggleTaskCommunicated: (moduleId: number, taskId: string) => void;
  onToggleCustomRoadmap: (moduleId: number, taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  copyClientNotification: (task: Task) => void;
  slackSent: boolean;
  learningMode: boolean;

  // AI related props
  aiContext?: string;
  setAiContext?: (context: string) => void;
  vitaminResult?: string | null;
  isVitaminLoading?: boolean;
  selectedProvider?: string;
  setSelectedProvider?: (provider: string) => void;
  availableProviders?: { id: string; name: string }[];
  onVitaminAction?: (task: Task) => void;
}

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

const ModuleTaskItem: React.FC<ModuleTaskItemProps> = memo(
  ({
    task,
    moduleId,
    isExpanded,
    onToggleExpand,
    onToggleTask,
    onUpdateTaskImpact,
    onUpdateTaskNotes,
    onToggleTaskCommunicated,
    onToggleCustomRoadmap,
    onDeleteTask,
    copyClientNotification,
    slackSent,
    learningMode,
    aiContext,
    setAiContext,
    vitaminResult,
    isVitaminLoading,
    selectedProvider,
    setSelectedProvider,
    availableProviders,
    onVitaminAction,
  }) => {
    return (
      <div
        className={`bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200 ${
          task.status === 'completed'
            ? 'border-emerald-100 bg-emerald-50/10 dark:border-emerald-900 dark:bg-emerald-900/10'
            : 'border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-500 shadow-sm hover:shadow-md'
        }`}
      >
        <div
          className="p-5 flex items-start gap-4 cursor-pointer"
          onClick={() => onToggleExpand(task.id)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleTask(moduleId, task.id);
            }}
            className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
              task.status === 'completed'
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-blue-400'
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </button>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h3
                className={`font-semibold text-lg ${task.status === 'completed' ? 'text-slate-500 line-through decoration-slate-300 dark:decoration-slate-600' : 'text-slate-800 dark:text-slate-200'}`}
              >
                {task.title}
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getImpactColor(task.impact)}`}
              >
                {task.impact} Impacto
              </span>
              {task.category && (
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-full">
                  {task.category}
                </span>
              )}
              {task.isCustom && (
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full border border-purple-100 dark:border-purple-800">
                  Personalizada
                </span>
              )}
            </div>
            {/* Preview description when collapsed */}
            {!isExpanded && (
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-1">
                {task.description}
              </p>
            )}
          </div>
          <div className="mt-2 text-slate-400">
            <ChevronDown
              size={20}
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-5 pb-5 pt-0 pl-[3.25rem]">
            <div
              className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(task.description) }}
            />

            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Impacto de la Tarea
                </label>
                <select
                  value={task.impact}
                  onChange={(e) =>
                    onUpdateTaskImpact(
                      moduleId,
                      task.id,
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
                defaultValue={task.userNotes || ''}
                onBlur={(e) => onUpdateTaskNotes(moduleId, task.id, e.target.value)}
              />
            </div>

            {learningMode && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-300 mb-4 flex gap-3">
                <HelpCircle size={16} className="text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-purple-700 dark:text-purple-400 block mb-1">
                    Por qué esto importa:
                  </span>
                  Dominar los fundamentos de {task.category?.toLowerCase()} es crucial para pasar
                  los filtros de calidad de Google. Sin esto, tu contenido podría no indexarse
                  correctamente.
                </div>
              </div>
            )}

            {/* AI Context Input */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Instrucciones para IA (Opcional)
              </label>
              <textarea
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 min-h-[60px]"
                placeholder="Ej: Enfócate en la parte técnica..."
                value={aiContext || ''}
                onChange={(e) => setAiContext && setAiContext(e.target.value)}
              />
            </div>

            {/* AI Vitamin Result */}
            {vitaminResult && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                <h4 className="text-amber-800 dark:text-amber-400 font-bold text-sm mb-2 flex items-center gap-2">
                  <Zap size={16} className="fill-amber-500 text-amber-500" />
                  AI Insights
                </h4>
                <div className="text-slate-700 dark:text-slate-300 text-sm prose prose-sm max-w-none dark:prose-invert">
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(vitaminResult) }} />
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap items-center">
              <button
                onClick={() => onToggleTask(moduleId, task.id)}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                  task.status === 'completed'
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                }`}
              >
                {task.status === 'completed' ? 'Marcar como Incompleta' : 'Marcar como Completa'}
              </button>

              <div className="flex items-center gap-2 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-1">
                {availableProviders && availableProviders.length > 0 ? (
                  <>
                    <button
                      onClick={() => onVitaminAction && onVitaminAction(task)}
                      disabled={isVitaminLoading || !selectedProvider}
                      title={selectedProvider ? 'Mejorar con IA' : 'Selecciona un proveedor'}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVitaminLoading ? (
                        <Spinner size={16} className="text-amber-600" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      {vitaminResult ? 'Re-Vitaminizar' : 'Vitaminizar'}
                    </button>
                    <div className="h-4 w-px bg-amber-200 dark:bg-amber-800 mx-1"></div>
                    <select
                      value={selectedProvider || ''}
                      onChange={(e) =>
                        setSelectedProvider && setSelectedProvider(e.target.value as any)
                      }
                      className="bg-transparent text-xs font-medium text-amber-800 dark:text-amber-300 outline-none cursor-pointer max-w-[100px]"
                    >
                      {availableProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-3 py-1.5 text-amber-700 dark:text-amber-400 hover:underline text-sm font-medium"
                  >
                    <Settings size={14} /> Configurar IA
                  </Link>
                )}
              </div>

              <button
                onClick={() => copyClientNotification(task)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 transition-colors text-sm font-medium ml-auto"
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

              {task.status === 'completed' && (
                <button
                  onClick={() => onToggleTaskCommunicated(moduleId, task.id)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm font-medium ${
                    task.communicated
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400'
                      : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                  title={task.communicated ? 'Marcar como No Comunicado' : 'Marcar como Comunicado'}
                >
                  {task.communicated ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  {task.communicated ? 'Comunicado' : 'No comunicado'}
                </button>
              )}

              <button
                onClick={() => onToggleCustomRoadmap(moduleId, task.id)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm font-medium ${
                  task.isInCustomRoadmap
                    ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-purple-600 hover:border-purple-300'
                }`}
                title={
                  task.isInCustomRoadmap
                    ? 'Quitar del Roadmap Cliente'
                    : 'Añadir al Roadmap Cliente'
                }
              >
                {task.isInCustomRoadmap ? (
                  <CheckCircle2 size={16} className="text-purple-500" />
                ) : (
                  <Map size={16} />
                )}
                {task.isInCustomRoadmap ? 'En Roadmap' : 'Añadir a Roadmap'}
              </button>

              {task.isCustom && (
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium ml-auto md:ml-0"
                  title="Eliminar ficha personalizada"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default ModuleTaskItem;


ModuleTaskItem.displayName = 'ModuleTaskItem';
