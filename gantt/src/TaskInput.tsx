import React, { useMemo } from 'react';
import { differenceInDays, startOfDay, addDays, min, max, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Task, ViewMode } from './types';

interface GanttChartProps {
  tasks: Task[];
  viewMode: ViewMode;
  onTaskClick?: (task: Task) => void;
}

export function GanttChart({ tasks, viewMode, onTaskClick }: GanttChartProps) {
  const pixelsPerDay = viewMode === 'day' ? 48 : viewMode === 'week' ? 12 : 4;

  const { startDate, chartItems } = useMemo(() => {
    let rawStart = startOfDay(new Date());
    let rawEnd = addDays(rawStart, 14);

    if (tasks.length > 0) {
      rawStart = min(tasks.map(t => startOfDay(t.startDate)));
      rawEnd = max(tasks.map(t => startOfDay(t.endDate)));
    }

    let start = rawStart;
    let end = rawEnd;

    let items: { date: Date; labelPrimary: string; labelSecondary: string; width: number }[] = [];

    if (viewMode === 'day') {
      start = addDays(rawStart, -2);
      end = addDays(rawEnd, 4);
      const days = eachDayOfInterval({ start, end });
      items = days.map(d => ({
        date: d,
        labelPrimary: format(d, 'd'),
        labelSecondary: format(d, 'MMM', { locale: es }),
        width: pixelsPerDay
      }));
    } else if (viewMode === 'week') {
      start = startOfWeek(addDays(rawStart, -7), { weekStartsOn: 1 });
      end = startOfWeek(addDays(rawEnd, 14), { weekStartsOn: 1 });
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      items = weeks.map(w => ({
        date: w,
        labelPrimary: format(w, 'd MMM', { locale: es }),
        labelSecondary: `Sem ${format(w, 'w')}`,
        width: pixelsPerDay * 7
      }));
    } else if (viewMode === 'month') {
      start = startOfMonth(addDays(rawStart, -30));
      end = startOfMonth(addDays(rawEnd, 60));
      const months = eachMonthOfInterval({ start, end });
      items = months.map(m => {
        const daysInMonth = differenceInDays(endOfMonth(m), m) + 1;
        return {
          date: m,
          labelPrimary: format(m, 'MMM', { locale: es }),
          labelSecondary: format(m, 'yyyy'),
          width: pixelsPerDay * daysInMonth
        };
      });
    }

    return {
      startDate: start,
      endDate: end,
      chartItems: items
    };
  }, [tasks, viewMode, pixelsPerDay]);

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm transition-colors">
      <div className="min-w-fit flex flex-col p-4">
        {/* Header (Dates) */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 pb-2 mb-2 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors" style={{ paddingLeft: '200px' }}>
          {chartItems.map((item, i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center justify-center text-xs opacity-60 border-l border-transparent" style={{ width: `${item.width}px` }}>
               <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">{item.labelPrimary}</span>
               <span className="capitalize dark:text-gray-400">{item.labelSecondary}</span>
            </div>
          ))}
        </div>

        {/* Task Rows */}
        <div className="relative" style={{ minHeight: '100px' }}>
          {/* Vertical Grid Lines */}
          <div className="absolute inset-0 flex pointer-events-none" style={{ left: '200px' }}>
             {chartItems.map((item, i) => (
                <div key={i} className="flex-shrink-0 border-l border-gray-100 dark:border-gray-800 h-full transition-colors" style={{ width: `${item.width}px` }} />
             ))}
          </div>

          {tasks.length === 0 ? (
            <div className="text-gray-400 dark:text-gray-500 text-sm py-4 text-center">No hay tareas programadas.</div>
          ) : tasks.map((task) => {
            const startOffset = differenceInDays(startOfDay(task.startDate), startDate);
            const duration = differenceInDays(startOfDay(task.endDate), startOfDay(task.startDate)) + 1; // +1 to include end day

            return (
              <div key={task.id} className="group relative flex items-center h-12 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors cursor-pointer" onClick={() => onTaskClick?.(task)}>
                {/* Task Label */}
                <div className="w-[200px] flex-shrink-0 pr-4 flex flex-col justify-center truncate pl-2 relative bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50 z-10 h-full transition-colors">
                  <span className="font-medium text-sm text-gray-700 dark:text-gray-300 truncate">{task.title}</span>
                  {(task.project || task.assignee) && (
                    <div className="flex gap-2 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {task.project && <span className="bg-gray-100 dark:bg-gray-800 px-1.5 rounded">{task.project}</span>}
                      {task.assignee && <span>👤 {task.assignee}</span>}
                    </div>
                  )}
                </div>
                
                {/* Task Bar Area */}
                <div className="flex-1 relative h-full">
                  <div 
                    className="absolute h-8 top-2 rounded-md shadow-sm transition-transform group-hover:-translate-y-0.5 flex flex-col justify-center px-3 text-xs text-white font-medium overflow-hidden"
                    style={{
                      left: `${Math.max(0, startOffset * pixelsPerDay)}px`,
                      width: `${Math.max(pixelsPerDay, duration * pixelsPerDay)}px`,
                      backgroundColor: task.color || '#3b82f6',
                    }}
                    title={`${task.title} (${format(task.startDate, 'dd MMM')} - ${format(task.endDate, 'dd MMM')})`}
                  >
                    {task.progress !== undefined && task.progress > 0 && (
                      <div 
                        className="absolute top-0 left-0 h-full bg-black/20" 
                        style={{ width: `${task.progress}%` }} 
                      />
                    )}
                    <span className="truncate relative z-10">{duration * pixelsPerDay > 30 ? task.title : ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
