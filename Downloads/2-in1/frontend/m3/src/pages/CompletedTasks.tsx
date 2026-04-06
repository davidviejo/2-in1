import React, { useState } from 'react';
import { CompletedTask } from '../types';
import { CheckCircle2, Calendar, Plus, ClipboardList, PenTool, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/ToastContext';
import { useTranslation } from 'react-i18next';

interface CompletedTasksProps {
  completedTasks: CompletedTask[];
  onAddManualTask: (title: string, description: string) => void;
  onDeleteLogEntry: (id: string) => void;
}

const CompletedTasks: React.FC<CompletedTasksProps> = ({
  completedTasks,
  onAddManualTask,
  onDeleteLogEntry,
}) => {
  const { t } = useTranslation();
  const { successAction } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onAddManualTask(newTitle, newDesc);
      setNewTitle('');
      setNewDesc('');
      setShowForm(false);
    }
  };

  const handleDelete = (id: string) => {
    setTaskToDelete(id);
  };

  const confirmDelete = () => {
    if (!taskToDelete) return;
    onDeleteLogEntry(taskToDelete);
    successAction(t('feedback.actions.delete_history_entry'));
    setTaskToDelete(null);
  };

  const sortedTasks = [...completedTasks].sort((a, b) => b.completedAt - a.completedAt);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={!!taskToDelete}
        title={t('feedback.confirm.delete_history_title')}
        message={t('feedback.confirm.delete_history_message')}
        confirmLabel={t('feedback.confirm.confirm_button')}
        cancelLabel={t('feedback.confirm.cancel_button')}
        onConfirm={confirmDelete}
        onCancel={() => setTaskToDelete(null)}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <ClipboardList size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tareas Realizadas</h1>
            <p className="text-slate-500 dark:text-slate-400">Registro histórico de progreso</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
        >
          <Plus size={20} />
          Registrar Tarea Manual
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-4"
        >
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <PenTool size={20} className="text-blue-500" />
            Nueva Tarea Manual
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Título
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Ej: Optimización de imágenes en Home"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Descripción (Opcional)
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24"
                placeholder="Detalles adicionales..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Guardar Registro
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {sortedTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center">
              <ClipboardList size={32} />
            </div>
            <p>No hay tareas registradas aún. ¡Completa módulos o agrega registros manuales!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {sortedTasks.map((task) => (
              <div
                key={task.id}
                className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex gap-4"
              >
                <div
                  className={`mt-1 flex-shrink-0 ${task.source === 'manual' ? 'text-blue-500' : 'text-emerald-500'}`}
                >
                  <CheckCircle2 size={24} className="fill-current text-white dark:text-slate-900" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium text-slate-900 dark:text-white text-lg">
                      {task.title}
                    </h3>
                    <span className="text-xs font-mono text-slate-400 whitespace-nowrap flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(task.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
                      {task.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${
                        task.source === 'manual'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}
                    >
                      {task.source === 'manual' ? 'Registro Manual' : `Módulo ${task.moduleId}`}
                    </span>
                  </div>
                </div>
                <div className="self-center">
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                    title="Eliminar registro"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompletedTasks;
