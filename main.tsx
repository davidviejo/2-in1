import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { Task, Subtask } from '../types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface TaskDetailsModalProps {
  task: Task;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export function TaskDetailsModal({ task, onClose, onSave, onDelete }: TaskDetailsModalProps) {
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [newSubtask, setNewSubtask] = useState('');

  // Update local state if task prop changes
  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  const handleSave = () => {
    onSave(editedTask);
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const subtask: Subtask = { id: uuidv4(), title: newSubtask, done: false };
    setEditedTask(prev => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), subtask]
    }));
    setNewSubtask('');
  };

  const toggleSubtask = (subId: string) => {
    setEditedTask(prev => ({
      ...prev,
      subtasks: prev.subtasks?.map(s => s.id === subId ? { ...s, done: !s.done } : s)
    }));
  };

  const removeSubtask = (subId: string) => {
    setEditedTask(prev => ({
      ...prev,
      subtasks: prev.subtasks?.filter(s => s.id !== subId)
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/20 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto transform transition-transform animate-in slide-in-from-right"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900">Detalles de Tarea</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Título</label>
            <input 
              type="text" 
              value={editedTask.title}
              onChange={e => setEditedTask({...editedTask, title: e.target.value})}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Proyecto</label>
                <input 
                  type="text" 
                  value={editedTask.project || ''}
                  onChange={e => setEditedTask({...editedTask, project: e.target.value})}
                  placeholder="Ej: Marketing"
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
             </div>
             <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Responsable</label>
                <input 
                  type="text" 
                  value={editedTask.assignee || ''}
                  onChange={e => setEditedTask({...editedTask, assignee: e.target.value})}
                  placeholder="Ej: Alex"
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
             </div>
             <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Progreso ({editedTask.progress || 0}%)</label>
                <input 
                  type="range" 
                  min="0" max="100"
                  value={editedTask.progress || 0}
                  onChange={e => setEditedTask({...editedTask, progress: parseInt(e.target.value)})}
                  className="w-full accent-blue-600"
                />
             </div>
          </div>

          {/* Dates & Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Inicio</label>
              <input 
                type="date" 
                value={format(editedTask.startDate, 'yyyy-MM-dd')}
                onChange={e => {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setEditedTask({...editedTask, startDate: new Date(y, m - 1, d)});
                }}
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Fin</label>
              <input 
                type="date" 
                value={format(editedTask.endDate, 'yyyy-MM-dd')}
                onChange={e => {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setEditedTask({...editedTask, endDate: new Date(y, m - 1, d)});
                }}
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Color de la barra</label>
              <div className="flex gap-2">
                {['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#64748b'].map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 ${editedTask.color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-110'} transition-all`}
                    style={{ backgroundColor: c }}
                    onClick={() => setEditedTask({...editedTask, color: c})}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Campos Personalizados</label>
              <button 
                onClick={() => {
                  const key = prompt('Nombre del nuevo campo (ej. Presupuesto, Prioridad):');
                  if (key) {
                    setEditedTask(prev => ({
                      ...prev,
                      customFields: { ...prev.customFields, [key]: '' }
                    }));
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Añadir
              </button>
            </div>
            {Object.entries(editedTask.customFields || {}).map(([key, value]) => (
              <div key={key} className="flex grid grid-cols-3 gap-2 mb-2 items-center">
                <span className="text-sm font-medium text-gray-700 truncate" title={key}>{key}</span>
                <input 
                  type="text" 
                  value={value}
                  onChange={e => setEditedTask(prev => ({
                    ...prev,
                    customFields: { ...prev.customFields, [key]: e.target.value }
                  }))}
                  className="col-span-2 w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Valor..."
                />
              </div>
            ))}
            {(!editedTask.customFields || Object.keys(editedTask.customFields).length === 0) && (
              <p className="text-xs text-gray-400 italic">No hay campos personalizados.</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Notas</label>
            <textarea 
              value={editedTask.notes || ''}
              onChange={e => setEditedTask({...editedTask, notes: e.target.value})}
              placeholder="Detalles sobre esta tarea..."
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y h-24"
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Subtareas</label>
            <div className="space-y-2 mb-3">
              {editedTask.subtasks?.map(sub => (
                <div key={sub.id} className="flex items-center justify-between group bg-gray-50 px-3 py-2 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={sub.done}
                      onChange={() => toggleSubtask(sub.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className={`text-sm ${sub.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {sub.title}
                    </span>
                  </label>
                  <button 
                    onClick={() => removeSubtask(sub.id)}
                    className="p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
                placeholder="Añadir subtarea..."
                className="flex-1 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button 
                onClick={addSubtask}
                disabled={!newSubtask.trim()}
                className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 flex items-center justify-between z-10">
          <button
            onClick={() => onDelete(task.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
          <div className="flex gap-3">
             <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" /> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
