import React, { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useProject } from '../context/ProjectContext';
import { Task } from '../types';
import BulkActionsModal from '../components/BulkActionsModal';
import TaskDetailModal from '../components/TaskDetailModal';
import {
  CheckCircle2,
  Circle,
  Clock,
  GripVertical,
  Plus,
  Trash2,
  Link as LinkIcon,
  User,
  FileText,
  Target,
  PlayCircle,
  Eye,
  UserCheck,
  MessageSquare,
  Layers,
  ExternalLink,
  Edit2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEFAULT_KANBAN_COLUMNS } from '../config/kanban';

const KanbanBoard: React.FC = () => {
  const {
    modules,
    addTasksBulk,
    updateTaskStatus,
    toggleTask,
    currentClient,
    addKanbanColumn,
    deleteKanbanColumn,
    updateTaskDetails,
  } = useProject();

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // New task creation state
  const [isAddingTask, setIsAddingTask] = useState<{ columnId: string } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Task detail modal state
  const [selectedTask, setSelectedTask] = useState<{ task: Task; moduleId: number } | null>(null);

  const columns = currentClient?.kanbanColumns || DEFAULT_KANBAN_COLUMNS;

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, { task: Task; moduleId: number }[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = [];
    });

    // Ensure default keys exist in the grouping object
    // to prevent errors if a task has a status for a column that was deleted
    // or if a status doesn't match any column.

    modules.forEach((module) => {
      module.tasks.forEach((task) => {
        // Filter by Custom Roadmap
        if (!task.isInCustomRoadmap) return;

        const status = task.status || 'pending';
        if (grouped[status]) {
          grouped[status].push({ task, moduleId: module.id });
        } else {
          // Fallback: if status doesn't match any column, put in the first one
          const firstColId = columns[0]?.id || 'pending';
          if (!grouped[firstColId]) grouped[firstColId] = [];
          grouped[firstColId].push({ task, moduleId: module.id });
        }
      });
    });

    return grouped;
  }, [modules, columns]);

  const onDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStatus = destination.droppableId;

    let foundModuleId = -1;
    let foundTaskId = '';

    modules.forEach((m) => {
      const t = m.tasks.find((t) => t.id === draggableId);
      if (t) {
        foundModuleId = m.id;
        foundTaskId = t.id;
      }
    });

    if (foundModuleId !== -1) {
      updateTaskStatus(foundModuleId, foundTaskId, newStatus);
    }
  };

  const handleAddTask = (columnId: string) => {
    if (newTaskTitle.trim()) {
      // Find default custom module or fallback to first
      let targetModule = modules.find((m) => m.isCustom);
      if (!targetModule && modules.length > 0) targetModule = modules[modules.length - 1];

      if (targetModule) {
        const newTask = {
          moduleId: targetModule.id,
          title: newTaskTitle.trim(),
          description: `Nueva tarea creada en el tablero Kanban en la columna ${columns.find((c) => c.id === columnId)?.title || columnId}`,
          impact: 'Medium' as const,
          category: 'Kanban',
          status: columnId,
          isInRoadmap: true,
        };

        // We use addTasksBulk since it supports setting status and isInRoadmap directly
        addTasksBulk([newTask]);
      }
    }
    setNewTaskTitle('');
    setIsAddingTask(null);
  };

  const handleAddColumn = () => {
    if (newColumnTitle.trim()) {
      addKanbanColumn(newColumnTitle.trim());
      setNewColumnTitle('');
      setIsAddingColumn(false);
    }
  };

  const getColumnIcon = (id: string) => {
    switch (id) {
      case 'pending':
        return <Circle className="text-slate-400" size={18} />;
      case 'commitment':
        return <Target className="text-indigo-500" size={18} />;
      case 'working-now':
        return <PlayCircle className="text-amber-500" size={18} />;
      case 'in-progress':
        return <Clock className="text-blue-500" size={18} />;
      case 'internal-review':
        return <Eye className="text-purple-500" size={18} />;
      case 'client-review':
        return <UserCheck className="text-teal-500" size={18} />;
      case 'client-feedback':
        return <MessageSquare className="text-orange-500" size={18} />;
      case 'completed':
        return <CheckCircle2 className="text-emerald-500" size={18} />;
      default:
        return <Circle className="text-slate-400" size={18} />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Tablero Kanban</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Gestiona el flujo de trabajo de tu Roadmap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <Layers size={18} />
            <span className="hidden sm:inline">Acciones Masivas</span>
          </button>

          {isAddingColumn ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
              <input
                type="text"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Nombre de la columna"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
              />
              <button
                onClick={handleAddColumn}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={() => setIsAddingColumn(false)}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
            >
              <Plus size={18} />
              Nueva Columna
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full gap-6 min-w-[1000px] pb-4">
            {columns.map((column) => (
              <div
                key={column.id}
                className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 h-full max-h-[calc(100vh-200px)] min-w-[300px]"
              >
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 rounded-t-xl group/col">
                  <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                    {getColumnIcon(column.id)}
                    {column.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold px-2 py-1 rounded-full">
                      {tasksByStatus[column.id]?.length || 0}
                    </span>
                    {!DEFAULT_KANBAN_COLUMNS.some((c) => c.id === column.id) && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm('¿Borrar esta columna? Las tareas volverán a Pendiente.')
                          ) {
                            deleteKanbanColumn(column.id);
                          }
                        }}
                        className="opacity-0 group-hover/col:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 p-3 overflow-y-auto custom-scrollbar transition-colors flex flex-col ${
                        snapshot.isDraggingOver ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      {tasksByStatus[column.id]?.map((item, index) => (
                        <Draggable key={item.task.id} draggableId={item.task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              onClick={() => setSelectedTask(item)}
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm mb-3 group hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer ${
                                snapshot.isDragging
                                  ? 'shadow-xl ring-2 ring-blue-500 rotate-1'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <Link
                                  to={`/app/module/${item.moduleId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 uppercase tracking-wider bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                                  title={`Ir al Módulo ${item.moduleId}`}
                                >
                                  Módulo {item.moduleId}
                                  <ExternalLink size={10} />
                                </Link>
                                <div className="flex items-center gap-2 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTask(item);
                                    }}
                                    className="hover:text-blue-500 transition-colors p-1"
                                    title="Editar detalles"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <div {...provided.dragHandleProps} className="cursor-grab">
                                    <GripVertical size={16} />
                                  </div>
                                </div>
                              </div>
                              <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3 leading-snug">
                                {item.task.title}
                              </h4>

                              {/* Task Details Edit */}
                              <div className="space-y-2 mb-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                <div
                                  className="flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <User size={14} className="text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Asignar a..."
                                    className="flex-1 bg-transparent text-xs text-slate-600 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none border-b border-transparent focus:border-blue-300 transition-colors py-0.5"
                                    defaultValue={item.task.assignee || ''}
                                    onBlur={(e) =>
                                      updateTaskDetails(item.moduleId, item.task.id, {
                                        assignee: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div
                                  className="flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <LinkIcon size={14} className="text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Enlace externo..."
                                    className="flex-1 bg-transparent text-xs text-blue-600 dark:text-blue-400 placeholder:text-slate-400 focus:outline-none border-b border-transparent focus:border-blue-300 transition-colors py-0.5"
                                    defaultValue={item.task.externalLink || ''}
                                    onBlur={(e) =>
                                      updateTaskDetails(item.moduleId, item.task.id, {
                                        externalLink: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div
                                  className="flex items-start gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FileText size={14} className="text-slate-400 mt-0.5" />
                                  <textarea
                                    placeholder="Notas adicionales..."
                                    className="flex-1 bg-transparent text-xs text-slate-600 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none border-b border-transparent focus:border-blue-300 transition-colors py-0.5 resize-none overflow-hidden"
                                    rows={1}
                                    defaultValue={item.task.userNotes || ''}
                                    onBlur={(e) =>
                                      updateTaskDetails(item.moduleId, item.task.id, {
                                        userNotes: e.target.value,
                                      })
                                    }
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = target.scrollHeight + 'px';
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                    item.task.impact === 'High'
                                      ? 'text-rose-600 bg-rose-50 border-rose-100'
                                      : item.task.impact === 'Medium'
                                        ? 'text-amber-600 bg-amber-50 border-amber-100'
                                        : 'text-slate-500 bg-slate-50 border-slate-100'
                                  }`}
                                >
                                  {item.task.impact}
                                </span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Add Task Button/Input at bottom of column */}
                      <div className="mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
                        {isAddingTask?.columnId === column.id ? (
                          <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-blue-300 dark:border-blue-500 shadow-sm">
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              placeholder="Título de la tarea..."
                              className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none mb-2"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTask(column.id);
                                if (e.key === 'Escape') setIsAddingTask(null);
                              }}
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setIsAddingTask(null)}
                                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleAddTask(column.id)}
                                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                              >
                                Añadir
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setIsAddingTask({ columnId: column.id });
                              setNewTaskTitle('');
                            }}
                            className="w-full flex items-center justify-center gap-1 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors group"
                          >
                            <Plus
                              size={16}
                              className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                            />
                            Añadir tarjeta
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      <BulkActionsModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} />

      <TaskDetailModal
        isOpen={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        task={selectedTask?.task || null}
        moduleId={selectedTask?.moduleId || null}
        onUpdateTaskDetails={updateTaskDetails}
        onToggleTask={toggleTask}
      />
    </div>
  );
};

export default KanbanBoard;
