import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { Task } from '@/types';

const mapKanbanStatusToGanttProgress = (status: string, fallbackProgress?: number): number => {
  if (typeof fallbackProgress === 'number') {
    return Math.max(0, Math.min(100, Math.round(fallbackProgress)));
  }

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

const GanttBoard: React.FC = () => {
  const { t } = useTranslation();
  const { modules, updateTaskTimeline, updateTaskStatus } = useProject();

  const ganttTasks = useMemo(
    () =>
      modules.flatMap((module) =>
        module.tasks
          .filter((task) => task.isInCustomRoadmap)
          .map((task) => ({ moduleId: module.id, task })),
      ),
    [modules],
  );

  const handleTimelineUpdate = (
    moduleId: number,
    task: Task,
    updates: Partial<Pick<Task, 'startDate' | 'endDate' | 'assignee' | 'project' | 'progress'>>,
  ) => {
    const nextProgress = updates.progress ?? task.progress ?? mapKanbanStatusToGanttProgress(task.status, task.progress);
    updateTaskTimeline(moduleId, task.id, updates);
    updateTaskStatus(moduleId, task.id, mapGanttProgressToKanbanStatus(nextProgress, task.status));
  };

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarRange size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav.gantt_board')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('nav.gantt_board_sub')}</p>
          </div>
        </div>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/70">
            <tr className="text-left text-slate-600 dark:text-slate-300">
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Kanban</th>
            </tr>
          </thead>
          <tbody>
            {ganttTasks.map(({ moduleId, task }) => {
              const progress = mapKanbanStatusToGanttProgress(task.status, task.progress);
              return (
                <tr key={`${moduleId}-${task.id}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{task.title}</td>
                  <td className="px-4 py-3">
                    <input className="w-full rounded border px-2 py-1 bg-transparent" value={task.project || ''} onChange={(e) => handleTimelineUpdate(moduleId, task, { project: e.target.value })} />
                  </td>
                  <td className="px-4 py-3">
                    <input className="w-full rounded border px-2 py-1 bg-transparent" value={task.assignee || ''} onChange={(e) => handleTimelineUpdate(moduleId, task, { assignee: e.target.value })} />
                  </td>
                  <td className="px-4 py-3">
                    <input type="date" className="w-full rounded border px-2 py-1 bg-transparent" value={task.startDate || ''} onChange={(e) => handleTimelineUpdate(moduleId, task, { startDate: e.target.value || undefined })} />
                  </td>
                  <td className="px-4 py-3">
                    <input type="date" className="w-full rounded border px-2 py-1 bg-transparent" value={task.endDate || ''} onChange={(e) => handleTimelineUpdate(moduleId, task, { endDate: e.target.value || undefined })} />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" min={0} max={100} className="w-24 rounded border px-2 py-1 bg-transparent" value={progress} onChange={(e) => handleTimelineUpdate(moduleId, task, { progress: Number(e.target.value) })} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{task.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default GanttBoard;
