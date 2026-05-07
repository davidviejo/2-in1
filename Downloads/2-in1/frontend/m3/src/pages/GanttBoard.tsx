import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, Download, Pencil, Trash2 } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { Task } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastContext';
import { analyzeGantt, GanttAnalyzeResponse } from '@/services/ganttService';
import { Spinner } from '@/components/ui/Spinner';

type ViewMode = 'day' | 'week' | 'month' | 'year';
type TimeFilter = 'all' | 'week' | 'month' | 'year';

const mapKanbanStatusToGanttProgress = (status: string, fallbackProgress?: number): number => {
  if (typeof fallbackProgress === 'number') return Math.max(0, Math.min(100, Math.round(fallbackProgress)));
  if (status === 'completed') return 100;
  if (['in-progress', 'working-now', 'internal-review', 'client-review', 'client-feedback'].includes(status)) return 60;
  if (status === 'commitment') return 25;
  return 0;
};

const mapGanttProgressToKanbanStatus = (progress: number, currentStatus: string): string => {
  if (progress >= 100) return 'completed';
  if (progress <= 0) return 'pending';
  if (currentStatus === 'completed' || currentStatus === 'pending') return 'in-progress';
  return currentStatus;
};

const toDateInput = (date?: string) => (date ? new Date(date).toISOString().slice(0, 10) : '');

