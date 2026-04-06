import React, { useState, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useToast } from './ui/ToastContext';

interface BulkActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_TYPES = [
  'Clúster',
  'Geolocalización',
  'Datos Estructurados',
  'Contenidos',
  'Snippets',
  'Imagenes',
  'Enlazado Interno',
  'Estructura',
  'UX',
  'WPO',
  'Enlace',
  'Oportunidades VS kw Objetivo',
  'Semántica',
  'GEO Imagenes',
  'LLamada a la accion / Estética / CRO',
];

const BulkActionsModal: React.FC<BulkActionsModalProps> = ({ isOpen, onClose }) => {
  const { modules, addTasksBulk } = useProject();
  const { success: showSuccess, error: showError } = useToast();

  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [urls, setUrls] = useState('');

  // Find the first module with isCustom: true, or default to the last one if none found
  const defaultModuleId = useMemo(
    () => modules.find((m) => m.isCustom)?.id || modules[modules.length - 1]?.id || 0,
    [modules],
  );

  const [targetModuleId, setTargetModuleId] = useState<number>(defaultModuleId);

  const effectiveTargetModuleId = isOpen ? defaultModuleId : targetModuleId;

  const urlList = useMemo(
    () =>
      urls
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u.length > 0),
    [urls],
  );

  if (!isOpen) return null;

  const handleToggleAction = (action: string) => {
    const newSet = new Set(selectedActions);
    if (newSet.has(action)) {
      newSet.delete(action);
    } else {
      newSet.add(action);
    }
    setSelectedActions(newSet);
  };

  const handleSelectAll = () => {
    if (selectedActions.size === ACTION_TYPES.length) {
      setSelectedActions(new Set());
    } else {
      setSelectedActions(new Set(ACTION_TYPES));
    }
  };

  const handleCreate = () => {
    if (urlList.length === 0) {
      showError('Por favor, introduce al menos una URL.');
      return;
    }

    if (selectedActions.size === 0) {
      showError('Por favor, selecciona al menos una acción.');
      return;
    }

    const tasksToCreate: any[] = [];

    urlList.forEach((url) => {
      selectedActions.forEach((action) => {
        tasksToCreate.push({
          moduleId: effectiveTargetModuleId,
          title: `${action} - ${url}`,
          description: `Acción masiva: ${action} para la URL ${url}`,
          impact: 'Medium',
          category: 'Bulk Action',
          status: 'pending',
          isInRoadmap: true,
        });
      });
    });

    addTasksBulk(tasksToCreate);
    showSuccess(`${tasksToCreate.length} tareas creadas correctamente.`);

    // Reset and close
    setUrls('');
    setSelectedActions(new Set());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Acciones Masivas</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Crea múltiples tareas para varias URLs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Module Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Módulo Destino
            </label>
            <select
              value={effectiveTargetModuleId}
              onChange={(e) => setTargetModuleId(Number(e.target.value))}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}. {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* URLs Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              URLs (una por línea)
            </label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://ejemplo.com/pagina1&#10;https://ejemplo.com/pagina2"
              className="w-full h-32 p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Se crearán tareas para cada combinación de URL y Acción seleccionada.
            </p>
          </div>

          {/* Actions Selection */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Seleccionar Acciones
              </label>
              <button
                onClick={handleSelectAll}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {selectedActions.size === ACTION_TYPES.length
                  ? 'Deseleccionar todo'
                  : 'Seleccionar todo'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ACTION_TYPES.map((action) => (
                <button
                  key={action}
                  onClick={() => handleToggleAction(action)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all ${
                    selectedActions.has(action)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      selectedActions.has(action)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-slate-400 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {selectedActions.has(action) && <Check size={10} className="text-white" />}
                  </div>
                  <span className="truncate">{action}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={urlList.length === 0 || selectedActions.size === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check size={18} />
            Crear{' '}
            {urlList.length * selectedActions.size > 0
              ? urlList.length * selectedActions.size
              : ''}{' '}
            Tareas
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsModal;
