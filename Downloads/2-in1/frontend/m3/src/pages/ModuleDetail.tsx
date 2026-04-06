import React, { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ModuleData, Task } from '../types';
import { generateSEOAnalysis } from '../services/geminiService';
import { enhanceTaskWithAI } from '../services/aiTaskService';
import { renderMarkdown } from '../utils/markdown';
import { useSettings } from '../context/SettingsContext';
import {
  Wand2,
  PlayCircle,
  FileText,
  Trophy,
  HelpCircle,
  Code,
  Calendar,
  Copy,
  Search,
  DollarSign,
  Activity,
  EyeOff,
  Map,
  Plus,
  X,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import { Skeleton } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';
import ModuleTaskItem from '../components/ModuleTaskItem';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useTranslation } from 'react-i18next';

interface ModuleDetailProps {
  modules: ModuleData[];
  onToggleTask: (moduleId: number, taskId: string) => void;
  onAddTask: (
    moduleId: number,
    title: string,
    description: string,
    impact: 'High' | 'Medium' | 'Low',
    category: string,
  ) => void;
  onDeleteTask: (moduleId: number, taskId: string) => void;
  onUpdateTaskNotes: (moduleId: number, taskId: string, notes: string) => void;
  onUpdateTaskImpact: (moduleId: number, taskId: string, impact: 'High' | 'Medium' | 'Low') => void;
  clientVertical: string;
  clientName?: string;
  onToggleCustomRoadmap: (moduleId: number, taskId: string) => void;
  onToggleTaskCommunicated: (moduleId: number, taskId: string) => void;
}

