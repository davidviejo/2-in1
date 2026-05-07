import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, Download, Pencil, Trash2 } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { Task } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastContext';
import { analyzeGantt, GanttAnalyzeResponse } from '@/services/ganttService';
import Spinner from '@/components/ui/Spinner';

type ViewMode = 'day' | 'week' | 'month';

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
  const { modules, updateTaskTimeline, updateTaskStatus, toggleCustomRoadmapTask } = useProject();
  const { success, info, error } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [editingTask, setEditingTask] = useState<{ moduleId: number; task: Task } | null>(null);
  const [confirmState, setConfirmState] = useState<{ moduleId: number; task: Task } | null>(null);

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
      modules.flatMap((module) =>
        module.tasks
          .filter((task) => task.isInCustomRoadmap)
          .map((task) => ({ moduleId: module.id, task })),
      ),
    [modules],
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
        return matchesSearch && matchesProject;
      }),
    [ganttTasks, search, projectFilter],
  );

  const handleTimelineUpdate = (moduleId: number, task: Task, updates: Partial<Pick<Task, 'startDate' | 'endDate' | 'assignee' | 'project' | 'progress'>>) => {
    const nextProgress = updates.progress ?? task.progress ?? mapKanbanStatusToGanttProgress(task.status, task.progress);
    updateTaskTimeline(moduleId, task.id, updates);
    updateTaskStatus(moduleId, task.id, mapGanttProgressToKanbanStatus(nextProgress, task.status));
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
          {(['day', 'week', 'month'] as const).map((mode) => (
            <Button key={mode} variant={viewMode === mode ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode(mode)}>
              {mode}
            </Button>
          ))}
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

      <div className="overflow-x-auto rounded-brand-lg border border-border bg-surface shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-alt text-left text-muted">
            <tr>
              <th className="px-4 py-3">Task</th><th className="px-4 py-3">Timeline ({viewMode})</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(({ moduleId, task }) => {
              const progress = mapKanbanStatusToGanttProgress(task.status, task.progress);
              return (
                <tr key={`${moduleId}-${task.id}`} className="border-t border-border/70">
                  <td className="px-4 py-3 font-medium text-foreground">{task.title}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-surface-alt"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
                      <p className="text-xs text-muted">{toDateInput(task.startDate)} → {toDateInput(task.endDate)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{task.project || '-'}</td>
                  <td className="px-4 py-3 text-muted">{task.assignee || '-'}</td>
                  <td className="px-4 py-3">{progress}%</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingTask({ moduleId, task })}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmState({ moduleId, task })}><Trash2 size={14} /></Button>
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
          <form className="space-y-3" onSubmit={(e) => {e.preventDefault(); setEditingTask(null); success('Tarea actualizada.');}}>
            <Input value={editingTask.task.project || ''} placeholder="Proyecto" onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, project: e.target.value } } : prev)} />
            <Input value={editingTask.task.assignee || ''} placeholder="Responsable" onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, assignee: e.target.value } } : prev)} />
            <Input type="date" value={toDateInput(editingTask.task.startDate)} onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, startDate: e.target.value } } : prev)} />
            <Input type="date" value={toDateInput(editingTask.task.endDate)} onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, endDate: e.target.value } } : prev)} />
            <Input type="number" min={0} max={100} value={mapKanbanStatusToGanttProgress(editingTask.task.status, editingTask.task.progress)} onChange={(e) => setEditingTask((prev) => prev ? { ...prev, task: { ...prev.task, progress: Number(e.target.value) } } : prev)} />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditingTask(null)}>Cancelar</Button><Button type="submit" onClick={() => handleTimelineUpdate(editingTask.moduleId, editingTask.task, { project: editingTask.task.project, assignee: editingTask.task.assignee, startDate: editingTask.task.startDate, endDate: editingTask.task.endDate, progress: editingTask.task.progress })}>Guardar</Button></div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmState}
        title="Quitar de roadmap"
        message="Esta tarea se ocultará del Gantt pero seguirá en Kanban."
        confirmLabel={t('feedback.confirm.confirm_button')}
        cancelLabel={t('feedback.confirm.cancel_button')}
        onConfirm={() => { if (confirmState) { toggleCustomRoadmapTask(confirmState.moduleId, confirmState.task.id); info('Tarea removida del roadmap personalizado.'); } setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
        isDestructive={false}
      />
    </section>
  );
};

export default GanttBoard;
