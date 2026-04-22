import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import { X, Save, FileText, CheckCircle2, Circle, Calendar, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  moduleId: number | null;
  onUpdateTaskDetails: (moduleId: number, taskId: string, updates: Partial<Task>) => void;
  onToggleTask: (moduleId: number, taskId: string) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  task,
  moduleId,
  onUpdateTaskDetails,
  onToggleTask,
}) => {
  const taskDraft = useMemo(() => ({
    notes: task?.userNotes || '',
    impact: task?.impact || 'Medium',
    title: task?.title || '',
    description: task?.description || '',
    dueDate: task?.dueDate || '',
    impactProperty: task?.impactLink?.property || '',
    impactQuery: task?.impactLink?.query || '',
    impactUrl: task?.impactLink?.url || '',
    impactWindow: task?.impactPostWindowDays || 28,
  }), [task]);

  const [notes, setNotes] = useState(taskDraft.notes);
  const [impact, setImpact] = useState<'High' | 'Medium' | 'Low'>(taskDraft.impact);
  const [title, setTitle] = useState(taskDraft.title);
  const [description, setDescription] = useState(taskDraft.description);
  const [dueDate, setDueDate] = useState(taskDraft.dueDate);
  const [impactProperty, setImpactProperty] = useState(taskDraft.impactProperty);
  const [impactQuery, setImpactQuery] = useState(taskDraft.impactQuery);
  const [impactUrl, setImpactUrl] = useState(taskDraft.impactUrl);
  const [impactWindow, setImpactWindow] = useState(taskDraft.impactWindow);

  if (!isOpen || !task || moduleId === null) return null;

  const handleSave = () => {
    onUpdateTaskDetails(moduleId, task.id, {
      userNotes: notes,
      impact: impact,
      title: title,
      description: description,
      dueDate: dueDate,
      impactLink: {
        property: impactProperty.trim(),
        query: impactQuery.trim(),
        url: impactUrl.trim(),
        module: `Módulo ${moduleId}`,
      },
      impactPostWindowDays: Math.max(7, Math.min(90, impactWindow || 28)),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText size={20} className="text-blue-500" />
              Detalles de la Tarea
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Módulo {moduleId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
          {task.insightSourceMeta && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">
              <div className="font-semibold">Creado desde insight {task.insightSourceMeta.insightId}</div>
              <div className="mt-1">Fuente: {task.insightSourceMeta.sourceLabel}</div>
              <div>Query: {task.insightSourceMeta.query || 'N/A'} · URL: {task.insightSourceMeta.url || 'N/A'}</div>
              <Link
                to={`/app/dashboard?insightId=${encodeURIComponent(task.insightSourceMeta.insightId)}`}
                className="mt-2 inline-flex items-center gap-1 underline"
              >
                Abrir insight original
                <ExternalLink size={12} />
              </Link>
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Impacto
              </label>
              <select
                value={impact}
                onChange={(e) => setImpact(e.target.value as 'High' | 'Medium' | 'Low')}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="High">🔥 Alto Impacto</option>
                <option value="Medium">⚡ Impacto Medio</option>
                <option value="Low">☕ Bajo Impacto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                <Calendar size={16} />
                Fecha o Mes
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Estado
              </label>
              <button
                onClick={() => onToggleTask(moduleId, task.id)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors font-medium border ${
                  task.status === 'completed'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                    : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200'
                }`}
              >
                {task.status === 'completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                {task.status === 'completed' ? 'Completada' : 'Pendiente'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Mis Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Añade notas, enlaces o contexto adicional aquí..."
              className="w-full h-32 p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/30">
            <h3 className="text-sm font-bold text-cyan-900 dark:text-cyan-200 mb-3">Antes vs Después (GSC)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">
                  Propiedad GSC
                </label>
                <input
                  type="text"
                  value={impactProperty}
                  onChange={(e) => setImpactProperty(e.target.value)}
                  placeholder="sc-domain:midominio.com"
                  className="w-full p-2 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">
                  Ventana post-acción (días)
                </label>
                <input
                  type="number"
                  min={7}
                  max={90}
                  value={impactWindow}
                  onChange={(e) => setImpactWindow(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">
                  Query objetivo
                </label>
                <input
                  type="text"
                  value={impactQuery}
                  onChange={(e) => setImpactQuery(e.target.value)}
                  placeholder="ej: abogado penal madrid"
                  className="w-full p-2 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">
                  URL objetivo
                </label>
                <input
                  type="text"
                  value={impactUrl}
                  onChange={(e) => setImpactUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <Save size={18} />
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
