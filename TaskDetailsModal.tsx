import React, { useMemo, useState, useEffect } from 'react';
import { GanttChart } from './components/GanttChart';
import { TaskInput } from './components/TaskInput';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { Task, ViewMode } from './types';
import { LayoutDashboard, Calendar, Search, Filter, ZoomIn, ZoomOut, CalendarDays, DownloadCloud, BrainCircuit, Moon, Sun } from 'lucide-react';
import { addDays, startOfDay } from 'date-fns';
import { analyzeBottlenecks } from './services/ai';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [tasks, setTasks] = useState<Task[]>([
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
  ]);

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState('');

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeBottlenecks(tasks, new Date());
      setAiInsights(analysis || 'No se encontraron problemas evidentes.');
    } catch(e) {
      console.error(e);
      setAiInsights('Error al analizar las tareas.');
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Timeline & Chart */}
          <div className="lg:col-span-3 space-y-6">
            <GanttChart tasks={filteredTasks} viewMode={viewMode} onTaskClick={setSelectedTask} />
            <TaskInput onTasksAdded={handleTasksAdded} />
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