const GanttBoard: React.FC = () => {
  const { t } = useTranslation();
  const { clients, currentClientId, updateTaskTimeline, updateTaskStatus, toggleCustomRoadmapTask, switchClient, addTasksBulk } = useProject();
  const { success, info, error } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [editingTask, setEditingTask] = useState<{ clientId: string; clientName: string; moduleId: number; task: Task } | null>(null);
  const [confirmState, setConfirmState] = useState<{ clientId: string; clientName: string; moduleId: number; task: Task } | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [createMode, setCreateMode] = useState<'manual' | 'ai'>('manual');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', startDate: '', endDate: '', assignee: '', project: '', moduleId: 1, clientId: currentClientId });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<GanttAnalyzeResponse | null>(null);

  const handleAnalyzeGantt = async () => {
    try {
      setIsAnalyzing(true);
      const response = await analyzeGantt(
        filteredTasks.map(({ task }) => ({
          title: task.title,
          status: task.status,
          progress: mapKanbanStatusToGanttProgress(task.status, task.progress),
          startDate: task.startDate,
          endDate: task.endDate,
          assignee: task.assignee,
          project: task.project,
        })),
      );
      setAnalysisResult(response);
      success('Análisis Gantt completado.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo analizar el Gantt.';
      error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };


  const ganttTasks = useMemo(
    () =>
      clients.flatMap((client) =>
        client.modules.flatMap((module) =>
          module.tasks
            .filter((task) => task.isInCustomRoadmap)
            .map((task) => ({ clientId: client.id, clientName: client.name, moduleId: module.id, task })),
        ),
      ),
    [clients],
  );

  const projects = useMemo(() => Array.from(new Set(ganttTasks.map(({ task }) => task.project).filter(Boolean))), [ganttTasks]);

  const filteredTasks = useMemo(
    () =>
      ganttTasks.filter(({ task }) => {
        const matchesSearch = [task.title, task.assignee ?? '', task.project ?? '']
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesProject = projectFilter === 'all' || task.project === projectFilter;
        const today = new Date();
        const taskStart = task.startDate ? new Date(task.startDate) : null;
        const daysAhead = taskStart ? (taskStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) : Number.POSITIVE_INFINITY;
        const matchesTime =
          timeFilter === 'all' ||
          (timeFilter === 'week' && daysAhead >= -7 && daysAhead <= 7) ||
          (timeFilter === 'month' && daysAhead >= -31 && daysAhead <= 31) ||
          (timeFilter === 'year' && daysAhead >= -366 && daysAhead <= 366);
        return matchesSearch && matchesProject && matchesTime;
      }),
    [ganttTasks, search, projectFilter, timeFilter],
  );



  const pendingTasks = useMemo(() => filteredTasks.filter(({ task }) => mapKanbanStatusToGanttProgress(task.status, task.progress) < 100), [filteredTasks]);

  const completedTasks = useMemo(() => filteredTasks.filter(({ task }) => mapKanbanStatusToGanttProgress(task.status, task.progress) >= 100), [filteredTasks]);

  const availableModulesForCreate = useMemo(() => {
    const selectedClient = clients.find((client) => client.id === newTask.clientId);
    return selectedClient?.modules ?? [];
  }, [clients, newTask.clientId]);

  const handleCreateTask = () => {
    if (!newTask.title.trim()) {
      error('El título es obligatorio.');
      return;
    }
    addTasksBulk([
      {
        clientId: newTask.clientId,
        moduleId: Number(newTask.moduleId) || 1,
        title: newTask.title.trim(),
        description: newTask.description.trim() || 'Tarea creada desde Gantt',
        impact: 'Medium',
        category: 'Gantt',
        status: 'pending',
        isInRoadmap: true,
        startDate: newTask.startDate || undefined,
        endDate: newTask.endDate || undefined,
        assignee: newTask.assignee.trim() || undefined,
        project: newTask.project.trim() || undefined,
      },
    ]);
    success('Tarea creada y enviada a Kanban + Gantt.');
    setShowCreateModal(false);
    setNewTask({ title: '', description: '', startDate: '', endDate: '', assignee: '', project: '', moduleId: 1, clientId: currentClientId });
  };

  const handleAIDraft = () => {
    const prompt = newTask.description.trim();
    if (!prompt) {
      info('Escribe un contexto para generar un borrador IA.');
      return;
    }
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    setNewTask((prev) => ({
      ...prev,
      title: prev.title || `IA: ${prompt.slice(0, 48)}`,
      startDate: prev.startDate || now.toISOString().slice(0, 10),
      endDate: prev.endDate || end.toISOString().slice(0, 10),
    }));
    info('Borrador IA generado. Revísalo y guarda manualmente.');
  };

  const handleTimelineUpdate = (clientId: string, moduleId: number, task: Task, updates: Partial<Pick<Task, 'startDate' | 'endDate' | 'assignee' | 'project' | 'progress'>>) => {
    const nextProgress = updates.progress ?? task.progress ?? mapKanbanStatusToGanttProgress(task.status, task.progress);
    const shouldRestoreClient = clientId !== currentClientId;

    if (shouldRestoreClient) {
      switchClient(clientId);
    }

    setTimeout(() => {
      updateTaskTimeline(moduleId, task.id, updates);
      updateTaskStatus(moduleId, task.id, mapGanttProgressToKanbanStatus(nextProgress, task.status));
      if (shouldRestoreClient) {
        switchClient(currentClientId);
      }
    }, 0);
  };

  const exportCsv = () => {
    const headers = ['Task', 'Project', 'Assignee', 'Start', 'End', 'Progress', 'Status'];
    const rows = filteredTasks.map(({ task }) => [task.title, task.project ?? '', task.assignee ?? '', task.startDate ?? '', task.endDate ?? '', String(mapKanbanStatusToGanttProgress(task.status, task.progress)), task.status]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gantt-tasks.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success('CSV exportado.');
  };

  return (
    <section className="page-shell space-y-6">
      <header className="flex flex-col gap-4 rounded-brand-lg border border-border bg-surface p-5 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-brand-md bg-primary/10 text-primary"><CalendarRange size={20} /></div>
          <div>
            <h1 className="section-title">{t('nav.gantt_board')}</h1>
            <p className="text-sm text-muted">{t('nav.gantt_board_sub')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'year'] as const).map((mode) => (
            <Button key={mode} variant={viewMode === mode ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode(mode)}>
              {mode}
            </Button>
          ))}
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>Nueva tarea</Button>
          <Button variant="secondary" size="sm" onClick={handleAnalyzeGantt} disabled={isAnalyzing || filteredTasks.length === 0}>
            {isAnalyzing ? <Spinner size={14} /> : null}
            Analizar Gantt
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}><Download size={16} /> CSV</Button>
        </div>
      </header>

      <div className="rounded-brand-lg border border-border bg-surface p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Buscar tarea, responsable o proyecto" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="w-full rounded-brand-md border border-border bg-surface-alt px-4 py-2 text-sm text-foreground" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="all">Todos los proyectos</option>
            {projects.map((project) => <option key={project} value={project}>{project}</option>)}
          </select>
          <select className="w-full rounded-brand-md border border-border bg-surface-alt px-4 py-2 text-sm text-foreground" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}>
            <option value="all">Todo el tiempo</option>
            <option value="week">Ventana semanal</option>
            <option value="month">Ventana mensual</option>
            <option value="year">Ventana anual</option>
          </select>
        </div>
      </div>


      {analysisResult && (
        <div className="rounded-brand-lg border border-border bg-surface p-4 shadow-soft">
          <h2 className="text-base font-semibold text-foreground">Resultado del análisis</h2>
          <p className="mt-1 text-sm text-muted">
            Total: {analysisResult.summary.totalTasks} · Avance medio: {analysisResult.summary.completionAvg}% · Vencidas: {analysisResult.summary.overdueCount}
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
            {analysisResult.recommendations.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-brand-lg border border-border bg-surface p-4 shadow-soft">
        <h2 className="text-base font-semibold text-foreground">Tareas activas ({pendingTasks.length})</h2>
      </div>

      <div className="overflow-x-auto rounded-brand-lg border border-border bg-surface shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-alt text-left text-muted">
            <tr>
              <th className="px-4 py-3">Task</th><th className="px-4 py-3">Timeline ({viewMode})</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingTasks.map(({ clientId, clientName, moduleId, task }) => {
              const progress = mapKanbanStatusToGanttProgress(task.status, task.progress);
              return (
                <tr key={`${clientId}-${moduleId}-${task.id}`} className="border-t border-border/70">
                  <td className="px-4 py-3 font-medium text-foreground">{task.title}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-surface-alt"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
                      <p className="text-xs text-muted">{toDateInput(task.startDate)} → {toDateInput(task.endDate)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{clientName}</td>
                  <td className="px-4 py-3 text-muted">{task.project || '-'}</td>
                  <td className="px-4 py-3 text-muted">{task.assignee || '-'}</td>
                  <td className="px-4 py-3">{progress}%</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingTask({ clientId, clientName, moduleId, task })}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmState({ clientId, clientName, moduleId, task })}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>



      <div className="rounded-brand-lg border border-border bg-surface p-4 shadow-soft">
        <h2 className="text-base font-semibold text-foreground">Tareas completadas ({completedTasks.length})</h2>
      </div>

      <div className="overflow-x-auto rounded-brand-lg border border-border bg-surface shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-alt text-left text-muted">
            <tr>
              <th className="px-4 py-3">Task</th><th className="px-4 py-3">Timeline ({viewMode})</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {completedTasks.map(({ clientId, clientName, moduleId, task }) => {
              const progress = mapKanbanStatusToGanttProgress(task.status, task.progress);
              return (
                <tr key={`${clientId}-${moduleId}-${task.id}`} className="border-t border-border/70 opacity-80">
                  <td className="px-4 py-3 font-medium text-foreground line-through">{task.title}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-surface-alt"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                      <p className="text-xs text-muted">{toDateInput(task.startDate)} → {toDateInput(task.endDate)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{clientName}</td>
                  <td className="px-4 py-3 text-muted">{task.project || '-'}</td>
                  <td className="px-4 py-3 text-muted">{task.assignee || '-'}</td>
                  <td className="px-4 py-3">{progress}%</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingTask({ clientId, clientName, moduleId, task })}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmState({ clientId, clientName, moduleId, task })}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!editingTask} onClose={() => setEditingTask(null)} title="Editar tarea" className="max-w-2xl">
        {editingTask && (
          <form className="space-y-3" onSubmit={(e) => {e.preventDefault(); setEditingTask(null); success('Tarea actualizada en Kanban y Gantt.');}}>
            <Input value={editingTask.task.project || ''} placeholder="Proyecto" onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, project: e.target.value } } : prev)} />
            <Input value={editingTask.task.assignee || ''} placeholder="Responsable" onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, assignee: e.target.value } } : prev)} />
            <Input type="date" value={toDateInput(editingTask.task.startDate)} onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, startDate: e.target.value } } : prev)} />
            <Input type="date" value={toDateInput(editingTask.task.endDate)} onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, endDate: e.target.value } } : prev)} />
            <Input type="number" min={0} max={100} value={mapKanbanStatusToGanttProgress(editingTask.task.status, editingTask.task.progress)} onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, progress: Number(e.target.value) } } : prev)} />
            <p className="text-xs text-muted">Cliente: {editingTask.clientName}</p>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditingTask(null)}>Cancelar</Button><Button type="submit" onClick={() => handleTimelineUpdate(editingTask.clientId, editingTask.moduleId, editingTask.task, { project: editingTask.task.project, assignee: editingTask.task.assignee, startDate: editingTask.task.startDate, endDate: editingTask.task.endDate, progress: editingTask.task.progress })}>Guardar</Button></div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmState}
        title="Quitar de roadmap"
        message="Esta tarea se ocultará del Gantt pero seguirá en Kanban."
        confirmLabel={t('feedback.confirm.confirm_button')}
        cancelLabel={t('feedback.confirm.cancel_button')}
        onConfirm={() => { if (confirmState) {
          const shouldRestoreClient = confirmState.clientId !== currentClientId;
          if (shouldRestoreClient) switchClient(confirmState.clientId);
          setTimeout(() => {
            toggleCustomRoadmapTask(confirmState.moduleId, confirmState.task.id);
            if (shouldRestoreClient) switchClient(currentClientId);
          }, 0);
          info('Tarea removida del roadmap personalizado.'); } setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
        isDestructive={false}
      />

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nueva tarea para Kanban + Gantt" className="max-w-2xl">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant={createMode === 'manual' ? 'primary' : 'secondary'} size="sm" onClick={() => setCreateMode('manual')}>Manual</Button>
            <Button variant={createMode === 'ai' ? 'primary' : 'secondary'} size="sm" onClick={() => setCreateMode('ai')}>IA asistida</Button>
          </div>
          <Input placeholder="Título" value={newTask.title} onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))} />
          <Input placeholder={createMode === 'ai' ? 'Describe objetivo, alcance y fechas (prompt IA)' : 'Descripción'} value={newTask.description} onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))} />
          <select className="w-full rounded-brand-md border border-border bg-surface-alt px-4 py-2 text-sm text-foreground" value={newTask.clientId} onChange={(e) => setNewTask((prev) => ({ ...prev, clientId: e.target.value, moduleId: 1 }))}>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <select className="w-full rounded-brand-md border border-border bg-surface-alt px-4 py-2 text-sm text-foreground" value={newTask.moduleId} onChange={(e) => setNewTask((prev) => ({ ...prev, moduleId: Number(e.target.value) }))}>
            {availableModulesForCreate.map((module) => <option key={module.id} value={module.id}>Módulo {module.id}: {module.title}</option>)}
          </select>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Proyecto" value={newTask.project} onChange={(e) => setNewTask((prev) => ({ ...prev, project: e.target.value }))} />
            <Input placeholder="Responsable" value={newTask.assignee} onChange={(e) => setNewTask((prev) => ({ ...prev, assignee: e.target.value }))} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Input type="date" value={newTask.startDate} onChange={(e) => setNewTask((prev) => ({ ...prev, startDate: e.target.value }))} />
            <Input type="date" value={newTask.endDate} onChange={(e) => setNewTask((prev) => ({ ...prev, endDate: e.target.value }))} />
          </div>
          {createMode === 'ai' && <Button variant="secondary" onClick={handleAIDraft}>Generar borrador IA</Button>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateTask}>Crear tarea</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

export default GanttBoard;
