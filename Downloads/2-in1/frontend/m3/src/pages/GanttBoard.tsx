import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, ChevronDown, ChevronRight, Download, Pencil, Trash2 } from 'lucide-react';
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

type SortField = 'status' | 'assignee' | 'project' | 'title' | 'startDate' | 'endDate';
type SortOrder = 'asc' | 'desc';

const toDateInput = (date?: string) => {
  if (!date) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const getTaskDateState = (task: Task): 'overdue' | 'next-week' | 'normal' => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (task.endDate) {
    const endDate = new Date(task.endDate);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) return 'overdue';
  }

  if (task.startDate) {
    const startDate = new Date(task.startDate);
    startDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 7 && diffDays <= 13) return 'next-week';
  }

  return 'normal';
};

const getTaskDateStyles = (task: Task) => {
  const state = getTaskDateState(task);
  if (state === 'overdue') {
    return {
      rowClass: 'bg-red-50/50 dark:bg-red-950/20',
      textClass: 'text-red-700 dark:text-red-300',
    };
  }
  if (state === 'next-week') {
    return {
      rowClass: 'bg-amber-50/50 dark:bg-amber-950/20',
      textClass: 'text-amber-700 dark:text-amber-300',
    };
  }
  return {
    rowClass: '',
    textClass: 'text-muted',
  };
};

