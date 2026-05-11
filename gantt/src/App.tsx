import React, { useMemo, useState, useEffect } from 'react';
import { GanttChart } from './GanttChart';
import { TaskInput } from './TaskInput';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { Task, ViewMode } from './types';
import { LayoutDashboard, Calendar, Search, Filter, ZoomIn, ZoomOut, CalendarDays, DownloadCloud, BrainCircuit, Moon, Sun } from 'lucide-react';
import { addDays, startOfDay } from 'date-fns';


const STORAGE_KEY = 'gantt.tasks.v1';

const getClientName = (task: Task) =>
  task.project?.trim() || task.assignee?.trim() || 'Sin cliente/proyecto';

const buildClientKanbanAnalysis = (items: Task[]) => {
  if (items.length === 0) {
    return 'No hay tareas para analizar.';
  }

  const summary = items.reduce<Record<string, Record<Task['status'], number>>>((acc, task) => {
    const client = getClientName(task);
    if (!acc[client]) {
      acc[client] = { todo: 0, 'in-progress': 0, done: 0 };
    }
    acc[client][task.status] += 1;
    return acc;
  }, {});

  const sortedClients = Object.entries(summary).sort((a, b) => a[0].localeCompare(b[0]));

  return sortedClients
    .map(([client, statuses]) => {
      const total = statuses.todo + statuses['in-progress'] + statuses.done;
      const notCompleted = statuses.todo + statuses['in-progress'];
      const generalStatus =
        notCompleted === 0
          ? '✅ Completado'
          : statuses['in-progress'] > 0
            ? '🟡 En ejecución'
            : '🔴 Pendiente';

      return [
        `Cliente: ${client}`,
        `Estado general: ${generalStatus}`,
        `Kanban -> Por hacer: ${statuses.todo}, En progreso: ${statuses['in-progress']}, Completadas: ${statuses.done}, Total: ${total}`,
        `No completadas: ${notCompleted}`
      ].join('\n');
    })
    .join('\n\n');
};

const serializeTasks = (items: Task[]) => JSON.stringify(items.map(task => ({
  ...task,
  startDate: task.startDate.toISOString(),
  endDate: task.endDate.toISOString()
})));