const ModuleDetail: React.FC<ModuleDetailProps> = ({
  modules,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTaskNotes,
  onUpdateTaskImpact,
  clientVertical,
  clientName = 'Cliente',
  onToggleCustomRoadmap,
  onToggleTaskCommunicated,
}) => {
  const { id } = useParams<{ id: string }>();
  const moduleId = parseInt(id || '1', 10);
  const module = modules.find((m) => m.id === moduleId);
  const { t } = useTranslation();
  const { success: showSuccess, error: showError, successAction } = useToast();
  const { settings } = useSettings();

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // AI Vitamin State
  const [vitaminResult, setVitaminResult] = useState<string | null>(null);
  const [isVitaminLoading, setIsVitaminLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'mistral' | 'gemini' | ''>(
    '',
  );
  const [aiContext, setAiContext] = useState('');

  const availableProviders = useMemo(
    () =>
      [
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
      ].filter((p) => !!p.key),
    [settings],
  );

  React.useEffect(() => {
    if (availableProviders.length > 0) {
      if (!selectedProvider || !availableProviders.find((p) => p.id === selectedProvider)) {
        setSelectedProvider(availableProviders[0].id as any);
      }
    } else {
      setSelectedProvider('');
    }
  }, [availableProviders, selectedProvider]);

  const [activeTab, setActiveTab] = useState<'tasks' | 'tools'>('tasks');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'incomplete'>('all');
  const [learningMode, setLearningMode] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [slackSent, setSlackSent] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // New Task State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskImpact, setNewTaskImpact] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskCategory, setNewTaskCategory] = useState('');

  // ROI Calculator State
  const [roiTraffic, setRoiTraffic] = useState(100000);
  const [roiCpm, setRoiCpm] = useState(5);

  // CWV State
  const [cwvLcp, setCwvLcp] = useState(2.5);
  const [cwvCls, setCwvCls] = useState(0.1);

  const isModuleComplete = module?.tasks.every((t) => t.status === 'completed');

  // Clear vitamin result when expanding a new task
  React.useEffect(() => {
    setVitaminResult(null);
    setAiContext('');
  }, [expandedTask]);

  const handleAiAction = async (
    type: 'headline' | 'audit' | 'schema' | 'calendar' | 'competitor' | 'tone' | 'roadmap',
  ) => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    setAiResult(''); // Clear previous result
    try {
      const result = await generateSEOAnalysis(aiPrompt, type, clientVertical);
      setAiResult(result);
      if (result.startsWith('Error')) {
        showError('Ocurrió un error al generar el análisis.');
      } else {
        showSuccess('Análisis generado correctamente.');
      }
    } catch (e) {
      showError('Error de conexión con IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleVitaminAction = async (task: Task) => {
    if (!selectedProvider) return;
    const providerConfig = availableProviders.find((p) => p.id === selectedProvider);
    if (!providerConfig) return;

    setIsVitaminLoading(true);
    setVitaminResult(null);
    try {
      const result = await enhanceTaskWithAI(
        task,
        clientVertical,
        {
          provider: selectedProvider as any,
          apiKey: providerConfig.key!,
          model: providerConfig.model,
        },
        aiContext,
      );
      setVitaminResult(result);
      if (result.startsWith('Error')) {
        showError(`Error al conectar con ${providerConfig.name}.`);
      } else {
        showSuccess('Tarea vitaminizada con éxito.');
      }
    } catch (e) {
      showError('Error desconocido al vitaminizar.');
    } finally {
      setIsVitaminLoading(false);
    }
  };

  const copyClientNotification = useCallback(
    (task: Task) => {
      const template = `Hola ${clientName}, te comento que hemos avanzado con la tarea: *${task.title}*.\n\n${task.description}\n\nCualquier duda me dices.`;
      navigator.clipboard.writeText(template);
      setSlackSent(true);
      showSuccess('Notificación copiada al portapapeles.');
      setTimeout(() => setSlackSent(false), 3000);
    },
    [clientName, showSuccess],
  );

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) {
      showError('El título de la tarea es obligatorio.');
      return;
    }
    onAddTask(
      moduleId,
      newTaskTitle,
      newTaskDesc,
      newTaskImpact,
      newTaskCategory || 'Personalizado',
    );
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskImpact('Medium');
    setNewTaskCategory('');
    setShowAddTask(false);
    showSuccess('Tarea personalizada añadida.');
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
  };

  const confirmDeleteTask = useCallback(() => {
    if (!taskToDelete) return;
    onDeleteTask(moduleId, taskToDelete);
    successAction(t('feedback.actions.delete_task_card'));
    setTaskToDelete(null);
  }, [moduleId, onDeleteTask, taskToDelete, successAction, t]);

  const handleToggleExpand = useCallback((taskId: string) => {
    setExpandedTask((prev) => (prev === taskId ? null : taskId));
  }, []);

  const filteredTasks = useMemo(
    () =>
      module
        ? module.tasks.filter((t) => {
            if (filter === 'high') return t.impact === 'High';
            if (filter === 'incomplete') return t.status !== 'completed';
            return true;
          })
        : [],
    [module, filter],
  );

  const availableTools = useMemo(
    () => [
      { moduleId: 1, type: 'audit', name: 'Simulador Auditoría Técnica', icon: PlayCircle },
      { moduleId: 2, type: 'calendar', name: 'Calendario Editorial IA', icon: Calendar },
      { moduleId: 2, type: 'competitor', name: 'Análisis de Brechas Competencia', icon: Search },
      { moduleId: 2, type: 'roadmap', name: 'Generador Roadmap Estratégico', icon: Map },
      { moduleId: 3, type: 'headline', name: 'Optimizador de Titulares', icon: FileText },
      { moduleId: 3, type: 'schema', name: 'Generador Schema', icon: Code },
      { moduleId: 3, type: 'tone', name: 'Análisis Tono y Entidades', icon: Activity },
    ],
    [],
  );

  const currentModuleTools = availableTools.filter((t) => t.moduleId === moduleId);

  if (!module) return <div>Módulo no encontrado</div>;

  return (
    <div
      className={`max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 ${zenMode ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900 p-8 overflow-auto max-w-none' : ''}`}
    >
      <ConfirmDialog
        isOpen={!!taskToDelete}
        title={t('feedback.confirm.delete_task_title')}
        message={t('feedback.confirm.delete_task_message')}
        confirmLabel={t('feedback.confirm.confirm_button')}
        cancelLabel={t('feedback.confirm.cancel_button')}
        onConfirm={confirmDeleteTask}
        onCancel={() => setTaskToDelete(null)}
      />
      {/* Header */}
      {!zenMode && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full blur-3xl opacity-50 -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                  Nivel {module.levelRange}
                </span>
                <span className="text-slate-400 font-medium">Módulo {module.id}</span>
              </div>
              <button
                onClick={() => setLearningMode(!learningMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${learningMode ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}
              >
                <HelpCircle size={14} /> Modo Aprendizaje: {learningMode ? 'ON' : 'OFF'}
              </button>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {module.title}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400">{module.subtitle}</p>
            <p className="mt-4 text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {module.description}
            </p>
          </div>
        </div>
      )}

      {/* Completion Celebration */}
      {isModuleComplete && !zenMode && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-900 rounded-2xl p-6 flex items-center gap-6 shadow-sm animate-pulse-slow">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-400 shrink-0">
            <Trophy size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-400">
              ¡Módulo Completado!
            </h3>
            <p className="text-yellow-700 dark:text-yellow-500">
              Has dominado {module.title}. Gran trabajo mejorando tu madurez SEO.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {!zenMode && (
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-4 px-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'tasks'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Lista de Tareas
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`pb-4 px-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'tools'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Wand2 size={16} /> Herramientas IA y Calculadoras
          </button>
        </div>
      )}

      {/* Task List Content */}
      {activeTab === 'tasks' && !zenMode && (
        <div className="space-y-4">
          {/* Filter Bar & Add Button */}
          <div className="flex justify-between items-center pb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filter === 'all' ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter('high')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filter === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
              >
                Alto Impacto
              </button>
              <button
                onClick={() => setFilter('incomplete')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filter === 'incomplete' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
              >
                Por Hacer
              </button>
            </div>
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Crear Ficha
            </button>
          </div>

          {/* Add Task Form */}
          {showAddTask && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-5 border border-blue-200 dark:border-blue-800 mb-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white">
                  Nueva Ficha Personalizada
                </h3>
                <button
                  onClick={() => setShowAddTask(false)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Título de la Acción
                  </label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Ej: Revisar Search Console para nuevas keywords"
                    className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Descripción</label>
                  <textarea
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="Detalles de la tarea..."
                    className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm h-20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Impacto</label>
                    <select
                      value={newTaskImpact}
                      onChange={(e) => setNewTaskImpact(e.target.value as any)}
                      className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm"
                    >
                      <option value="High">Alto</option>
                      <option value="Medium">Medio</option>
                      <option value="Low">Bajo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                    <input
                      type="text"
                      value={newTaskCategory}
                      onChange={(e) => setNewTaskCategory(e.target.value)}
                      placeholder="Ej: Técnica, Contenido..."
                      className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddTask}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700"
                  >
                    Guardar Ficha
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredTasks.map((task) => (
            <ModuleTaskItem
              key={task.id}
              task={task}
              moduleId={moduleId}
              isExpanded={expandedTask === task.id}
              onToggleExpand={handleToggleExpand}
              onToggleTask={onToggleTask}
              onUpdateTaskImpact={onUpdateTaskImpact}
              onUpdateTaskNotes={onUpdateTaskNotes}
              onToggleTaskCommunicated={onToggleTaskCommunicated}
              onToggleCustomRoadmap={onToggleCustomRoadmap}
              onDeleteTask={handleDeleteTask}
              copyClientNotification={copyClientNotification}
              slackSent={slackSent}
              learningMode={learningMode}
              aiContext={expandedTask === task.id ? aiContext : undefined}
              setAiContext={expandedTask === task.id ? setAiContext : undefined}
              vitaminResult={expandedTask === task.id ? vitaminResult : undefined}
              isVitaminLoading={expandedTask === task.id ? isVitaminLoading : undefined}
              selectedProvider={expandedTask === task.id ? selectedProvider : undefined}
              setSelectedProvider={
                expandedTask === task.id ? (val) => setSelectedProvider(val as any) : undefined
              }
              availableProviders={availableProviders}
              onVitaminAction={expandedTask === task.id ? handleVitaminAction : undefined}
            />
          ))}
          {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-slate-400 dark:text-slate-600">
              No hay tareas que coincidan con el filtro.
            </div>
          )}
        </div>
      )}

      {/* AI Tools & Calculators Content */}
      {(activeTab === 'tools' || zenMode) && (
        <div
          className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 ${zenMode ? 'max-w-4xl mx-auto' : ''}`}
        >
          {zenMode && (
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <EyeOff size={24} /> Modo Zen
              </h2>
              <button
                onClick={() => setZenMode(false)}
                className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-lg font-bold"
              >
                Salir Modo Zen
              </button>
            </div>
          )}

          {/* Module 2: ROI Calculator */}
          {moduleId === 2 && !zenMode && (
            <div className="mb-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900">
              <h3 className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-2 mb-3">
                <DollarSign size={20} /> Estimador ROI de Tráfico
              </h3>
              <div className="flex gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                    Visitas Mensuales Objetivo
                  </label>
                  <input
                    type="number"
                    value={roiTraffic}
                    onChange={(e) => setRoiTraffic(Number(e.target.value))}
                    className="p-2 rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 w-32"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                    CPM ($)
                  </label>
                  <input
                    type="number"
                    value={roiCpm}
                    onChange={(e) => setRoiCpm(Number(e.target.value))}
                    className="p-2 rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 w-24"
                  />
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs text-indigo-500">Ingresos Est.</div>
                  <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                    ${((roiTraffic * roiCpm) / 1000).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module 4: CWV Calculator */}
          {moduleId === 4 && !zenMode && (
            <div className="mb-8 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
              <h3 className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 mb-3">
                <Activity size={20} /> Simulador Core Web Vitals
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                    LCP (seg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={cwvLcp}
                    onChange={(e) => setCwvLcp(Number(e.target.value))}
                    className="p-2 rounded border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                    CLS
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cwvCls}
                    onChange={(e) => setCwvCls(Number(e.target.value))}
                    className="p-2 rounded border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 w-full"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${cwvLcp <= 2.5 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      LCP: {cwvLcp <= 2.5 ? 'BUENO' : 'POBRE'}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${cwvCls <= 0.1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      CLS: {cwvCls <= 0.1 ? 'BUENO' : 'POBRE'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {!zenMode &&
              currentModuleTools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => {
                    setAiPrompt('');
                    setAiResult(''); /* Reset specific state logic if needed */
                  }}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all text-left"
                >
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <tool.icon size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {tool.name}
                    </div>
                    <div className="text-xs text-slate-400">Impulsado por IA</div>
                  </div>
                </button>
              ))}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                <Wand2 size={20} className="text-blue-500" />
                {moduleId === 1
                  ? 'Simulador Auditoría Técnica'
                  : moduleId === 2
                    ? 'Estrategia y Calendario'
                    : 'Optimizador de Contenido'}
              </h3>
              {moduleId === 3 && !zenMode && (
                <button
                  onClick={() => setZenMode(true)}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600"
                >
                  <EyeOff size={14} /> Entrar Modo Zen
                </button>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              {moduleId === 1
                ? 'Describe la topología de tu sitio para comprobar bloqueos técnicos.'
                : moduleId === 2
                  ? 'Introduce un tema para generar un calendario de 5 días.'
                  : 'Pega contenido o detalles para generar Schemas, Titulares o comprobar Tono.'}
            </p>

            <textarea
              className="w-full p-4 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[120px] text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 leading-relaxed"
              placeholder={
                moduleId === 2 ? "Tema: 'Final Eurocopa 2024'" : 'Introduce contenido aquí...'
              }
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />

            <div className="flex justify-end mt-4 gap-2 flex-wrap">
              {moduleId === 3 && (
                <>
                  <button
                    onClick={() => handleAiAction('tone')}
                    disabled={isAiLoading || !aiPrompt}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-purple-600 dark:text-purple-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Activity size={16} /> Comprobar Tono y Entidades
                  </button>
                  <button
                    onClick={() => handleAiAction('schema')}
                    disabled={isAiLoading || !aiPrompt}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Generar JSON-LD
                  </button>
                </>
              )}
              {moduleId === 2 && (
                <button
                  onClick={() => handleAiAction('roadmap')}
                  disabled={isAiLoading || !aiPrompt}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-emerald-600 dark:text-emerald-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Map size={16} /> Crear Roadmap ({clientVertical})
                </button>
              )}
              <button
                onClick={() =>
                  handleAiAction(
                    moduleId === 1 ? 'audit' : moduleId === 2 ? 'calendar' : 'headline',
                  )
                }
                disabled={isAiLoading || !aiPrompt}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/20"
              >
                {isAiLoading ? <Spinner size={18} className="text-white" /> : <Wand2 size={18} />}
                Ejecutar Análisis
              </button>
            </div>
          </div>

          {/* AI Result Display */}
          {/* Skeleton loading for AI result */}
          {isAiLoading && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
              <Skeleton width="30%" height="24px" className="mb-4" />
              <div className="space-y-2">
                <Skeleton width="100%" height="16px" />
                <Skeleton width="100%" height="16px" />
                <Skeleton width="90%" height="16px" />
                <Skeleton width="80%" height="16px" />
              </div>
            </div>
          )}

          {aiResult && !isAiLoading && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2 justify-between">
                <span className="flex items-center gap-2">
                  <Wand2 size={16} className="text-purple-500" /> Resultado
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(aiResult);
                    showSuccess('Copiado al portapapeles');
                  }}
                  className="text-xs flex items-center gap-1 text-slate-400 hover:text-blue-500"
                >
                  <Copy size={12} /> Copiar
                </button>
              </h4>
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-slate-700 font-mono">
                {aiResult}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModuleDetail;