const GanttBoard: React.FC = () => {
  const { t } = useTranslation();
  const { clients, currentClientId, updateTaskTimeline, updateTaskStatus, deleteTask, switchClient, addTasksBulk } = useProject();
  const { success, info, error } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [editingTask, setEditingTask] = useState<{ clientId: string; clientName: string; moduleId: number; task: Task } | null>(null);
  const [confirmState, setConfirmState] = useState<{ clientId: string; clientName: string; moduleId: number; task: Task } | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showPending, setShowPending] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
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
            .filter((task) => task.isInCustomRoadmap || Boolean(task.startDate || task.endDate))
            .map((task) => ({ clientId: client.id, clientName: client.name, moduleId: module.id, task })),
        ),
      ),
    [clients],
  );

  const getTaskProjectLabel = (task: Task, clientName: string) => task.project?.trim() || clientName;

  const projects = useMemo(() => Array.from(new Set(ganttTasks.map(({ clientName, task }) => getTaskProjectLabel(task, clientName)).filter(Boolean))), [ganttTasks]);

  const filteredTasks = useMemo(
    () =>
      ganttTasks.filter(({ task, clientName }) => {
        const matchesSearch = [task.title, task.assignee ?? '', task.project ?? '']
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase());
        const effectiveProject = getTaskProjectLabel(task, clientName);
        const matchesProject = projectFilter === 'all' || effectiveProject === projectFilter;
        const today = new Date();
        const timelineAnchor = task.startDate || task.endDate || task.dueDate;
        const taskAnchor = timelineAnchor ? new Date(timelineAnchor) : null;
        const daysAhead = taskAnchor ? (taskAnchor.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) : Number.POSITIVE_INFINITY;
        const matchesTime =
          timeFilter === 'all' ||
          (timeFilter === 'week' && daysAhead >= -7 && daysAhead <= 7) ||
          (timeFilter === 'month' && daysAhead >= -31 && daysAhead <= 31) ||
          (timeFilter === 'year' && daysAhead >= -366 && daysAhead <= 366);
        return matchesSearch && matchesProject && matchesTime;
      }),
    [ganttTasks, search, projectFilter, timeFilter],
  );



  const sortedTasks = useMemo(() => {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...filteredTasks].sort((a, b) => {
      const va = (a.task[sortField] || '').toString().toLowerCase();
      const vb = (b.task[sortField] || '').toString().toLowerCase();
      return va.localeCompare(vb) * direction;
    });
  }, [filteredTasks, sortField, sortOrder]);

  const pendingTasks = useMemo(() => sortedTasks.filter(({ task }) => task.status !== 'completed'), [sortedTasks]);

  const completedTasks = useMemo(() => sortedTasks.filter(({ task }) => task.status === 'completed'), [sortedTasks]);

  const calendarItems = useMemo(() => {
    return sortedTasks
      .filter(({ task }) => task.startDate || task.endDate)
      .map(({ clientName, task }) => ({
        date: task.startDate || task.endDate || '',
        text: `${task.title} · ${task.status} · ${task.project || clientName}`,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sortedTasks]);

  const formatTimelineRange = (task: Task) => {
    const start = task.startDate ? new Date(task.startDate) : null;
    const end = task.endDate ? new Date(task.endDate) : null;
    if (!start && !end) return 'Sin fechas';
    const s = start ? start.toLocaleDateString('es-ES') : '—';
    const e = end ? end.toLocaleDateString('es-ES') : '—';
    if (viewMode === 'day') return `${s} · Franja diaria`;
    if (viewMode === 'week') return `${s} → ${e} · Franja semanal`; // soporta tareas con solo fecha fin (desde Kanban)
    if (viewMode === 'month') return `${s} → ${e} · Mes/Año`; 
    return `${s} → ${e} · Año`;
  };

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

    if (shouldRestoreClient) switchClient(clientId);

    setTimeout(() => {
      updateTaskTimeline(moduleId, task.id, updates, clientId);
      updateTaskStatus(moduleId, task.id, mapGanttProgressToKanbanStatus(nextProgress, task.status), clientId);
      if (shouldRestoreClient) switchClient(currentClientId);
    }, 0);
  };

  const exportCsv = () => {
    const headers = ['Task', 'Project', 'Assignee', 'Start', 'End', 'Kanban Status'];
    const rows = filteredTasks.map(({ task }) => [task.title, task.project ?? '', task.assignee ?? '', task.startDate ?? '', task.endDate ?? '', task.status]);
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
          <select className="w-full rounded-brand-md border border-border bg-surface-alt px-4 py-2 text-sm text-foreground" value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}>
            <option value="status">Ordenar por estado</option>
            <option value="assignee">Ordenar por responsable</option>
            <option value="project">Ordenar por proyecto</option>
            <option value="title">Ordenar por título</option>
            <option value="startDate">Ordenar por inicio</option>
            <option value="endDate">Ordenar por fin</option>
          </select>
          <select className="w-full rounded-brand-md border border-border bg-surface-alt px-4 py-2 text-sm text-foreground" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}>
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </div>
      </div>



      <div className="rounded-brand-lg border border-border bg-surface p-4 shadow-soft">
        <h2 className="text-base font-semibold text-foreground">Calendario de tareas</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {calendarItems.length === 0 ? (
            <p className="text-sm text-muted">No hay tareas con fecha para mostrar en calendario.</p>
          ) : (
            calendarItems.map((item) => (
              <div key={`${item.date}-${item.text}`} className="rounded-brand-md border border-border bg-surface-alt px-3 py-2 text-sm">
                <div className="font-medium text-foreground">{toDateInput(item.date)}</div>
                <div className="text-muted">{item.text}</div>
              </div>
            ))
          )}
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
        <button className="flex w-full items-center gap-2 text-left text-base font-semibold text-foreground" onClick={() => setShowPending((prev) => !prev)}>
          {showPending ? <ChevronDown size={18} /> : <ChevronRight size={18} />} Tareas activas ({pendingTasks.length})
        </button>
      </div>

      {showPending && <div className="overflow-x-auto rounded-brand-lg border border-border bg-surface shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-alt text-left text-muted">
            <tr>
              <th className="px-4 py-3">Task</th><th className="px-4 py-3">Timeline ({viewMode})</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Proyecto</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Columna Kanban</th><th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingTasks.map(({ clientId, clientName, moduleId, task }) => {
              const dateStyles = getTaskDateStyles(task);
              return (
                <tr key={`${clientId}-${moduleId}-${task.id}`} className={`border-t border-border/70 ${dateStyles.rowClass}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{task.title}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className={`text-xs ${dateStyles.textClass}`}>{formatTimelineRange(task)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{getTaskProjectLabel(task, clientName)}</td>
                  <td className="px-4 py-3 text-muted">{getTaskProjectLabel(task, clientName)}</td>
                  <td className="px-4 py-3 text-muted">{task.assignee || '-'}</td>
                  <td className="px-4 py-3">{task.status}</td>
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
      </div>}



      <div className="rounded-brand-lg border border-border bg-surface p-4 shadow-soft">
        <button className="flex w-full items-center gap-2 text-left text-base font-semibold text-foreground" onClick={() => setShowCompleted((prev) => !prev)}>
          {showCompleted ? <ChevronDown size={18} /> : <ChevronRight size={18} />} Tareas completadas ({completedTasks.length})
        </button>
      </div>

      {showCompleted && <div className="overflow-x-auto rounded-brand-lg border border-border bg-surface shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-alt text-left text-muted">
            <tr>
              <th className="px-4 py-3">Task</th><th className="px-4 py-3">Timeline ({viewMode})</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Proyecto</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Columna Kanban</th><th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {completedTasks.map(({ clientId, clientName, moduleId, task }) => {
              const dateStyles = getTaskDateStyles(task);
              return (
                <tr key={`${clientId}-${moduleId}-${task.id}`} className={`border-t border-border/70 opacity-80 ${dateStyles.rowClass}`}>
                  <td className="px-4 py-3 font-medium text-foreground line-through">{task.title}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className={`text-xs ${dateStyles.textClass}`}>{formatTimelineRange(task)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{getTaskProjectLabel(task, clientName)}</td>
                  <td className="px-4 py-3 text-muted">{getTaskProjectLabel(task, clientName)}</td>
                  <td className="px-4 py-3 text-muted">{task.assignee || '-'}</td>
                  <td className="px-4 py-3">{task.status}</td>
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
      </div>}

      <Modal isOpen={!!editingTask} onClose={() => setEditingTask(null)} title="Editar tarea" className="max-w-2xl">
        {editingTask && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleTimelineUpdate(editingTask.clientId, editingTask.moduleId, editingTask.task, {
                project: editingTask.task.project,
                assignee: editingTask.task.assignee,
                startDate: editingTask.task.startDate || undefined,
                endDate: editingTask.task.endDate || undefined,
              });
              setEditingTask(null);
              success('Tarea actualizada en Kanban y Gantt.');
            }}
          >
            <Input value={editingTask.task.project || ''} placeholder="Proyecto" onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, project: e.target.value } } : prev)} />
            <Input value={editingTask.task.assignee || ''} placeholder="Responsable" onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, assignee: e.target.value } } : prev)} />
            <Input type="date" value={toDateInput(editingTask.task.startDate)} onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, startDate: e.target.value } } : prev)} />
            <Input type="date" value={toDateInput(editingTask.task.endDate)} onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, endDate: e.target.value } } : prev)} />
            <p className="text-xs text-muted">Cliente: {editingTask.clientName}</p>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditingTask(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmState}
        title="Eliminar tarea"
        message="Esta tarea se eliminará de todos los tableros (Kanban, Gantt y listados)."
        confirmLabel={t('feedback.confirm.confirm_button')}
        cancelLabel={t('feedback.confirm.cancel_button')}
        onConfirm={() => { if (confirmState) {
          const shouldRestoreClient = confirmState.clientId !== currentClientId;
          if (shouldRestoreClient) switchClient(confirmState.clientId);
          setTimeout(() => {
            deleteTask(confirmState.moduleId, confirmState.task.id);
            if (shouldRestoreClient) switchClient(currentClientId);
          }, 0);
          info('Tarea eliminada en todos los tableros.'); } setConfirmState(null); }}
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