const parseStoredTasks = (raw: string | null): Task[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((task) => task?.id && task?.title && task?.startDate && task?.endDate && task?.status)
      .map((task) => ({
        ...task,
        startDate: new Date(task.startDate),
        endDate: new Date(task.endDate)
      }))
      .filter((task) => !Number.isNaN(task.startDate.getTime()) && !Number.isNaN(task.endDate.getTime()));
  } catch (error) {
    console.error('No se pudo leer las tareas guardadas.', error);
    return null;
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'gantt-board' | 'tasks'>('gantt-board');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [tasks, setTasks] = useState<Task[]>(() => {
    const storedTasks = parseStoredTasks(localStorage.getItem(STORAGE_KEY));
    if (storedTasks && storedTasks.length > 0) {
      return storedTasks;
    }

    return [
      {
        id: 'example-1',
        title: 'Planificación Inicial',
        startDate: startOfDay(new Date()),
        endDate: addDays(startOfDay(new Date()), 2),
        status: 'done',
        color: '#4f46e5',
        project: 'Gantt AI',
        assignee: 'Alex'
      },
      {
        id: 'example-2',
        title: 'Diseño de la interfaz',
        startDate: startOfDay(new Date()),
        endDate: addDays(startOfDay(new Date()), 4),
        status: 'in-progress',
        color: '#06b6d4',
        project: 'Gantt AI',
        assignee: 'María'
      }
    ];
  });

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
  }, [tasks]);


  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = buildClientKanbanAnalysis(filteredTasks);
      setAiInsights(analysis);
    } catch (e) {
      console.error(e);
      setAiInsights('Error al analizar las tareas por cliente.');
    }
    setIsAnalyzing(false);
  };

  const exportCSV = () => {
    const headers = ['ID', 'Title', 'Start Date', 'End Date', 'Status', 'Progress', 'Project', 'Assignee'];
    const rows = tasks.map(t => [
      t.id, 
      `"${t.title.replace(/"/g, '""')}"`, 
      t.startDate.toISOString().split('T')[0], 
      t.endDate.toISOString().split('T')[0], 
      t.status, 
      t.progress || 0, 
      `"${(t.project || '').replace(/"/g, '""')}"`, 
      `"${(t.assignee || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "gantt_tasks.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportICal = () => {
    let ical = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//GanttMaster AI//ES\n';
    tasks.forEach(t => {
      ical += 'BEGIN:VEVENT\n';
      ical += `SUMMARY:${t.title}\n`;
      ical += `DTSTART;VALUE=DATE:${t.startDate.toISOString().split('T')[0].replace(/-/g, '')}\n`;
      const end = new Date(t.endDate);
      end.setDate(end.getDate() + 1); // iCal end date is exclusive
      ical += `DTEND;VALUE=DATE:${end.toISOString().split('T')[0].replace(/-/g, '')}\n`;
      ical += `UID:${t.id}\n`;
      if (t.notes) ical += `DESCRIPTION:${t.notes.replace(/\n/g, '\\n')}\n`;
      ical += 'END:VEVENT\n';
    });
    ical += 'END:VCALENDAR';
    const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "gantt_tasks.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const projects = useMemo(() => {
    const list = tasks.map(t => t.project).filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            task.assignee?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject = selectedProject === 'all' || task.project === selectedProject;
      return matchesSearch && matchesProject;
    });
  }, [tasks, searchQuery, selectedProject]);


  const kanbanColumns = useMemo(() => {
    const statuses: Array<Task['status']> = ['todo', 'in-progress', 'done'];

    return statuses.map((status) => {
      const items = filteredTasks.filter((task) => task.status === status);
      const projectSummary = items.reduce<Record<string, number>>((acc, task) => {
        const key = getClientName(task);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      return {
        status,
        items,
        projectSummary: Object.entries(projectSummary)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      };
    });
  }, [filteredTasks]);

  const statusLabels: Record<Task['status'], string> = {
    todo: 'Por hacer',
    'in-progress': 'En progreso',
    done: 'Completadas'
  };

  const pendingTasksByMonth = useMemo(() => {
    const pendingTasks = filteredTasks.filter((task) => task.status !== 'done');
    const monthLabels = Array.from(
      new Set(
        pendingTasks.flatMap((task) => {
          const labels: string[] = [];
          const cursor = new Date(task.startDate.getFullYear(), task.startDate.getMonth(), 1);
          const end = new Date(task.endDate.getFullYear(), task.endDate.getMonth(), 1);

          while (cursor <= end) {
            labels.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
            cursor.setMonth(cursor.getMonth() + 1);
          }

          return labels;
        })
      )
    ).sort();

    return {
      monthLabels,
      pendingTasks
    };
  }, [filteredTasks]);

  const handleTasksAdded = (newTasks: Task[]) => {
    setTasks(prev => [...prev, ...newTasks]);
  };

  const saveEditedTask = (edited: Task) => {
    setTasks(prev => prev.map(t => t.id === edited.id ? edited : t));
    setSelectedTask(null);
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelectedTask(null);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-baseline justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-sm">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight dark:text-white">GanttMaster AI</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Organiza tu tiempo con Inteligencia Artificial.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 transition-colors" 
              title="Cambiar tema"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={exportCSV} className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 transition-colors" title="Exportar a CSV">
              <DownloadCloud className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
            </button>
            <button onClick={exportICal} className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 transition-colors" title="Exportar a iCalendar">
              <CalendarDays className="w-4 h-4" /> <span className="hidden sm:inline">iCal</span>
            </button>
            <button onClick={handleAnalyze} disabled={isAnalyzing} className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-2 text-sm font-medium transition-colors" title="Analizar con IA">
              {isAnalyzing ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
               <span className="hidden sm:inline">Analizar Gantt</span>
            </button>
          </div>
        </header>

        {aiInsights && (
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-indigo-900 text-sm relative animate-in fade-in slide-in-from-top-4">
            <button onClick={() => setAiInsights('')} className="absolute top-2 right-2 p-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h4 className="font-bold flex items-center gap-2 mb-2 text-indigo-800"><BrainCircuit className="w-4 h-4"/> Análisis de IA</h4>
            <div className="whitespace-pre-wrap">{aiInsights}</div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar tareas o responsables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-950 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
            </div>
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select 
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-950 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="all">Todos los proyectos</option>
                {projects.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'day' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Días
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'week' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Semanas
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'month' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Meses
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-800 w-fit">
          <button
            onClick={() => setActiveTab('gantt-board')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeTab === 'gantt-board' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Tablero Gantt
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeTab === 'tasks' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Lista de tareas
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Timeline & Chart */}
          <div className="lg:col-span-3 space-y-6">
            {activeTab === 'gantt-board' ? (
              <>
                <GanttChart tasks={filteredTasks} viewMode={viewMode} onTaskClick={setSelectedTask} />

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-3">
                    Kanban por estado (cliente/proyecto)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {kanbanColumns.map((column) => (
                      <div key={column.status} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/20 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{statusLabels[column.status]}</h4>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{column.items.length}</span>
                        </div>
                        {column.items.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">Sin tareas en este estado.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {column.projectSummary.map(([projectName, total]) => (
                              <li key={`${column.status}-${projectName}`} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 rounded-md px-2 py-1 border border-gray-100 dark:border-gray-800">
                                <span className="truncate pr-2">{projectName}</span>
                                <span className="font-semibold">{total}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>


                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-3">
                    Calendarización mensual de pendientes
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className="sticky left-0 bg-white dark:bg-gray-900 text-left p-2 border-b border-gray-200 dark:border-gray-800">Tarea pendiente</th>
                          {pendingTasksByMonth.monthLabels.map((monthLabel) => (
                            <th key={monthLabel} className="p-2 border-b border-gray-200 dark:border-gray-800 text-center whitespace-nowrap">{monthLabel}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingTasksByMonth.pendingTasks.map((task) => (
                          <tr key={`pending-${task.id}`} className="odd:bg-gray-50/60 dark:odd:bg-gray-800/30">
                            <td className="sticky left-0 bg-inherit p-2 border-b border-gray-100 dark:border-gray-800">{task.title}</td>
                            {pendingTasksByMonth.monthLabels.map((monthLabel) => {
                              const [year, month] = monthLabel.split('-').map(Number);
                              const startsBeforeOrInMonth = task.startDate <= new Date(year, month, 0);
                              const endsAfterOrInMonth = task.endDate >= new Date(year, month - 1, 1);
                              const isActiveInMonth = startsBeforeOrInMonth && endsAfterOrInMonth;
                              return (
                                <td key={`${task.id}-${monthLabel}`} className="p-2 text-center border-b border-gray-100 dark:border-gray-800">
                                  {isActiveInMonth ? '●' : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <TaskInput onTasksAdded={handleTasksAdded} />
              </>
            ) : (
              <TaskInput onTasksAdded={handleTasksAdded} />
            )}
          </div>

          {/* Sidebar Task List */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
              Tareas ({filteredTasks.length})
            </h3>
            {filteredTasks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No se encontraron tareas.</p>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => setSelectedTask(task)}
                    className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm relative group cursor-pointer hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.color || '#3b82f6' }} />
                      <h4 className="font-medium text-sm text-gray-800 dark:text-gray-200 pr-2 leading-tight truncate">{task.title}</h4>
                    </div>
                    {(task.project || task.assignee) && (
                      <div className="flex gap-2 text-[10px] text-gray-400 dark:text-gray-500 mt-1 mb-2">
                        {task.project && <span className="bg-gray-100 dark:bg-gray-800 px-1.5 rounded uppercase tracking-wider">{task.project}</span>}
                        {task.assignee && <span>👤 {task.assignee}</span>}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between mt-3 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md transition-colors">
                      <span>{task.startDate.toLocaleDateString()}</span>
                      <span className="text-gray-300 dark:text-gray-700">|</span>
                      <span>{task.endDate.toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>

      {selectedTask && (
        <TaskDetailsModal 
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={saveEditedTask}
          onDelete={removeTask}
        />
      )}
    </div>
  );
}
